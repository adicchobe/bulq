export type Sex = 'male' | 'female'

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'moderate_plus'
  | 'active'
  | 'very_active'

export type GoalDirection = 'gain' | 'lose' | 'maintain'

/**
 * Full input for the TDEE engine. `deltaKcal` is the surplus/deficit magnitude
 * and is ALWAYS positive — the engine applies the sign from `goalDirection`
 * (pillar #9: symmetric caloric engine).
 *
 * The §3 primary user uses `moderate_plus` (1.6), a standard step that sits
 * between `moderate` (1.55) and `active` (1.725) — no per-user overrides.
 */
export interface NutritionProfile {
  sex: Sex
  ageYears: number
  heightCm: number
  weightKg: number
  activityLevel: ActivityLevel
  goalDirection: GoalDirection
  ectomorphAdjustmentPct: number
  deltaKcal: number
  proteinPerKg: number
}

export interface KcalRange {
  low: number
  high: number
}

export interface NutritionTargets {
  bmr: number
  maintenanceTDEE: number
  adjustedTDEE: number
  dailyTargetKcal: number
  dailyTargetRangeKcal: KcalRange
  proteinTargetG: number
}
