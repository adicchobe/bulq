/**
 * TDEE recalibration from real weight trend (Sprint 4.3, brief §15). PURE.
 *
 * The formula is the opening guess; the scale is the proof. When the actual rate
 * of weight change diverges far enough from what the chosen surplus/deficit
 * predicted, the maintenance-TDEE estimate was off — nudge it so the eating
 * target moves toward the goal. Symmetric across gain/loss (pillar #9).
 */

/** Below 50% / above 150% of the expected rate triggers a ±step adjustment. */
const UNDER_FRACTION = 0.5
const OVER_FRACTION = 1.5
/** Conservative single-step nudge (kcal); recalibrate again next window. */
const ADJUSTMENT_STEP_KCAL = 200

export interface RecalibrateInput {
  currentTdee: number
  surplusKcal: number
  expectedRateKgPerWeek: number // from the surplus/deficit math (signed: + gain, − loss)
  actualRateKgPerWeek: number // from trend analysis
  goalDirection: 'gain' | 'loss'
}

export interface RecalibrateResult {
  adjustedTdee: number
  adjustmentKcal: number
  reason: string
}

/**
 * Compare actual vs expected weekly rate and decide a TDEE nudge:
 * - actual < 50% of expected  → under-responding → step the target TOWARD the goal
 * - actual > 150% of expected → over-responding  → step the target AWAY from the goal
 * - otherwise                 → on track, no change
 *
 * Direction of the nudge is goal-aware so it always pushes toward the goal: a
 * gainer who's gaining too slowly eats MORE (+TDEE); a dieter losing too slowly
 * eats LESS (−TDEE). The expected rate is signed (+ for gain, − for loss).
 */
export function recalibrateTdee(input: RecalibrateInput): RecalibrateResult {
  const { currentTdee, expectedRateKgPerWeek, actualRateKgPerWeek, goalDirection } = input

  // Guard: no meaningful expectation to compare against → never fabricate a change.
  if (!Number.isFinite(expectedRateKgPerWeek) || expectedRateKgPerWeek === 0) {
    return { adjustedTdee: currentTdee, adjustmentKcal: 0, reason: 'On track — no change needed.' }
  }

  // Signed ratio: 1.0 = exactly as expected. Works for both directions because
  // expected carries the sign (gain +, loss −), so a same-direction actual is +.
  const ratio = actualRateKgPerWeek / expectedRateKgPerWeek
  const verb = goalDirection === 'gain' ? 'gaining' : 'losing'

  if (ratio < UNDER_FRACTION) {
    // Under-responding → push toward the goal: gain eats more, loss eats less.
    const adjustmentKcal = goalDirection === 'gain' ? ADJUSTMENT_STEP_KCAL : -ADJUSTMENT_STEP_KCAL
    return {
      adjustedTdee: currentTdee + adjustmentKcal,
      adjustmentKcal,
      reason: `You're ${verb} slower than expected — adjusting by ${signed(adjustmentKcal)} kcal.`,
    }
  }

  if (ratio > OVER_FRACTION) {
    // Over-responding → ease back: gain eats less, loss eats more.
    const adjustmentKcal = goalDirection === 'gain' ? -ADJUSTMENT_STEP_KCAL : ADJUSTMENT_STEP_KCAL
    return {
      adjustedTdee: currentTdee + adjustmentKcal,
      adjustmentKcal,
      reason: `You're ${verb} faster than expected — adjusting by ${signed(adjustmentKcal)} kcal.`,
    }
  }

  return { adjustedTdee: currentTdee, adjustmentKcal: 0, reason: 'On track — no change needed.' }
}

const signed = (n: number): string => (n >= 0 ? `+${n}` : `${n}`)
