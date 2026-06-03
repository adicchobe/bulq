'use server'

import { createClient } from '@/lib/db/server'
import { insertWeightLog, getWeightLogs, type WeightLogRow } from '@/lib/db/weight-logs'
import {
  getProfile,
  profileToNutritionProfile,
  setRecalibrationAdjustment,
} from '@/lib/db/profiles'
import {
  computeNutritionTargets,
  weeklyRateOfChange,
  recalibrateTdee,
  DEFAULT_SURPLUS_KCAL,
  DEFAULT_DEFICIT_KCAL,
} from '@/lib/nutrition'

// Energy density of body-mass change (~kcal per kg) — turns a surplus/deficit
// into an expected weekly rate. A round-number estimate; the trend is the proof.
const KCAL_PER_KG = 7700
const MS_PER_DAY = 86_400_000
// Recalibration needs a trend over at least this many days to be trustworthy,
// and the same gap must pass between adjustments (cooldown).
const MIN_TREND_DAYS = 14
// Hard cap on the cumulative adjustment magnitude (kcal) — a runaway guard.
const MAX_ADJUSTMENT_KCAL = 600

/** Calendar span (days) covered by the logs; 0 if fewer than 2. */
function dateSpanDays(logs: { measured_at: string }[]): number {
  if (logs.length < 2) return 0
  const times = logs.map((l) => new Date(l.measured_at).getTime())
  return (Math.max(...times) - Math.min(...times)) / MS_PER_DAY
}

/**
 * Log a manual weight entry for the signed-in user. Validates weightKg > 0 and
 * auths via the session (never trusts a client-supplied user id). Never throws to
 * the client — failure surfaces as { ok: false }.
 */
export async function logWeight(input: {
  weightKg: number
  measuredAt?: string
  notes?: string
}): Promise<{ ok: boolean }> {
  if (
    !input ||
    typeof input.weightKg !== 'number' ||
    !Number.isFinite(input.weightKg) ||
    input.weightKg <= 0
  ) {
    return { ok: false }
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  try {
    await insertWeightLog(user.id, {
      weightKg: input.weightKg,
      measuredAt: input.measuredAt,
      notes: input.notes,
    })
    return { ok: true }
  } catch (err) {
    console.error('logWeight failed:', err)
    return { ok: false }
  }
}

/** The signed-in user's 7 most recent weight logs (newest first). */
export async function getRecentWeights(): Promise<{ ok: boolean; logs: WeightLogRow[] }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, logs: [] }

  try {
    const logs = await getWeightLogs(user.id, 7)
    return { ok: true, logs }
  } catch (err) {
    console.error('getRecentWeights failed:', err)
    return { ok: false, logs: [] }
  }
}

/**
 * Recalibrate the user's TDEE from their real weight trend (brief §15). Needs a
 * gain/loss goal and 14+ days of weight data. Compares the actual weekly rate to
 * what the surplus/deficit predicted; on a large enough divergence, accumulates a
 * ±200 kcal adjustment onto profiles.recalibration_adjustment_kcal (which the
 * engine folds into every target). Never throws to the client.
 */
export async function recalibrateTargets(): Promise<{
  ok: boolean
  adjusted: boolean
  reason: string
}> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, adjusted: false, reason: 'Not signed in.' }

  try {
    const profile = await getProfile(user.id)
    if (!profile) return { ok: false, adjusted: false, reason: 'Complete onboarding first.' }
    if (profile.goal_direction === 'maintain') {
      return { ok: false, adjusted: false, reason: 'Recalibration applies to gain or loss goals.' }
    }
    const goalDirection = profile.goal_direction === 'gain' ? 'gain' : 'loss'

    // Guard 1: cumulative-adjustment cap (coerce: PostgREST numeric → string).
    if (Math.abs(Number(profile.recalibration_adjustment_kcal ?? 0)) >= MAX_ADJUSTMENT_KCAL) {
      return { ok: false, adjusted: false, reason: 'Maximum adjustment reached' }
    }

    // Guard 2: cooldown — at least MIN_TREND_DAYS since the last adjustment.
    if (profile.recalibrated_at) {
      const daysSince = (Date.now() - new Date(profile.recalibrated_at).getTime()) / MS_PER_DAY
      if (daysSince < MIN_TREND_DAYS) {
        return {
          ok: false,
          adjusted: false,
          reason: 'Recalibrated recently — check back in a couple of weeks.',
        }
      }
    }

    const logs = await getWeightLogs(user.id, 30)
    const trendLogs = logs.map((l) => ({
      weight_kg: l.weight_kg,
      measured_at: l.measured_at ?? l.logged_at,
    }))
    if (dateSpanDays(trendLogs) < MIN_TREND_DAYS) {
      return { ok: false, adjusted: false, reason: 'Log for 2+ weeks before recalibrating.' }
    }

    const rate = weeklyRateOfChange(trendLogs, 30)
    if (!rate) {
      return { ok: false, adjusted: false, reason: 'Not enough weight data to recalibrate yet.' }
    }

    const targets = computeNutritionTargets(profileToNutritionProfile(profile))
    const surplusKcal = goalDirection === 'gain' ? DEFAULT_SURPLUS_KCAL : DEFAULT_DEFICIT_KCAL
    const expectedRateKgPerWeek =
      ((surplusKcal * 7) / KCAL_PER_KG) * (goalDirection === 'gain' ? 1 : -1)

    const result = recalibrateTdee({
      currentTdee: targets.adjustedTDEE,
      surplusKcal,
      expectedRateKgPerWeek,
      actualRateKgPerWeek: rate.rateKgPerWeek,
      goalDirection,
    })

    if (result.adjustmentKcal !== 0) {
      // Accumulate onto the stored running adjustment (coerce: PostgREST numeric → string).
      const newTotal = Number(profile.recalibration_adjustment_kcal ?? 0) + result.adjustmentKcal
      await setRecalibrationAdjustment(user.id, newTotal)
      return { ok: true, adjusted: true, reason: result.reason }
    }
    return { ok: true, adjusted: false, reason: result.reason }
  } catch (err) {
    console.error('recalibrateTargets failed:', err)
    return { ok: false, adjusted: false, reason: 'Something went wrong — please try again.' }
  }
}
