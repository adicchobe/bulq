export {
  calculateBMR,
  calculateTDEE,
  applyEctomorphAdjustment,
  calculateDailyTarget,
  calculateProteinTarget,
  computeNutritionTargets,
  DEFAULT_UNCERTAINTY_BAND_KCAL,
  DEFAULT_SURPLUS_KCAL,
  DEFAULT_DEFICIT_KCAL,
  DEFAULT_PROTEIN_PER_KG,
} from './tdee'

export type {
  Sex,
  ActivityLevel,
  GoalDirection,
  NutritionProfile,
  KcalRange,
  NutritionTargets,
} from './types'
