import {
  getConfirmedMealsForDay,
  type MealRow,
  type MealType,
} from '@/lib/db/meals'
import { getProfile, profileToNutritionProfile } from '@/lib/db/profiles'
import { computeNutritionTargets } from '@/lib/nutrition'

// IST is UTC+5:30 (330 min), no DST. "Today" for this single-tenant POC is the
// IST calendar day; Supabase stores timestamps in UTC, so we convert the IST day
// bounds back to UTC instants for the query.
const IST_OFFSET_MIN = 5 * 60 + 30

/**
 * UTC bounds [startUtc, endUtc) of the IST calendar day that contains `now`.
 * Shift `now` into IST wall-clock to read the IST Y-M-D, build that day's IST
 * midnight, then subtract the offset to get the real UTC instant. Pure.
 */
export function istDayRangeUtc(now: Date): { startUtc: Date; endUtc: Date } {
  const offsetMs = IST_OFFSET_MIN * 60 * 1000
  const ist = new Date(now.getTime() + offsetMs)
  const y = ist.getUTCFullYear()
  const m = ist.getUTCMonth()
  const d = ist.getUTCDate()
  // Date.UTC(...) is IST-midnight "as if UTC"; minus the offset = the UTC instant
  // when IST actually hits midnight.
  const startUtcMs = Date.UTC(y, m, d, 0, 0, 0, 0) - offsetMs
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000
  return { startUtc: new Date(startUtcMs), endUtc: new Date(endUtcMs) }
}

/** Current time as an IST label for the chat prompt (reuses the IST offset). Pure. */
export function istNowLabel(now: Date): string {
  const ist = new Date(now.getTime() + IST_OFFSET_MIN * 60 * 1000)
  const date = ist.toISOString().slice(0, 10) // IST calendar date (offset already applied)
  const hh = ist.getUTCHours()
  const mm = String(ist.getUTCMinutes()).padStart(2, '0')
  const h12 = ((hh + 11) % 12) + 1
  return `${date} ${h12}:${mm} ${hh < 12 ? 'am' : 'pm'} IST` // e.g. "2026-05-31 11:34 pm IST"
}

/** A confirmed meal logged today (IST) — for naming back to the user. No numbers here. */
export interface TodayMeal {
  rawText: string | null
  mealType: MealType | null
}

export interface TodaySummary {
  consumed: {
    kcal_min: number
    kcal_typical: number
    kcal_max: number
    protein_g: number
  }
  target: { kcal: number; protein_g: number }
  remaining: { kcal_typical: number; protein_g: number }
  meals: TodayMeal[] // today-only, confirmed, in-window; mealCount === meals.length
  mealCount: number
}

/**
 * Sum confirmed meals into a consumed BAND (don't collapse to one number) and
 * compute what's left vs target (against the typical figure). Pure. `remaining`
 * may go negative (over target) — the recommendation step interprets that.
 */
export function computeTodaySummary(
  meals: MealRow[],
  target: { kcal: number; protein_g: number },
): TodaySummary {
  const consumed = { kcal_min: 0, kcal_typical: 0, kcal_max: 0, protein_g: 0 }
  for (const meal of meals) {
    consumed.kcal_min += meal.kcal_min ?? 0
    consumed.kcal_typical += meal.kcal_typical ?? 0
    consumed.kcal_max += meal.kcal_max ?? 0
    consumed.protein_g += meal.protein_g ?? 0
  }
  // Same rows getConfirmedMealsForDay already returned — no new query.
  const todayMeals: TodayMeal[] = meals.map((m) => ({
    rawText: m.raw_text,
    mealType: m.meal_type,
  }))
  return {
    consumed,
    target,
    remaining: {
      kcal_typical: target.kcal - consumed.kcal_typical,
      protein_g: target.protein_g - consumed.protein_g,
    },
    meals: todayMeals,
    mealCount: todayMeals.length, // kept in lockstep with the list
  }
}

/**
 * Orchestrator: today's (IST) confirmed-meal total vs the user's computed target.
 * Compute-on-the-fly (no daily_summaries table yet). Exercised live.
 */
export async function getTodaySummary(userId: string): Promise<TodaySummary> {
  const { startUtc, endUtc } = istDayRangeUtc(new Date())
  const meals = await getConfirmedMealsForDay(userId, startUtc, endUtc)

  const profile = await getProfile(userId)
  const targets = profile
    ? computeNutritionTargets(profileToNutritionProfile(profile))
    : null
  const target = {
    kcal: targets?.dailyTargetKcal ?? 0,
    protein_g: targets?.proteinTargetG ?? 0,
  }

  return computeTodaySummary(meals, target)
}
