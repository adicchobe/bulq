import { llmCall } from '@/lib/ai'
import { ParsedMealSchema, type ParsedMeal } from './types'

// Sprint 6: ONE Gemini call that does BOTH intent classification AND item
// extraction, replacing the old sequential intent_detect + meal_parse (2 calls →
// 1). The safety property — "ambiguous / failed → question, never a phantom meal
// card" — is enforced STRUCTURALLY in deriveClassifyParse below, not trusted to
// the model.

export type ClassifyParseResult =
  | { intent: 'meal_log'; meal: ParsedMeal }
  | { intent: 'question' }

const CLASSIFY_PARSE_SYSTEM_PROMPT = `You read a person's chat message and do TWO things in one step: classify intent, then (only for meals) extract the foods. Indian foods are your default frame of reference.

First decide intent:
- "meal_log" — the message reports food the user ate, drank, is eating, or just had (including bare food lists like "rice dal sabzi", any cuisine).
- "question" — a question, a request for advice/plans, a status check, a greeting, or anything that is NOT a report of consumed food.

Return ONLY a JSON object — no markdown fences, no prose — in exactly this shape:
{"intent":"meal_log"|"question","items":[{"food_name_raw":string,"quantity":number,"unit_raw":string|null}],"meal_type":"breakfast"|"lunch"|"dinner"|"snack"|"unknown"}

Rules:
- If intent is "question", items MUST be [] and meal_type "unknown". Do not extract foods from a question.
- If intent is "meal_log", one object per distinct food. Split compound inputs ("X and Y") into separate items.
- food_name_raw: the food as said, singular and lowercase (e.g. "roti", "dal", "boiled egg").
- quantity: the stated count (default 1 if not stated).
- unit_raw: the stated measure word EXACTLY if present ("katori","glass","piece","scoop","bowl","plate","cup","tbsp"), else null. A bare count like "3 rotis" has unit_raw null.
- meal_type: infer ONLY if clearly stated or implied, else "unknown".
- CRITICAL: NEVER output calories, macros, grams, weights, or ANY nutritional number. The ONLY number is quantity. You are structuring text, NOT estimating nutrition.

Examples:
Input: 3 rotis and a katori of dal
Output: {"intent":"meal_log","items":[{"food_name_raw":"roti","quantity":3,"unit_raw":null},{"food_name_raw":"dal","quantity":1,"unit_raw":"katori"}],"meal_type":"unknown"}
Input: 2 boiled eggs and a glass of milk
Output: {"intent":"meal_log","items":[{"food_name_raw":"boiled egg","quantity":2,"unit_raw":null},{"food_name_raw":"milk","quantity":1,"unit_raw":"glass"}],"meal_type":"unknown"}
Input: had a bowl of poha for breakfast
Output: {"intent":"meal_log","items":[{"food_name_raw":"poha","quantity":1,"unit_raw":"bowl"}],"meal_type":"breakfast"}
Input: chicken biryani for dinner
Output: {"intent":"meal_log","items":[{"food_name_raw":"chicken biryani","quantity":1,"unit_raw":null}],"meal_type":"dinner"}
Input: is dal healthy?
Output: {"intent":"question","items":[],"meal_type":"unknown"}
Input: what should I eat to gain weight?
Output: {"intent":"question","items":[],"meal_type":"unknown"}
Input: how am I doing today?
Output: {"intent":"question","items":[],"meal_type":"unknown"}
Input: i'm hungry
Output: {"intent":"question","items":[],"meal_type":"unknown"}`

/** Outermost {...} → JSON.parse, stripping fences/prose. undefined if no parseable
 *  object (truncation / garbage) — the signal to RETRY, distinct from a clean
 *  question result. */
function extractJsonObject(rawText: string): Record<string, unknown> | undefined {
  if (!rawText) return undefined
  const noFences = rawText.replace(/```(?:json)?/gi, '').trim()
  const start = noFences.indexOf('{')
  const end = noFences.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return undefined
  try {
    const parsed: unknown = JSON.parse(noFences.slice(start, end + 1))
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
    return undefined
  } catch {
    return undefined
  }
}

type Outcome =
  | { kind: 'meal_log'; meal: ParsedMeal }
  | { kind: 'question' } // cleanly determined (valid JSON; question, or meal w/o items)
  | { kind: 'unparseable' } // no valid JSON → candidate for a retry

/** Internal: classify a raw response into one of three outcomes. `unparseable`
 *  is kept distinct from `question` so the caller can retry truncation/garbage
 *  WITHOUT retrying a legitimate question. */
function classifyOutcome(rawText: string): Outcome {
  const obj = extractJsonObject(rawText)
  if (!obj) return { kind: 'unparseable' }

  // Intent is anything-but-meal_log → safe question (covers missing/garbage intent).
  if (obj.intent !== 'meal_log') return { kind: 'question' }

  // intent === 'meal_log': validate items via the SAME Zod schema parse uses.
  // Extra `intent` key is ignored by Zod. Invalid OR empty items → safety → question.
  const result = ParsedMealSchema.safeParse(obj)
  if (!result.success || result.data.items.length === 0) return { kind: 'question' }
  return { kind: 'meal_log', meal: result.data }
}

/**
 * PURE safety derivation from a raw LLM response. The structural guarantee:
 *   - JSON parse fails / no object   → question
 *   - intent !== 'meal_log'          → question
 *   - intent missing                 → question
 *   - meal_log but empty/invalid items → question
 *   - ONLY valid JSON + intent meal_log + non-empty validated items → meal_log
 * So a phantom meal card is impossible unless the model BOTH says meal_log AND
 * returns real items in valid JSON. Exported for unit testing.
 */
export function deriveClassifyParse(rawText: string): ClassifyParseResult {
  const outcome = classifyOutcome(rawText)
  return outcome.kind === 'meal_log'
    ? { intent: 'meal_log', meal: outcome.meal }
    : { intent: 'question' }
}

/**
 * Merged classify + parse in ONE Gemini call (replaces intent_detect + meal_parse
 * on the meal path). Retries ONCE (1s pause) on a hard failure — an LLM throw
 * (transient RPM) or an unparseable/truncated response — but NOT on a cleanly
 * parsed question (that's a real answer, not a failure). Fail-safe: after the
 * retry, any remaining failure resolves to { intent: 'question' } — never throws,
 * never fabricates a meal.
 */
export async function classifyAndParse(
  userId: string,
  text: string,
): Promise<ClassifyParseResult> {
  const trimmed = text.trim()
  if (!trimmed) return { intent: 'question' }

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const res = await llmCall({
        system: CLASSIFY_PARSE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: trimmed }],
        priority: 'standard',
        userId,
        operation: 'meal_classify_parse',
        maxTokens: 2048, // adapter also hard-floors Gemini at 2048 (R11 thinking tokens)
        temperature: 0,
      })
      const outcome = classifyOutcome(res.text)
      if (outcome.kind === 'meal_log') return { intent: 'meal_log', meal: outcome.meal }
      if (outcome.kind === 'question') return { intent: 'question' }
      // unparseable (truncation/garbage) → fall through to retry.
      console.warn(
        `classifyAndParse: attempt ${attempt} unparseable response (${res.text.length} chars)`,
      )
    } catch (err) {
      console.error(
        `classifyAndParse: attempt ${attempt} LLM call failed:`,
        err instanceof Error ? err.message : err,
      )
    }
    if (attempt === 1) await new Promise((r) => setTimeout(r, 1000))
  }
  // Both attempts hard-failed → safe default (mirrors the old classify fail-safe).
  return { intent: 'question' }
}
