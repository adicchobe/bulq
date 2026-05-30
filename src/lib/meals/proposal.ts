import {
  computeMealTotals,
  type MealConfidence,
  type MealInput,
  type MatchMethod,
} from '@/lib/db/meals'

/**
 * Client-facing proposed-meal shape, carried as a message annotation to render
 * the confirm card. Surfaces the honest kcal range + confidence (pillars #2/#3).
 * (Type-only import in the client keeps server code out of the client bundle.)
 */
export interface MealProposalItem {
  food_name_raw: string
  matched_food_name: string | null
  quantity: number
  unit_key: string | null
  grams_used: number | null
  kcal_min: number | null
  kcal_typical: number | null
  kcal_max: number | null
  match_method: MatchMethod
  confidence: MealConfidence
}

export interface MealProposal {
  mealId: string
  items: MealProposalItem[]
  kcal_min: number
  kcal_typical: number
  kcal_max: number
  mealConfidence: MealConfidence
}

/**
 * Build the client-facing proposal from the ASSEMBLED meal (correct item order)
 * + the persisted meal id. Totals are recomputed from the same items (identical
 * to the stored meal totals by insertMeal's invariant), avoiding any reliance on
 * DB-returned item ordering. Pure.
 */
export function buildProposal(
  mealId: string,
  mealInput: MealInput,
  itemConfidences: MealConfidence[],
): MealProposal {
  const totals = computeMealTotals(mealInput.items)
  return {
    mealId,
    items: mealInput.items.map((it, i) => ({
      food_name_raw: it.food_name_raw,
      matched_food_name: it.matched_food_name,
      quantity: it.quantity,
      unit_key: it.unit_key,
      grams_used: it.grams_used,
      kcal_min: it.kcal_min,
      kcal_typical: it.kcal_typical,
      kcal_max: it.kcal_max,
      match_method: it.match_method,
      confidence: itemConfidences[i] ?? 'low',
    })),
    kcal_min: totals.kcal_min,
    kcal_typical: totals.kcal_typical,
    kcal_max: totals.kcal_max,
    mealConfidence: mealInput.confidence ?? 'low',
  }
}
