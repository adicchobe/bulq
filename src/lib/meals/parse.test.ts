import { describe, it, expect } from 'vitest'
import { extractParsedMeal } from './parse'

describe('extractParsedMeal', () => {
  it('(a) parses clean JSON', () => {
    const meal = extractParsedMeal(
      '{"items":[{"food_name_raw":"roti","quantity":3,"unit_raw":null},{"food_name_raw":"dal","quantity":1,"unit_raw":"katori"}],"meal_type":"lunch"}',
    )
    expect(meal).toEqual({
      items: [
        { food_name_raw: 'roti', quantity: 3, unit_raw: null },
        { food_name_raw: 'dal', quantity: 1, unit_raw: 'katori' },
      ],
      meal_type: 'lunch',
    })
  })

  it('(b) parses JSON inside ```json fences with surrounding prose', () => {
    const raw =
      'Sure! Here is the structured meal:\n```json\n{"items":[{"food_name_raw":"poha","quantity":1,"unit_raw":"bowl"}],"meal_type":"breakfast"}\n```\nHope that helps.'
    expect(extractParsedMeal(raw)).toEqual({
      items: [{ food_name_raw: 'poha', quantity: 1, unit_raw: 'bowl' }],
      meal_type: 'breakfast',
    })
  })

  it('(c) returns null on malformed JSON', () => {
    expect(extractParsedMeal('{"items":[{"food_name_raw":"roti",,]}')).toBeNull()
    expect(extractParsedMeal('not json at all')).toBeNull()
  })

  it('(d) returns null on schema-invalid input', () => {
    // quantity a string that can't coerce to a positive number
    expect(
      extractParsedMeal(
        '{"items":[{"food_name_raw":"roti","quantity":"abc","unit_raw":null}],"meal_type":"unknown"}',
      ),
    ).toBeNull()
    // missing food_name_raw
    expect(
      extractParsedMeal(
        '{"items":[{"quantity":1,"unit_raw":null}],"meal_type":"unknown"}',
      ),
    ).toBeNull()
  })

  it('(e) accepts a valid empty meal (no food)', () => {
    expect(extractParsedMeal('{"items":[],"meal_type":"unknown"}')).toEqual({
      items: [],
      meal_type: 'unknown',
    })
  })

  it('(f) coerces string-number quantity and applies defaults', () => {
    const meal = extractParsedMeal(
      '{"items":[{"food_name_raw":"milk","quantity":"2","unit_raw":"glass"},{"food_name_raw":"banana"}],"meal_type":"snack"}',
    )
    expect(meal).toEqual({
      items: [
        { food_name_raw: 'milk', quantity: 2, unit_raw: 'glass' }, // "2" → 2
        { food_name_raw: 'banana', quantity: 1, unit_raw: null }, // defaults
      ],
      meal_type: 'snack',
    })
  })
})
