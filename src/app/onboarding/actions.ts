'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { upsertProfile } from '@/lib/db/profiles'
import { OnboardingSchema, type OnboardingInput } from './schema'

export type SaveProfileResult = { ok: false; error: string }

/**
 * Validates onboarding input (Zod), writes the profile for the signed-in user,
 * and redirects home on success. Returns an error result on failure; on success
 * it redirects and never returns normally.
 */
export async function saveProfile(
  raw: OnboardingInput,
): Promise<SaveProfileResult> {
  const parsed = OnboardingSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Some details look off — please check the form.',
    }
  }
  const v = parsed.data

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: 'Your session expired. Please sign in again.' }
  }

  // Ectomorph NEAT adjustment is set server-side, not user-facing:
  // +7% for gain (skinny-individual NEAT compensation), 0 otherwise.
  const ectomorphAdjustmentPct = v.goalDirection === 'gain' ? 7 : 0

  try {
    await upsertProfile(user.id, {
      sex: v.sex,
      age_years: v.ageYears,
      height_cm: v.heightCm,
      current_weight_kg: v.currentWeightKg,
      goal_weight_kg: v.goalWeightKg,
      goal_direction: v.goalDirection,
      goal_rate_pct_per_week: v.goalRatePctPerWeek,
      activity_level: v.activityLevel,
      training_days_per_week: v.trainingDaysPerWeek,
      ectomorph_adjustment_pct: ectomorphAdjustmentPct,
      dietary_pattern: v.dietaryPattern,
      chicken_max_per_week: v.chickenMaxPerWeek,
      sleep_avg_hours: v.sleepAvgHours,
      medical_flags: {},
      kitchen_context: {},
    })
  } catch {
    return { ok: false, error: 'Could not save your profile. Please try again.' }
  }

  redirect('/')
}
