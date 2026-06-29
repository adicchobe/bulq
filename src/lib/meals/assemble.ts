import { getMatchableFoods, type FoodRow } from '@/lib/db/foods'
import { getUnits, type UnitRow } from '@/lib/db/units'
import type { MealConfidence, MealInput, MealItemInput } from '@/lib/db/meals'
import { matchFood, type FoodMatch } from './match'
import { buildMealItem } from './portion'
import { parseMealText } from './parse'
import type { ParsedMeal } from './types'

const CONFIDENCE_RANK: Record<MealConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
}

/** The lower-confidence of two (low < medium < high). */
function minConfidence(a: MealConfidence, b: MealConfidence): MealConfidence {
  return CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? a : b
}

/**
 * Per-item confidence = the worst of three signals (so any weak link caps it):
 * - match: exact/alias → high, fuzzy → medium (a fuzzy match is less certain).
 * - variance_class: raw_ingredient/cooked_single → high, composite → medium,
 *   restaurant → low (this is variance_class's ONLY use — never a kcal multiplier).
 * - portion: a resolved unit → high, the fallback (unit_key null) → medium.
 * An unmatched food is 'low' outright.
 */
export function computeItemConfidence(
  foodMatch: FoodMatch,
  item: MealItemInput,
): MealConfidence {
  if (foodMatch.method === 'unknown') return 'low'

  const matchScore: MealConfidence = foodMatch.method === 'fuzzy' ? 'medium' : 'high'
  const varianceScore: MealConfidence =
    foodMatch.food.variance_class === 'restaurant'
      ? 'low'
      : foodMatch.food.variance_class === 'composite'
        ? 'medium'
        : 'high' // raw_ingredient | cooked_single
  const portionScore: MealConfidence = item.unit_key === null ? 'medium' : 'high'

  return [matchScore, varianceScore, portionScore].reduce(minConfidence)
}

/** Worst-item rule: a meal is only as confident as its least-confident item. */
export function worstConfidence(confidences: MealConfidence[]): MealConfidence {
  if (confidences.length === 0) return 'low'
  return confidences.reduce(minConfidence)
}

/**
 * PURE assembly: match + build + score each parsed item, and roll up the meal
 * confidence via the worst-item rule. No DB/LLM — takes the foods/units lists.
 */
export function assembleMealItems(
  parsedMeal: ParsedMeal,
  foods: FoodRow[],
  units: UnitRow[],
): {
  items: MealItemInput[]
  itemConfidences: MealConfidence[]
  confidence: MealConfidence
} {
  const items: MealItemInput[] = []
  const itemConfidences: MealConfidence[] = []

  for (const parsed of parsedMeal.items) {
    const match = matchFood(parsed.food_name_raw, foods)
    const item = buildMealItem(parsed, match, units)
    items.push(item)
    itemConfidences.push(computeItemConfidence(match, item))
  }

  return { items, itemConfidences, confidence: worstConfidence(itemConfidences) }
}

export type MealAssembly =
  | { ok: true; mealInput: MealInput; itemConfidences: MealConfidence[] }
  | { ok: false; reason: 'empty' | 'parse_failed' | 'llm_failed' }

/**
 * The PURE/DB half of assembly: take an ALREADY-PARSED meal and do the match +
 * portion + confidence work against the foods/units DB. NO LLM call. `rawText` is
 * the original user message, preserved verbatim into mealInput.raw_text (the
 * ParsedMeal does not carry it). Reusable by a caller that parses elsewhere
 * (e.g. a merged classify+parse call) — see Step 2b.
 */
export async function assembleParsedMeal(
  userId: string,
  parsedMeal: ParsedMeal,
  rawText: string,
): Promise<MealAssembly> {
  const [foods, units] = await Promise.all([
    getMatchableFoods(userId),
    getUnits(userId),
  ])

  const { items, confidence, itemConfidences } = assembleMealItems(
    parsedMeal,
    foods,
    units,
  )

  const mealInput: MealInput = {
    raw_text: rawText,
    meal_type: parsedMeal.meal_type,
    note: null,
    confidence,
    items,
    // logged_at omitted → DB now()
  }

  return { ok: true, mealInput, itemConfidences }
}

/**
 * Orchestrator: text → parse (LLM) → match + build + score (against the foods/
 * units DB) → a proposed MealInput. Does NOT persist — persisting + the confirm
 * UX is the chat-wiring step. Exercised live (no LLM/DB mocking).
 *
 * Behavior is unchanged: it parses, then delegates the pure/DB half to
 * assembleParsedMeal (passing the original text through as raw_text).
 */
export async function assembleMeal(
  userId: string,
  text: string,
): Promise<MealAssembly> {
  const parsed = await parseMealText(userId, text)
  if (!parsed.ok) return { ok: false, reason: parsed.reason }

  return assembleParsedMeal(userId, parsed.meal, text)
}
