import { describe, it, expect } from 'vitest'
import { istDayRangeUtc, computeTodaySummary } from './summary'
import type { MealRow } from '@/lib/db/meals'

describe('istDayRangeUtc', () => {
  // IST midnight = 18:30 UTC the previous day. The IST-day boundary sits at 18:30 UTC.
  it('just after IST midnight (00:01 IST May 30 = 18:31 UTC May 29) → IST-day May 30', () => {
    const { startUtc, endUtc } = istDayRangeUtc(new Date('2026-05-29T18:31:00.000Z'))
    expect(startUtc.toISOString()).toBe('2026-05-29T18:30:00.000Z')
    expect(endUtc.toISOString()).toBe('2026-05-30T18:30:00.000Z')
  })

  it('just before IST midnight (23:59 IST May 29 = 18:29 UTC May 29) → IST-day May 29', () => {
    const { startUtc, endUtc } = istDayRangeUtc(new Date('2026-05-29T18:29:00.000Z'))
    expect(startUtc.toISOString()).toBe('2026-05-28T18:30:00.000Z')
    expect(endUtc.toISOString()).toBe('2026-05-29T18:30:00.000Z')
  })

  it('midday IST (11:30 IST May 30 = 06:00 UTC May 30) → same IST-day window, now inside it', () => {
    const now = new Date('2026-05-30T06:00:00.000Z')
    const { startUtc, endUtc } = istDayRangeUtc(now)
    expect(startUtc.toISOString()).toBe('2026-05-29T18:30:00.000Z')
    expect(endUtc.toISOString()).toBe('2026-05-30T18:30:00.000Z')
    expect(now.getTime()).toBeGreaterThanOrEqual(startUtc.getTime())
    expect(now.getTime()).toBeLessThan(endUtc.getTime())
  })
})

describe('computeTodaySummary', () => {
  const meal = (over: Partial<MealRow>): MealRow => ({
    id: 'm',
    user_id: 'u',
    logged_at: '',
    raw_text: null,
    meal_type: null,
    note: null,
    kcal_min: 0,
    kcal_typical: 0,
    kcal_max: 0,
    protein_g: 0,
    fat_g: 0,
    carb_g: 0,
    fiber_g: 0,
    confidence: null,
    status: 'confirmed',
    created_at: '',
    updated_at: '',
    ...over,
  })

  const target = { kcal: 2936, protein_g: 97 }

  it('sums the consumed band and computes remaining vs typical', () => {
    const meals = [
      meal({ kcal_min: 347, kcal_typical: 529, kcal_max: 795, protein_g: 21 }),
      meal({ kcal_min: 120, kcal_typical: 173, kcal_max: 261, protein_g: 11 }),
    ]
    const s = computeTodaySummary(meals, target)
    expect(s.consumed).toEqual({ kcal_min: 467, kcal_typical: 702, kcal_max: 1056, protein_g: 32 })
    expect(s.remaining).toEqual({ kcal_typical: 2936 - 702, protein_g: 97 - 32 }) // 2234, 65
    expect(s.mealCount).toBe(2)
    expect(s.target).toEqual(target)
  })

  it('empty day → zero consumed, remaining = full target', () => {
    const s = computeTodaySummary([], target)
    expect(s.consumed).toEqual({ kcal_min: 0, kcal_typical: 0, kcal_max: 0, protein_g: 0 })
    expect(s.remaining).toEqual({ kcal_typical: 2936, protein_g: 97 })
    expect(s.mealCount).toBe(0)
  })

  it('null meal totals count as 0 (conservative)', () => {
    const meals = [meal({ kcal_typical: null, protein_g: null })]
    const s = computeTodaySummary(meals, target)
    expect(s.consumed.kcal_typical).toBe(0)
    expect(s.consumed.protein_g).toBe(0)
  })
})
