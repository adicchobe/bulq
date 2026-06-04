import { llmCall } from '@/lib/ai'
import { createUserFood } from '@/lib/db/foods'
import type { MealItemInput } from '@/lib/db/meals'
import { normalizeFoodName } from './match'

// ⚠️ Pillar #1 tension: this is the ONE place Bulq estimates a per-food number
// rather than sourcing it. Mitigations: a WIDE band (±30%), a 'derived' source on
// the created food, low item confidence, and a visible "(estimated)" label so the
// number is never mistaken for a sourced one. Fail-safe throughout.

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
 * Fill in macros for any items that the matcher couldn't resolve, via ONE LLM
 * call. For each estimated food we also persist a 'derived' user food (wide band)
 * so the next log of that food matches instead of re-estimating.
 *
 * FAIL-SAFE: any error (LLM, parse, DB) → console.error and the items are
 * returned UNCHANGED (still 'unknown', shown as "couldn't estimate" in the card).
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

  try {
    const foodList = unknowns.map((it) => it.food_name_raw).join('\n')
    const res = await llmCall({
      system: ESTIMATE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: foodList }],
      priority: 'standard',
      userId,
      operation: 'meal_estimate',
      maxTokens: 1024,
      temperature: 0,
    })

    const estimates = parseEstimates(res.text)
    if (estimates.length === 0) return items

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
        out.push(it) // no estimate for this one → leave it unknown
        continue
      }

      const typ = est.kcal_per_100g
      // Persist a 'derived' food (wide band) so future logs match it directly.
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
    }
    return out
  } catch (err) {
    console.error('estimateUnknownFoods failed (leaving items unknown):', err)
    return items
  }
}
