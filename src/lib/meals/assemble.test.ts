import { describe, it, expect } from 'vitest'
import {
  computeItemConfidence,
  worstConfidence,
  assembleMealItems,
} from './assemble'
import { computeMealTotals } from '@/lib/db/meals'
import type { FoodRow } from '@/lib/db/foods'
import type { UnitRow } from '@/lib/db/units'
import type { MealItemInput } from '@/lib/db/meals'
import type { FoodMatch } from './match'
import type { ParsedMeal } from './types'

function food(
  over: Partial<FoodRow> & Pick<FoodRow, 'name' | 'category' | 'variance_class'>,
): FoodRow {
  return {
    id: `id-${over.name}`,
    user_id: null,
    aliases: [],
    state: 'cooked',
    kcal_typical: 100,
    kcal_min: 90,
    kcal_max: 110,
    protein_g: 1,
    fat_g: 1,
    carb_g: 1,
    fiber_g: 1,
    source_type: 'derived',
    source_ref: null,
    notes: null,
    created_at: '',
    updated_at: '',
    ...over,
  }
}

function unit(over: Partial<UnitRow> & Pick<UnitRow, 'unit_key'>): UnitRow {
  return {
    id: `u-${over.unit_key}`,
    user_id: null,
    label: over.unit_key,
    grams_typical: 100,
    grams_min: 100,
    grams_max: 100,
    source_ref: null,
    notes: null,
    created_at: '',
    ...over,
  }
}

const item = (unit_key: string | null): MealItemInput => ({
  food_id: 'f',
  food_name_raw: 'x',
  matched_food_name: 'X',
  quantity: 1,
  unit_key,
  grams_used: 100,
  match_method: 'exact',
  kcal_min: 1,
  kcal_typical: 1,
  kcal_max: 1,
  protein_g: 1,
  fat_g: 1,
  carb_g: 1,
  fiber_g: 1,
})

describe('computeItemConfidence', () => {
  it('exact + raw_ingredient + resolved portion → high', () => {
    const fm: FoodMatch = {
      food: food({ name: 'Paneer', category: 'dairy_paneer', variance_class: 'raw_ingredient' }),
      method: 'exact',
    }
    expect(computeItemConfidence(fm, item('paneer_serving'))).toBe('high')
  })

  it('fuzzy + composite → medium', () => {
    const fm: FoodMatch = {
      food: food({ name: 'Rajma curry', category: 'dal_legume', variance_class: 'composite' }),
      method: 'fuzzy',
    }
    expect(computeItemConfidence(fm, item('katori_gravy'))).toBe('medium')
  })

  it('unknown → low', () => {
    const fm: FoodMatch = { food: null, method: 'unknown' }
    expect(computeItemConfidence(fm, item(null))).toBe('low')
  })

  it('matched but portion fallback (unit_key null) → capped at medium', () => {
    const fm: FoodMatch = {
      food: food({ name: 'Chicken', category: 'non_veg', variance_class: 'cooked_single' }),
      method: 'exact',
    }
    expect(computeItemConfidence(fm, item(null))).toBe('medium')
  })
})

describe('worstConfidence', () => {
  it('[high,high,medium] → medium', () => {
    expect(worstConfidence(['high', 'high', 'medium'])).toBe('medium')
  })
  it('[high,low] → low', () => {
    expect(worstConfidence(['high', 'low'])).toBe('low')
  })
  it('[] → low (defensive)', () => {
    expect(worstConfidence([])).toBe('low')
  })
})

describe('assembleMealItems', () => {
  const PANEER = food({
    name: 'Paneer',
    category: 'dairy_paneer',
    variance_class: 'raw_ingredient',
    kcal_min: 250,
    kcal_typical: 280,
    kcal_max: 320,
    protein_g: 18,
  })
  const FOODS = [PANEER]
  const UNITS = [unit({ unit_key: 'paneer_serving', grams_min: 30, grams_typical: 50, grams_max: 80 })]
  const meal: ParsedMeal = {
    items: [
      { food_name_raw: 'paneer', quantity: 1, unit_raw: null },
      { food_name_raw: 'pizza', quantity: 1, unit_raw: null },
    ],
    meal_type: 'lunch',
  }

  it('exact-high + unknown-low → confidences [high, low], meal low, totals reflect only matched', () => {
    const res = assembleMealItems(meal, FOODS, UNITS)

    expect(res.items).toHaveLength(2)
    expect(res.items[0].match_method).toBe('exact')
    expect(res.items[1].match_method).toBe('unknown')
    expect(res.items[1].kcal_typical).toBeNull() // unknown → no fabricated macros

    expect(res.itemConfidences).toEqual(['high', 'low'])
    expect(res.confidence).toBe('low') // worst-item rule

    // unknown item contributes 0 → total equals the matched item's value
    const totals = computeMealTotals(res.items)
    expect(totals.kcal_typical).toBe(res.items[0].kcal_typical)
  })
})
