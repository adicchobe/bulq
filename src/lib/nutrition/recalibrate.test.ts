import { describe, it, expect } from 'vitest'
import { recalibrateTdee, type RecalibrateInput } from './recalibrate'

// Baseline gainer: TDEE 2500, +300 surplus, expecting ~0.3 kg/week.
const gain = (actualRateKgPerWeek: number): RecalibrateInput => ({
  currentTdee: 2500,
  surplusKcal: 300,
  expectedRateKgPerWeek: 0.3,
  actualRateKgPerWeek,
  goalDirection: 'gain',
})

describe('recalibrateTdee (gain)', () => {
  it('not enough change (< 50% of expected) → +200 kcal', () => {
    const r = recalibrateTdee(gain(0.1)) // ratio 0.33
    expect(r.adjustmentKcal).toBe(200)
    expect(r.adjustedTdee).toBe(2700)
    expect(r.reason).toMatch(/slower than expected/)
  })

  it('too much change (> 150% of expected) → -200 kcal', () => {
    const r = recalibrateTdee(gain(0.5)) // ratio 1.67
    expect(r.adjustmentKcal).toBe(-200)
    expect(r.adjustedTdee).toBe(2300)
    expect(r.reason).toMatch(/faster than expected/)
  })

  it('on track (between 50% and 150%) → no change', () => {
    const r = recalibrateTdee(gain(0.3)) // ratio 1.0
    expect(r.adjustmentKcal).toBe(0)
    expect(r.adjustedTdee).toBe(2500)
    expect(r.reason).toMatch(/no change/)
  })

  it('edge: exactly 50% → no change (strict <)', () => {
    expect(recalibrateTdee(gain(0.15)).adjustmentKcal).toBe(0) // ratio exactly 0.5
  })

  it('edge: exactly 150% → no change (strict >)', () => {
    expect(recalibrateTdee(gain(0.45)).adjustmentKcal).toBe(0) // ratio exactly 1.5
  })

  it('wrong direction (losing while goal is gain) → +200 (extreme under)', () => {
    const r = recalibrateTdee(gain(-0.2)) // negative ratio < 0.5
    expect(r.adjustmentKcal).toBe(200)
  })

  it('zero expected rate → no change (guard, no fabrication)', () => {
    const r = recalibrateTdee({ ...gain(0.3), expectedRateKgPerWeek: 0 })
    expect(r.adjustmentKcal).toBe(0)
  })
})

describe('recalibrateTdee (loss, symmetric)', () => {
  // Dieter: TDEE 2500, expecting −0.5 kg/week.
  const loss = (actualRateKgPerWeek: number): RecalibrateInput => ({
    currentTdee: 2500,
    surplusKcal: 400,
    expectedRateKgPerWeek: -0.5,
    actualRateKgPerWeek,
    goalDirection: 'loss',
  })

  it('losing too slowly (< 50%) → eats less (−200)', () => {
    const r = recalibrateTdee(loss(-0.1)) // ratio 0.2
    expect(r.adjustmentKcal).toBe(-200)
    expect(r.reason).toMatch(/slower than expected/)
  })

  it('losing too fast (> 150%) → eats more (+200)', () => {
    const r = recalibrateTdee(loss(-0.9)) // ratio 1.8
    expect(r.adjustmentKcal).toBe(200)
    expect(r.reason).toMatch(/faster than expected/)
  })

  it('on track → no change', () => {
    expect(recalibrateTdee(loss(-0.5)).adjustmentKcal).toBe(0)
  })
})
