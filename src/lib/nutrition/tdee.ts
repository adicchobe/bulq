import type {
  ActivityLevel,
  GoalDirection,
  NutritionProfile,
  NutritionTargets,
  Sex,
} from './types'

/** Default uncertainty band applied to the daily target (§3, pillar #2). */
export const DEFAULT_UNCERTAINTY_BAND_KCAL = 200

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  moderate_plus: 1.6,
  active: 1.725,
  very_active: 1.9,
}

/**
 * Basal metabolic rate via Mifflin-St Jeor (1990).
 * Male:   (10·w) + (6.25·h) − (5·age) + 5
 * Female: (10·w) + (6.25·h) − (5·age) − 161
 */
export function calculateBMR(input: {
  sex: Sex
  weightKg: number
  heightCm: number
  ageYears: number
}): number {
  const base =
    10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears
  const sexConstant = input.sex === 'male' ? 5 : -161
  return Math.round(base + sexConstant)
}

/** Maintenance TDEE = BMR × activity multiplier. */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel])
}

/**
 * Ectomorph NEAT adjustment. Only applied for `gain` (skinny individuals burn
 * surplus via non-exercise activity thermogenesis); a no-op for lose/maintain.
 */
export function applyEctomorphAdjustment(
  tdee: number,
  adjustmentPct: number,
  goalDirection: GoalDirection,
): number {
  if (goalDirection !== 'gain') return tdee
  return Math.round(tdee * (1 + adjustmentPct / 100))
}

/**
 * Symmetric caloric engine (pillar #9). `deltaKcal` is always positive; the
 * sign comes from direction: gain adds, lose subtracts, maintain is unchanged.
 */
export function calculateDailyTarget(
  adjustedTDEE: number,
  goalDirection: GoalDirection,
  deltaKcal: number,
): number {
  switch (goalDirection) {
    case 'gain':
      return adjustedTDEE + deltaKcal
    case 'lose':
      return adjustedTDEE - deltaKcal
    case 'maintain':
      return adjustedTDEE
  }
}

export function calculateProteinTarget(weightKg: number, gPerKg: number): number {
  return Math.round(weightKg * gPerKg)
}

/**
 * Composite: full profile → structured targets with an uncertainty band
 * (pillar #2 — surface ranges, never false precision).
 */
export function computeNutritionTargets(
  profile: NutritionProfile,
  uncertaintyBandKcal: number = DEFAULT_UNCERTAINTY_BAND_KCAL,
): NutritionTargets {
  const bmr = calculateBMR({
    sex: profile.sex,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    ageYears: profile.ageYears,
  })

  const maintenanceTDEE = calculateTDEE(bmr, profile.activityLevel)

  const adjustedTDEE = applyEctomorphAdjustment(
    maintenanceTDEE,
    profile.ectomorphAdjustmentPct,
    profile.goalDirection,
  )

  const dailyTargetKcal = calculateDailyTarget(
    adjustedTDEE,
    profile.goalDirection,
    profile.deltaKcal,
  )

  const proteinTargetG = calculateProteinTarget(
    profile.weightKg,
    profile.proteinPerKg,
  )

  return {
    bmr,
    maintenanceTDEE,
    adjustedTDEE,
    dailyTargetKcal,
    dailyTargetRangeKcal: {
      low: dailyTargetKcal - uncertaintyBandKcal,
      high: dailyTargetKcal + uncertaintyBandKcal,
    },
    proteinTargetG,
  }
}
