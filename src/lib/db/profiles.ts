import { createClient } from './server'
import {
  DEFAULT_DEFICIT_KCAL,
  DEFAULT_PROTEIN_PER_KG,
  DEFAULT_SURPLUS_KCAL,
  type ActivityLevel,
  type GoalDirection,
  type NutritionProfile,
  type Sex,
} from '@/lib/nutrition'

/** A row of the `profiles` table (snake_case, as stored). */
export interface ProfileRow {
  user_id: string
  sex: Sex
  age_years: number
  height_cm: number
  current_weight_kg: number
  goal_weight_kg: number | null
  goal_direction: GoalDirection
  goal_rate_pct_per_week: number | null
  activity_level: ActivityLevel
  training_days_per_week: number | null
  ectomorph_adjustment_pct: number
  dietary_pattern: string | null
  chicken_max_per_week: number | null
  medical_flags: Record<string, unknown>
  sleep_avg_hours: number | null
  kitchen_context: Record<string, unknown>
  recalibration_adjustment_kcal: number
  recalibrated_at: string | null
  created_at: string
  updated_at: string
}

/** Fields the onboarding flow writes (everything except server-managed columns). */
export interface ProfileWriteInput {
  sex: Sex
  age_years: number
  height_cm: number
  current_weight_kg: number
  goal_weight_kg: number
  goal_direction: GoalDirection
  goal_rate_pct_per_week: number
  activity_level: ActivityLevel
  training_days_per_week: number
  ectomorph_adjustment_pct: number
  dietary_pattern: string
  chicken_max_per_week: number
  sleep_avg_hours: number
  medical_flags: Record<string, unknown>
  kitchen_context: Record<string, unknown>
}

/** Read the signed-in user's profile, or null if they haven't onboarded. RLS scopes the read. */
export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(`getProfile failed: ${error.message}`)
  return data as ProfileRow | null
}

/** Insert-or-update the user's profile (re-onboarding overwrites, never errors). */
export async function upsertProfile(
  userId: string,
  input: ProfileWriteInput,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('profiles')
    .upsert({ user_id: userId, ...input }, { onConflict: 'user_id' })

  if (error) throw new Error(`upsertProfile failed: ${error.message}`)
}

/**
 * Bridge a stored profile row into the engine's NutritionProfile. The delta and
 * protein-per-kg are derived from goal_direction (symmetric, pillar #9), since
 * they're engine parameters rather than stored columns. Numeric columns are
 * coerced with Number() — PostgREST can return `numeric` as a string.
 */
export function profileToNutritionProfile(row: ProfileRow): NutritionProfile {
  const deltaKcal =
    row.goal_direction === 'gain'
      ? DEFAULT_SURPLUS_KCAL
      : row.goal_direction === 'lose'
        ? DEFAULT_DEFICIT_KCAL
        : 0

  return {
    sex: row.sex,
    ageYears: Number(row.age_years),
    heightCm: Number(row.height_cm),
    weightKg: Number(row.current_weight_kg),
    activityLevel: row.activity_level,
    goalDirection: row.goal_direction,
    ectomorphAdjustmentPct: Number(row.ectomorph_adjustment_pct),
    deltaKcal,
    proteinPerKg: DEFAULT_PROTEIN_PER_KG,
    // ?? 0 guards rows read before migration 0012 (column absent → undefined).
    recalibrationAdjustmentKcal: Number(row.recalibration_adjustment_kcal ?? 0),
  }
}

/**
 * Persist the user's running recalibration adjustment (kcal) and stamp
 * recalibrated_at = now (gates the cooldown). Recalibration ACCUMULATES, so
 * callers pass the new total (existing + this run's ±step), not the delta. Only
 * called on a real adjustment. RLS scopes the write; throws on error.
 */
export async function setRecalibrationAdjustment(
  userId: string,
  totalKcal: number,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      recalibration_adjustment_kcal: totalKcal,
      recalibrated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
  if (error) throw new Error(`setRecalibrationAdjustment failed: ${error.message}`)
}
