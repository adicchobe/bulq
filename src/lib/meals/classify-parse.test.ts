import { describe, it, expect } from 'vitest'
import { deriveClassifyParse } from './classify-parse'

describe('deriveClassifyParse (safety derivation)', () => {
  it('valid meal_log JSON with items → meal_log', () => {
    const raw =
      '{"intent":"meal_log","items":[{"food_name_raw":"roti","quantity":3,"unit_raw":null},{"food_name_raw":"dal","quantity":1,"unit_raw":"katori"}],"meal_type":"lunch"}'
    const r = deriveClassifyParse(raw)
    expect(r.intent).toBe('meal_log')
    if (r.intent === 'meal_log') {
      expect(r.meal.items).toHaveLength(2)
      expect(r.meal.items[0].food_name_raw).toBe('roti')
      expect(r.meal.meal_type).toBe('lunch')
    }
  })

  it("intent 'question' → question", () => {
    expect(deriveClassifyParse('{"intent":"question","items":[],"meal_type":"unknown"}')).toEqual({
      intent: 'question',
    })
  })

  it('meal_log with empty items → question (safety)', () => {
    expect(
      deriveClassifyParse('{"intent":"meal_log","items":[],"meal_type":"unknown"}'),
    ).toEqual({ intent: 'question' })
  })

  it('malformed / truncated / empty JSON → question (safety)', () => {
    expect(deriveClassifyParse('{"intent":"meal_log","items":[{"food_name_raw":"roti"')).toEqual({
      intent: 'question',
    })
    expect(deriveClassifyParse('not json at all')).toEqual({ intent: 'question' })
    expect(deriveClassifyParse('')).toEqual({ intent: 'question' })
  })

  it('intent missing → question (safety)', () => {
    expect(
      deriveClassifyParse(
        '{"items":[{"food_name_raw":"roti","quantity":1,"unit_raw":null}],"meal_type":"unknown"}',
      ),
    ).toEqual({ intent: 'question' })
  })

  it('strips markdown fences before parsing', () => {
    const raw =
      '```json\n{"intent":"meal_log","items":[{"food_name_raw":"poha","quantity":1,"unit_raw":"bowl"}],"meal_type":"breakfast"}\n```'
    expect(deriveClassifyParse(raw).intent).toBe('meal_log')
  })
})
