import { describe, it, expect } from 'vitest'
import {
  calculateBMR,
  calculateTDEE,
  applyEctomorphAdjustment,
  calculateDailyTarget,
  calculateProteinTarget,
  computeNutritionTargets,
} from './tdee'
import type { NutritionProfile } from './types'

/** Primary user, §3. `moderate_plus` (1.6) is his documented activity level. */
const PRIMARY_USER: NutritionProfile = {
  sex: 'male',
  ageYears: 26,
  heightCm: 180,
  weightKg: 54,
  activityLevel: 'moderate_plus',
  goalDirection: 'gain',
  ectomorphAdjustmentPct: 7,
  deltaKcal: 300,
  proteinPerKg: 1.8,
}

// Small tolerance: the brief rounds (~2640, ~2940) while the engine keeps
// integer kcal; a few kcal of rounding drift is expected and acceptable.
const TOL = 15
const near = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(TOL)

describe('calculateBMR (Mifflin-St Jeor)', () => {
  it('matches the §3 primary user BMR (~1540)', () => {
    near(
      calculateBMR({ sex: 'male', weightKg: 54, heightCm: 180, ageYears: 26 }),
      1540,
    )
  })

  it('female variant uses the -161 constant (166 below the male value)', () => {
    const args = {
      weightKg: 54,
      heightCm: 180,
      ageYears: 26,
    } as const
    const male = calculateBMR({ sex: 'male', ...args })
    const female = calculateBMR({ sex: 'female', ...args })
    expect(female).toBe(male - 166) // (+5) − (−161) = 166
    expect(female).toBe(1374)
  })
})

describe('calculateDailyTarget — symmetry (pillar #9)', () => {
  it('gain adds, lose subtracts, by the same magnitude', () => {
    const maintenance = 2464
    const delta = 400
    expect(calculateDailyTarget(maintenance, 'gain', delta)).toBe(2864)
    expect(calculateDailyTarget(maintenance, 'lose', delta)).toBe(2064)
  })

  it('maintain returns adjustedTDEE EXACTLY, regardless of delta', () => {
    expect(calculateDailyTarget(2636, 'maintain', 300)).toBe(2636)
    expect(calculateDailyTarget(2636, 'maintain', 0)).toBe(2636)
  })
})

describe('applyEctomorphAdjustment', () => {
  it('applies the surplus only for gain', () => {
    expect(applyEctomorphAdjustment(2464, 7, 'gain')).toBe(2636) // 2464 * 1.07
  })

  it('is a no-op for lose and maintain', () => {
    expect(applyEctomorphAdjustment(2464, 7, 'lose')).toBe(2464)
    expect(applyEctomorphAdjustment(2464, 7, 'maintain')).toBe(2464)
  })
})

describe('computeNutritionTargets — §3 primary user end-to-end', () => {
  const t = computeNutritionTargets(PRIMARY_USER)

  it('BMR ~1540', () => near(t.bmr, 1540))
  it('maintenance TDEE ~2464 (moderate_plus, 1.6)', () => near(t.maintenanceTDEE, 2464))
  it('ectomorph-adjusted maintenance ~2640', () => near(t.adjustedTDEE, 2640))
  it('daily target ~2940', () => near(t.dailyTargetKcal, 2940))

  it('daily target range ~2740–3140 (±200 band)', () => {
    near(t.dailyTargetRangeKcal.low, 2740)
    near(t.dailyTargetRangeKcal.high, 3140)
    expect(t.dailyTargetRangeKcal.high - t.dailyTargetRangeKcal.low).toBe(400)
  })

  it('protein target ~97 g (1.8 g/kg)', () => near(t.proteinTargetG, 97))
})

describe('computeNutritionTargets — symmetry: same body, goal = lose', () => {
  const loseUser: NutritionProfile = {
    ...PRIMARY_USER,
    goalDirection: 'lose',
    deltaKcal: 400,
  }
  const t = computeNutritionTargets(loseUser)

  it('target is BELOW maintenance', () => {
    expect(t.dailyTargetKcal).toBeLessThan(t.maintenanceTDEE)
    expect(t.dailyTargetKcal).toBe(2464 - 400) // 2064
  })

  it('NO ectomorph adjustment is applied (adjusted === maintenance)', () => {
    expect(t.adjustedTDEE).toBe(t.maintenanceTDEE)
  })
})

describe('calculateTDEE — discrete enum multipliers', () => {
  it('maps each activity level to its multiplier', () => {
    expect(calculateTDEE(1540, 'sedentary')).toBe(Math.round(1540 * 1.2))
    expect(calculateTDEE(1540, 'moderate')).toBe(Math.round(1540 * 1.55))
    expect(calculateTDEE(1540, 'very_active')).toBe(Math.round(1540 * 1.9))
  })
})

describe('calculateProteinTarget', () => {
  it('rounds weight × g/kg', () => {
    expect(calculateProteinTarget(54, 1.8)).toBe(97)
  })
})
