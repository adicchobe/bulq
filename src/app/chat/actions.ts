'use server'

import { createClient } from '@/lib/db/server'
import {
  setMealStatus,
  updateMealItem,
  recomputeMealTotals,
  getMealById,
} from '@/lib/db/meals'
import {
  getMatchableFoods,
  createUserFood,
  updateUserFood,
  addAliasToUserFood,
  type FoodRow,
} from '@/lib/db/foods'
import { getUnits } from '@/lib/db/units'
import { similarity, normalizeFoodName } from '@/lib/meals/match'
import { buildMealItem } from '@/lib/meals/portion'
import type { ParsedItem } from '@/lib/meals/types'

async function setStatus(
  mealId: string,
  status: 'confirmed' | 'rejected',
): Promise<{ ok: boolean }> {
  if (typeof mealId !== 'string' || mealId.length === 0) return { ok: false }
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  try {
    // ok ONLY if a row was actually updated (RLS + user_id scope enforce ownership).
    const updated = await setMealStatus(user.id, mealId, status)
    return { ok: updated }
  } catch (err) {
    console.error(`setStatus(${status}) failed:`, err)
    return { ok: false }
  }
}

export async function confirmMeal(mealId: string): Promise<{ ok: boolean }> {
  return setStatus(mealId, 'confirmed')
}

export async function rejectMeal(mealId: string): Promise<{ ok: boolean }> {
  return setStatus(mealId, 'rejected')
}

// Same HIGH bar as the meal matcher (match.ts): below this we create a new food
// rather than risk merging two genuinely different foods.
const TEACH_FUZZY_THRESHOLD = 0.82

/** Best user-owned food whose name/aliases fuzzy-match `name`, or null. */
function bestUserFoodMatch(name: string, foods: FoodRow[]): { food: FoodRow; score: number } | null {
  const q = normalizeFoodName(name)
  let best: { food: FoodRow; score: number } | null = null
  for (const f of foods) {
    if (f.source_type !== 'user') continue
    for (const candidate of [f.name, ...f.aliases]) {
      const score = similarity(q, normalizeFoodName(candidate))
      if (!best || score > best.score) best = { food: f, score }
    }
  }
  return best
}

/**
 * "Teach your foods": create (or update) a user-owned food from what the user
 * tells us, and — when a specific unknown meal item is referenced — back-fill
 * that item's macros and recompute the meal's totals.
 *
 * Returns { ok, foodName }. Never throws to the client (errors → { ok: false }).
 */
export async function teachFood(input: {
  name: string
  proteinPerServing: number
  kcalPerServing?: number
  servingGrams?: number
  mealId?: string
  mealItemId?: string
}): Promise<{ ok: boolean; foodName?: string }> {
  // a. Validate + auth (same shape as setStatus).
  if (!input || typeof input.name !== 'string' || input.name.trim().length === 0) {
    return { ok: false }
  }
  if (
    typeof input.proteinPerServing !== 'number' ||
    !Number.isFinite(input.proteinPerServing) ||
    input.proteinPerServing < 0
  ) {
    return { ok: false }
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  const name = input.name.trim()
  const foodInput = {
    name,
    proteinPerServing: input.proteinPerServing,
    kcalPerServing: input.kcalPerServing,
    servingGrams: input.servingGrams,
  }

  try {
    // b. Alias dedup: reuse an existing user food if the name is a near-match,
    //    else create a new one.
    const foods = await getMatchableFoods(user.id)
    const match = bestUserFoodMatch(name, foods)

    let food: FoodRow
    if (match && match.score >= TEACH_FUZZY_THRESHOLD) {
      // Update the existing food's macros (keep its canonical name) and record
      // the new spelling as an alias so it matches verbatim next time.
      await updateUserFood(match.food.id, user.id, { ...foodInput, name: match.food.name })
      food = await addAliasToUserFood(match.food.id, user.id, name)
    } else {
      food = await createUserFood(user.id, foodInput)
    }

    // c. If a specific unknown meal item was referenced, re-derive its macros
    //    against the now-known food and fix up the meal totals.
    if (input.mealId && input.mealItemId) {
      const meal = await getMealById(user.id, input.mealId)
      const target = meal?.items.find((it) => it.id === input.mealItemId)
      if (target) {
        const units = await getUnits(user.id)
        const parsed: ParsedItem = {
          food_name_raw: target.food_name_raw,
          quantity: target.quantity,
          unit_raw: null, // not persisted on the item; resolveGrams infers from the food
        }
        const rebuilt = buildMealItem(parsed, { food, method: 'exact' }, units)

        await updateMealItem(user.id, input.mealItemId, {
          food_id: rebuilt.food_id,
          matched_food_name: rebuilt.matched_food_name,
          unit_key: rebuilt.unit_key,
          grams_used: rebuilt.grams_used,
          match_method: rebuilt.match_method,
          kcal_min: rebuilt.kcal_min,
          kcal_typical: rebuilt.kcal_typical,
          kcal_max: rebuilt.kcal_max,
          protein_g: rebuilt.protein_g,
          fat_g: rebuilt.fat_g,
          carb_g: rebuilt.carb_g,
          fiber_g: rebuilt.fiber_g,
        })
        await recomputeMealTotals(user.id, input.mealId)
      }
    }

    // d. Done.
    return { ok: true, foodName: food.name }
  } catch (err) {
    // e. Never surface a raw error to the client.
    console.error('teachFood failed:', err)
    return { ok: false }
  }
}
