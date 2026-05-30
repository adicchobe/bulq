import { describe, it, expect } from 'vitest'
import {
  computeCostUsd,
  ANTHROPIC_BUDGET_USD,
  BUDGET_HARD_STOP_USD,
} from './pricing'

describe('computeCostUsd', () => {
  it('Haiku: 1000 in + 1000 out = $0.006 (1.00 + 5.00 per M)', () => {
    const { costUsd, rateKnown } = computeCostUsd('claude-haiku-4-5-20251001', 1000, 1000)
    expect(rateKnown).toBe(true)
    expect(costUsd).toBeCloseTo(0.006, 10) // 1000*1/1e6 + 1000*5/1e6
  })

  it('Sonnet: 1000 in + 1000 out = $0.018 (3.00 + 15.00 per M)', () => {
    const { costUsd, rateKnown } = computeCostUsd('claude-sonnet-4-6', 1000, 1000)
    expect(rateKnown).toBe(true)
    expect(costUsd).toBeCloseTo(0.018, 10)
  })

  it('Gemini is free: $0 regardless of tokens', () => {
    const { costUsd, rateKnown } = computeCostUsd('gemini-2.5-flash', 10_000, 10_000)
    expect(rateKnown).toBe(true)
    expect(costUsd).toBe(0)
  })

  it('unknown model: rateKnown false, cost 0 (never guesses)', () => {
    const { costUsd, rateKnown } = computeCostUsd('some-future-model', 1000, 1000)
    expect(rateKnown).toBe(false)
    expect(costUsd).toBe(0)
  })

  it('null/NaN token counts are treated as 0 safely', () => {
    // @ts-expect-error — exercising runtime safety against bad inputs
    const a = computeCostUsd('claude-haiku-4-5-20251001', null, undefined)
    expect(a.costUsd).toBe(0)
    const b = computeCostUsd('claude-haiku-4-5-20251001', NaN, 1000)
    expect(b.costUsd).toBeCloseTo(0.005, 10) // only completion counts
  })
})

describe('budget constants', () => {
  it('hard-stop is 95% of the $4.51 balance', () => {
    expect(ANTHROPIC_BUDGET_USD).toBe(4.51)
    expect(BUDGET_HARD_STOP_USD).toBeCloseTo(4.2845, 10)
  })
})
