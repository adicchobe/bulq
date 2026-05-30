import { describe, it, expect } from 'vitest'
import { computeMealTotals, type MealItemInput } from './meals'

/** A fully-resolved item; macro overrides merge in. Non-macro fields are dummies. */
function item(macros: Partial<MealItemInput>): MealItemInput {
  return {
    food_id: 'f',
    food_name_raw: 'x',
    matched_food_name: 'X',
    quantity: 1,
    unit_key: null,
    grams_used: 100,
    match_method: 'exact',
    kcal_min: 0,
    kcal_typical: 0,
    kcal_max: 0,
    protein_g: 0,
    fat_g: 0,
    carb_g: 0,
    fiber_g: 0,
    ...macros,
  }
}

describe('computeMealTotals', () => {
  it('sums field-wise across fully-macro’d items (incl. the kcal band)', () => {
    const totals = computeMealTotals([
      item({ kcal_min: 100, kcal_typical: 120, kcal_max: 150, protein_g: 10, fat_g: 5, carb_g: 15, fiber_g: 2 }),
      item({ kcal_min: 200, kcal_typical: 240, kcal_max: 300, protein_g: 20, fat_g: 8, carb_g: 30, fiber_g: 4 }),
    ])
    expect(totals).toEqual({
      kcal_min: 300,
      kcal_typical: 360,
      kcal_max: 450,
      protein_g: 30,
      fat_g: 13,
      carb_g: 45,
      fiber_g: 6,
    })
  })

  it('treats a null-macro (unknown) item as 0 — sums only the rest (conservative lower bound)', () => {
    const totals = computeMealTotals([
      item({ kcal_min: 100, kcal_typical: 120, kcal_max: 150, protein_g: 10, fat_g: 5, carb_g: 15, fiber_g: 2 }),
      item({
        kcal_min: null, kcal_typical: null, kcal_max: null,
        protein_g: null, fat_g: null, carb_g: null, fiber_g: null,
      }),
    ])
    expect(totals).toEqual({
      kcal_min: 100,
      kcal_typical: 120,
      kcal_max: 150,
      protein_g: 10,
      fat_g: 5,
      carb_g: 15,
      fiber_g: 2,
    })
  })

  it('returns all zeros for an empty meal', () => {
    expect(computeMealTotals([])).toEqual({
      kcal_min: 0,
      kcal_typical: 0,
      kcal_max: 0,
      protein_g: 0,
      fat_g: 0,
      carb_g: 0,
      fiber_g: 0,
    })
  })
})
