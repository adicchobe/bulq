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

  it('(d) returns null when items is structurally invalid (missing / not an array)', () => {
    // NOTE: a BAD ITEM inside a valid items array is no longer fatal — it is
    // dropped (see the "tolerant items array" block below). Only a structurally
    // invalid items field still fails the whole parse.
    // items field absent
    expect(extractParsedMeal('{"meal_type":"unknown"}')).toBeNull()
    // items present but not an array
    expect(extractParsedMeal('{"items":42,"meal_type":"unknown"}')).toBeNull()
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

describe('extractParsedMeal — tolerant items array (drop bad, keep good)', () => {
  it('one valid + one invalid (empty food_name_raw) → keeps only the valid one', () => {
    const meal = extractParsedMeal(
      '{"items":[{"food_name_raw":"roti","quantity":3,"unit_raw":null},{"food_name_raw":"","quantity":1,"unit_raw":null}],"meal_type":"lunch"}',
    )
    expect(meal?.items).toEqual([{ food_name_raw: 'roti', quantity: 3, unit_raw: null }])
  })

  it('two valid + one invalid (quantity 0) → keeps both valid', () => {
    const meal = extractParsedMeal(
      '{"items":[{"food_name_raw":"roti","quantity":2,"unit_raw":null},{"food_name_raw":"paneer","quantity":0,"unit_raw":null},{"food_name_raw":"dal","quantity":1,"unit_raw":"katori"}],"meal_type":"dinner"}',
    )
    expect(meal?.items).toEqual([
      { food_name_raw: 'roti', quantity: 2, unit_raw: null },
      { food_name_raw: 'dal', quantity: 1, unit_raw: 'katori' },
    ])
  })

  it('all items invalid → items: [] (downstream empty-guards then fire)', () => {
    const meal = extractParsedMeal(
      '{"items":[{"food_name_raw":"","quantity":1,"unit_raw":null},{"food_name_raw":"x","quantity":-2,"unit_raw":null}],"meal_type":"unknown"}',
    )
    expect(meal?.items).toEqual([])
  })

  it('all valid → unchanged (tolerance did not break the normal case)', () => {
    const meal = extractParsedMeal(
      '{"items":[{"food_name_raw":"roti","quantity":3,"unit_raw":null},{"food_name_raw":"dal","quantity":1,"unit_raw":"katori"}],"meal_type":"lunch"}',
    )
    expect(meal?.items).toHaveLength(2)
    expect(meal?.items[0].food_name_raw).toBe('roti')
    expect(meal?.items[1].food_name_raw).toBe('dal')
  })

  it('non-array items → parse fails (null), same as before', () => {
    expect(extractParsedMeal('{"items":"notarray","meal_type":"lunch"}')).toBeNull()
  })
})
