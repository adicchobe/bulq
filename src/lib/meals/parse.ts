// TODO(adapter): this uses llmCall + manual JSON extraction + Zod rather than a
// generateObject method on the adapter, deliberately, to keep the hardened
// adapter untouched. Zod gives structural safety. If real usage shows frequent
// malformed-JSON failures, add a structured-output (generateObject) method to
// /lib/ai/adapter and switch this over.
import { llmCall } from '@/lib/ai'
import { ParsedMealSchema, type ParsedMeal, type ParseResult } from './types'

const PARSE_SYSTEM_PROMPT = `You convert a person's description of what they ate into STRICT JSON. Indian foods are your default frame of reference.

Return ONLY a JSON object — no markdown fences, no prose — in exactly this shape:
{"items":[{"food_name_raw":string,"quantity":number,"unit_raw":string|null}],"meal_type":"breakfast"|"lunch"|"dinner"|"snack"|"unknown"}

Rules:
- One object per distinct food. Split compound inputs ("X and Y") into separate items.
- food_name_raw: the food as said, singular and lowercase (e.g. "roti", "dal", "boiled egg").
- quantity: the stated count (default 1 if not stated).
- unit_raw: the stated measure word EXACTLY if present ("katori","glass","piece","scoop","bowl","plate","cup","tbsp"), else null. A bare count like "3 rotis" has unit_raw null.
- meal_type: infer ONLY if clearly stated or implied, else "unknown".
- CRITICAL: NEVER output calories, macros, grams, weights, or ANY nutritional number. The ONLY number is quantity. You are structuring text, NOT estimating nutrition.
- If there is no food, return {"items":[],"meal_type":"unknown"}.

Examples:
Input: 3 rotis and a katori of dal
Output: {"items":[{"food_name_raw":"roti","quantity":3,"unit_raw":null},{"food_name_raw":"dal","quantity":1,"unit_raw":"katori"}],"meal_type":"unknown"}
Input: 2 boiled eggs and a glass of milk
Output: {"items":[{"food_name_raw":"boiled egg","quantity":2,"unit_raw":null},{"food_name_raw":"milk","quantity":1,"unit_raw":"glass"}],"meal_type":"unknown"}
Input: had a bowl of poha for breakfast
Output: {"items":[{"food_name_raw":"poha","quantity":1,"unit_raw":"bowl"}],"meal_type":"breakfast"}`

/**
 * PURE: turn a raw LLM response into a validated ParsedMeal, or null on any
 * failure. Strips markdown code fences and surrounding prose (takes the outermost
 * {...}), JSON.parses, then validates with ParsedMealSchema. This is the fragile
 * part of the parse step — kept pure and unit-tested.
 */
export function extractParsedMeal(rawText: string): ParsedMeal | null {
  if (!rawText) return null
  try {
    const noFences = rawText.replace(/```(?:json)?/gi, '').trim()
    const start = noFences.indexOf('{')
    const end = noFences.lastIndexOf('}')
    if (start === -1 || end === -1 || end < start) return null
    const parsed: unknown = JSON.parse(noFences.slice(start, end + 1))
    const result = ParsedMealSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

/**
 * Structure free-text into food items via the LLM (Gemini default, through the
 * hardened adapter). Numbers-free by design: the prompt forbids any nutritional
 * output. Returns a discriminated ParseResult — never throws.
 */
export async function parseMealText(
  userId: string,
  text: string,
): Promise<ParseResult> {
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, reason: 'empty' }

  let responseText: string
  try {
    const res = await llmCall({
      system: PARSE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: trimmed }],
      priority: 'standard',
      userId,
      operation: 'meal_parse',
      // 2048 matches the adapter's Gemini thinking-token floor. At 1024, a large
      // meal (8+ items) overruns the budget once hidden thinking tokens are
      // subtracted → truncated JSON → parse_failed (R11). The adapter now enforces
      // this as a hard floor for Gemini, but we set it explicitly here too.
      maxTokens: 2048,
      temperature: 0, // deterministic structured output
    })
    responseText = res.text
  } catch {
    return { ok: false, reason: 'llm_failed' }
  }

  const meal = extractParsedMeal(responseText)
  if (!meal) return { ok: false, reason: 'parse_failed' }
  if (meal.items.length === 0) return { ok: false, reason: 'empty' }
  return { ok: true, meal }
}
