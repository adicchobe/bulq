import { llmCall } from '@/lib/ai'
import { createUserFood } from '@/lib/db/foods'
import type { MealItemInput } from '@/lib/db/meals'
import { normalizeFoodName } from './match'

// ⚠️ Pillar #1 tension: this is the ONE place Bulq estimates a per-food number
// rather than sourcing it. Mitigations: a WIDE band (±30%), a 'derived' source on
// the created food, low item confidence, and a visible "(estimated)" label so the
// number is never mistaken for a sourced one. Fail-safe throughout, BUT loudly
// logged (console.warn/error) so a silent production failure is visible in Vercel.

const ESTIMATE_SYSTEM_PROMPT = `Estimate per-100g calories and protein for each food the user names. Indian foods are your default frame of reference.

Return ONLY a JSON array — no markdown fences, no prose — one object per input food, in the SAME ORDER:
[{"name": string, "kcal_per_100g": number, "protein_per_100g": number}]

Use realistic values for the food as commonly eaten. Numbers only; no ranges, no units in the values.`

interface EstimatedFood {
  name: string
  kcal_per_100g: number
  protein_per_100g: number
}

const round0 = (n: number): number => Math.round(n)
const round1 = (n: number): number => Math.round(n * 10) / 10
const errStr = (err: unknown): string => (err instanceof Error ? err.message : String(err))

/** PURE: strip fences → take the outermost [...] → JSON.parse → light validation.
 *  Always returns an array — invalid/empty input yields []. */
export function parseEstimates(raw: string): EstimatedFood[] {
  if (!raw) return []
  try {
    const noFences = raw.replace(/```(?:json)?/gi, '').trim()
    const start = noFences.indexOf('[')
    const end = noFences.lastIndexOf(']')
    if (start === -1 || end === -1 || end < start) return []
    const parsed: unknown = JSON.parse(noFences.slice(start, end + 1))
    if (!Array.isArray(parsed)) return []
    const out: EstimatedFood[] = []
    for (const e of parsed) {
      if (
        e &&
        typeof (e as EstimatedFood).name === 'string' &&
        typeof (e as EstimatedFood).kcal_per_100g === 'number' &&
        Number.isFinite((e as EstimatedFood).kcal_per_100g) &&
        typeof (e as EstimatedFood).protein_per_100g === 'number' &&
        Number.isFinite((e as EstimatedFood).protein_per_100g)
      ) {
        const v = e as EstimatedFood
        out.push({
          name: v.name,
          kcal_per_100g: v.kcal_per_100g,
          protein_per_100g: v.protein_per_100g,
        })
      }
    }
    return out
  } catch {
    return []
  }
}

/**
 * Run the estimate LLM call and parse it, with ONE retry. Retries when the call
 * throws (transient RPM — this is the 3rd Gemini call of a meal turn) OR when the
 * parse comes back empty (Gemini-2.5 thinking-token truncation). Never throws.
 */
async function fetchEstimates(userId: string, foodList: string): Promise<EstimatedFood[]> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const res = await llmCall({
        system: ESTIMATE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: foodList }],
        priority: 'standard',
        userId,
        operation: 'meal_estimate',
        // 2048 matches the adapter's Gemini thinking-token floor. At 1024 the hidden
        // "thinking" tokens can consume the whole budget → empty/truncated output.
        maxTokens: 2048,
        temperature: 0,
      })
      const estimates = parseEstimates(res.text)
      console.warn(
        `estimateUnknownFoods: attempt ${attempt} — response ${res.text.length} chars, ${estimates.length} estimate(s) parsed`,
      )
      if (estimates.length > 0) return estimates
    } catch (err) {
      console.error(`estimateUnknownFoods: attempt ${attempt} LLM call failed: ${errStr(err)}`)
    }
    // Pause once before the retry to let a rate-limit window clear.
    if (attempt === 1) await new Promise((r) => setTimeout(r, 1000))
  }
  return []
}

/**
 * Fill in macros for any items the matcher couldn't resolve, via one (retried)
 * LLM call. For each estimated food we also persist a 'derived' user food (wide
 * band) so the next log of that food matches instead of re-estimating.
 *
 * ROBUST + FAIL-SAFE: never throws to the caller. The LLM call retries once; each
 * food's persist is isolated (one failure can't lose the others); a food with no
 * estimate (or a failed persist) simply stays 'unknown'. Every branch is logged.
 *
 * 🧠 Portion is unknown for an unmatched food, so we assume ~100g per unit (the
 * pipeline's fallback typical) and scale by quantity. The ±30% band carries the
 * uncertainty (pillar #2).
 */
export async function estimateUnknownFoods(
  items: MealItemInput[],
  userId: string,
): Promise<MealItemInput[]> {
  const unknowns = items.filter((it) => it.match_method === 'unknown')
  if (unknowns.length === 0) return items

  console.warn(
    `estimateUnknownFoods: ${unknowns.length} unknown item(s) to estimate: ${unknowns
      .map((u) => u.food_name_raw)
      .join(', ')}`,
  )

  try {
    const foodList = unknowns.map((it) => it.food_name_raw).join('\n')
    const estimates = await fetchEstimates(userId, foodList)
    if (estimates.length === 0) {
      console.error('estimateUnknownFoods: no estimates after retry — leaving items unknown')
      return items
    }

    // Match estimates back by normalized name; fall back to position-in-unknowns.
    const byName = new Map<string, EstimatedFood>()
    for (const e of estimates) byName.set(normalizeFoodName(e.name), e)

    let unknownIdx = -1
    const out: MealItemInput[] = []
    for (const it of items) {
      if (it.match_method !== 'unknown') {
        out.push(it)
        continue
      }
      unknownIdx += 1
      const est = byName.get(normalizeFoodName(it.food_name_raw)) ?? estimates[unknownIdx]
      if (!est) {
        console.warn(`estimateUnknownFoods: no estimate matched "${it.food_name_raw}" — left unknown`)
        out.push(it)
        continue
      }

      // Per-item isolation: a failed createUserFood must NOT lose the other items'
      // estimates. A failure here leaves just this item 'unknown'.
      try {
        const typ = est.kcal_per_100g
        const food = await createUserFood(userId, {
          name: it.food_name_raw,
          proteinPerServing: est.protein_per_100g, // per 100g (servingGrams default 100)
          sourceType: 'derived',
          kcalBand: { min: round0(typ * 0.7), typical: round0(typ), max: round0(typ * 1.3) },
        })
        const qty = it.quantity
        out.push({
          ...it,
          food_id: food.id,
          matched_food_name: `${it.food_name_raw} (estimated)`,
          match_method: 'fuzzy',
          grams_used: round0(100 * qty), // ~100g per unit assumption
          kcal_min: round0(typ * 0.7 * qty),
          kcal_typical: round0(typ * qty),
          kcal_max: round0(typ * 1.3 * qty),
          protein_g: round1(est.protein_per_100g * qty),
        })
        console.warn(
          `estimateUnknownFoods: estimated "${it.food_name_raw}" → ~${round0(typ)} kcal/100g, ${round1(
            est.protein_per_100g,
          )}g protein/100g`,
        )
      } catch (err) {
        console.error(
          `estimateUnknownFoods: createUserFood failed for "${it.food_name_raw}" (left unknown): ${errStr(err)}`,
        )
        out.push(it)
      }
    }

    return out
  } catch (err) {
    // Last-resort safety net — the caller assigns this result directly, so we must
    // never throw. Per-item/LLM failures are handled above; this is for the unexpected.
    console.error(`estimateUnknownFoods: unexpected failure (leaving items unknown): ${errStr(err)}`)
    return items
  }
}
