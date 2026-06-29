import { z } from 'zod'

export interface ParsedItem {
  food_name_raw: string
  quantity: number
  unit_raw: string | null
}

export interface ParsedMeal {
  items: ParsedItem[]
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'unknown'
}

export type ParseResult =
  | { ok: true; meal: ParsedMeal }
  | { ok: false; reason: 'empty' | 'parse_failed' | 'llm_failed' }

/**
 * Validates the LLM's structured output. Tolerant where it's safe:
 * - quantity: coerces string-numbers ("3" → 3), defaults to 1 if omitted,
 *   must be positive (NaN / 0 / negative → item invalid → whole parse fails).
 * - unit_raw: nullable, defaults to null if omitted.
 * - meal_type: an unexpected value degrades to 'unknown' (best-effort field).
 * NOTE: no nutritional fields exist here — the parse step never carries numbers
 * beyond quantity (pillar #1).
 */
export const ParsedItemSchema = z.object({
  food_name_raw: z.string().min(1),
  quantity: z.coerce.number().positive().default(1),
  unit_raw: z.string().nullable().default(null),
})

/**
 * Tolerant items array: DROP elements that fail ParsedItemSchema (so one malformed
 * item in a large meal doesn't lose the rest), then validate the survivors with the
 * SAME schema — per-item rules are unchanged, a bad item is dropped, never coerced
 * through. Non-array input passes through unchanged so z.array still rejects it
 * (a meal with no items array isn't valid — same as before). If EVERY item is bad
 * the result is [], which the downstream empty-guards (parseMealText / classifyOutcome)
 * already turn into 'empty'/'question' — no blank meal card.
 */
const TolerantParsedItems = z.preprocess(
  (v) => (Array.isArray(v) ? v.filter((item) => ParsedItemSchema.safeParse(item).success) : v),
  z.array(ParsedItemSchema),
)

export const ParsedMealSchema = z.object({
  items: TolerantParsedItems,
  meal_type: z
    .enum(['breakfast', 'lunch', 'dinner', 'snack', 'unknown'])
    .catch('unknown'),
})
