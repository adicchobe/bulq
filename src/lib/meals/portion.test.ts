import { describe, it, expect } from 'vitest'
import { resolveGrams, computeItemMacros, buildMealItem } from './portion'
import type { FoodRow } from '@/lib/db/foods'
import type { UnitRow } from '@/lib/db/units'
import type { ParsedItem } from './types'

// ---- fixtures -------------------------------------------------------------
function food(over: Partial<FoodRow> & Pick<FoodRow, 'name' | 'category'>): FoodRow {
  return {
    id: `id-${over.name}`,
    user_id: null,
    aliases: [],
    state: 'cooked',
    variance_class: 'cooked_single',
    kcal_typical: 0,
    kcal_min: 0,
    kcal_max: 0,
    protein_g: 0,
    fat_g: 0,
    carb_g: 0,
    fiber_g: 0,
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

const parsed = (
  food_name_raw: string,
  quantity: number,
  unit_raw: string | null,
): ParsedItem => ({ food_name_raw, quantity, unit_raw })

const ROTI = food({
  name: 'Chapati / roti (whole wheat)', category: 'grain',
  kcal_min: 252, kcal_typical: 297, kcal_max: 356, protein_g: 7.9,
})
const TOOR_DAL = food({
  name: 'Toor dal (cooked)', category: 'dal_legume',
  kcal_min: 100, kcal_typical: 115, kcal_max: 145, protein_g: 7.5,
})
const WHEY = food({
  name: 'Whey protein (concentrate)', category: 'supplement',
  kcal_min: 360, kcal_typical: 400, kcal_max: 440, protein_g: 80,
})
const EGG = food({
  name: 'Boiled egg (whole)', category: 'non_veg',
  kcal_min: 139, kcal_typical: 155, kcal_max: 186, protein_g: 12.6,
})
const CHICKEN = food({
  name: 'Chicken breast (cooked)', category: 'non_veg',
  kcal_min: 148, kcal_typical: 165, kcal_max: 198, protein_g: 31,
})

const UNITS: UnitRow[] = [
  unit({ unit_key: 'chapati', grams_min: 30, grams_typical: 40, grams_max: 50 }),
  unit({ unit_key: 'katori_dal', grams_min: 120, grams_typical: 150, grams_max: 180 }),
  unit({ unit_key: 'scoop_whey', grams_min: 28, grams_typical: 30, grams_max: 35 }),
  unit({ unit_key: 'egg_large', grams_min: 45, grams_typical: 50, grams_max: 60 }),
]

// ---- resolveGrams (PER-UNIT, no ×qty) -------------------------------------
describe('resolveGrams', () => {
  it('katori + dal → katori_dal range', () => {
    expect(resolveGrams(parsed('dal', 1, 'katori'), TOOR_DAL, UNITS)).toEqual({
      unit_key: 'katori_dal', grams_min: 120, grams_typical: 150, grams_max: 180,
    })
  })
  it('scoop + whey → scoop_whey range', () => {
    expect(resolveGrams(parsed('whey', 1, 'scoop'), WHEY, UNITS)).toEqual({
      unit_key: 'scoop_whey', grams_min: 28, grams_typical: 30, grams_max: 35,
    })
  })
  it('null unit + egg → egg_large range', () => {
    expect(resolveGrams(parsed('egg', 2, null), EGG, UNITS)).toEqual({
      unit_key: 'egg_large', grams_min: 45, grams_typical: 50, grams_max: 60,
    })
  })
  it('unresolved (chicken, no unit) → fallback unit_key null, 100g (50–200)', () => {
    expect(resolveGrams(parsed('chicken', 1, null), CHICKEN, UNITS)).toEqual({
      unit_key: null, grams_min: 50, grams_typical: 100, grams_max: 200,
    })
  })
})

// ---- computeItemMacros (hand-calc verified) -------------------------------
describe('computeItemMacros', () => {
  it('3 rotis → kcal 227/356/534, protein 9.5', () => {
    const m = computeItemMacros(ROTI, { grams_min: 30, grams_typical: 40, grams_max: 50 }, 3)
    expect(m.kcal_min).toBe(227) // 252 × 30 × 3/100
    expect(m.kcal_typical).toBe(356) // 297 × 40 × 3/100
    expect(m.kcal_max).toBe(534) // 356 × 50 × 3/100
    expect(m.protein_g).toBe(9.5) // 7.9 × 40 × 3/100
  })
  it('2 boiled eggs → kcal 125/155/223', () => {
    const m = computeItemMacros(EGG, { grams_min: 45, grams_typical: 50, grams_max: 60 }, 2)
    expect(m.kcal_min).toBe(125)
    expect(m.kcal_typical).toBe(155)
    expect(m.kcal_max).toBe(223)
  })
  it('1 scoop whey → kcal 101/120/154, protein 24', () => {
    const m = computeItemMacros(WHEY, { grams_min: 28, grams_typical: 30, grams_max: 35 }, 1)
    expect(m.kcal_min).toBe(101)
    expect(m.kcal_typical).toBe(120)
    expect(m.kcal_max).toBe(154)
    expect(m.protein_g).toBe(24)
  })

  it('GUARD: quantity is applied EXACTLY once (qty 3 → 3×, not 9×)', () => {
    const linear = food({
      name: 'linear', category: 'grain',
      kcal_min: 100, kcal_typical: 100, kcal_max: 100,
    })
    const range = { grams_min: 100, grams_typical: 100, grams_max: 100 }
    expect(computeItemMacros(linear, range, 1).kcal_typical).toBe(100)
    expect(computeItemMacros(linear, range, 3).kcal_typical).toBe(300) // 3×
    expect(computeItemMacros(linear, range, 3).kcal_typical).not.toBe(900) // NOT qty²
  })
})

// ---- buildMealItem --------------------------------------------------------
describe('buildMealItem', () => {
  it('matched food → full item (grams_used = grams_typical × qty)', () => {
    const item = buildMealItem(parsed('dal', 1, 'katori'), { food: TOOR_DAL, method: 'alias' }, UNITS)
    expect(item.food_id).toBe(TOOR_DAL.id)
    expect(item.matched_food_name).toBe('Toor dal (cooked)')
    expect(item.match_method).toBe('alias')
    expect(item.unit_key).toBe('katori_dal')
    expect(item.grams_used).toBe(150) // 150 × 1
    expect(item.kcal_typical).toBe(173) // 115 × 150 × 1/100 = 172.5 → 173
  })

  it('unknown food → food_id null, match_method unknown, all macros null', () => {
    const item = buildMealItem(parsed('pizza', 1, null), { food: null, method: 'unknown' }, UNITS)
    expect(item.food_id).toBeNull()
    expect(item.match_method).toBe('unknown')
    expect(item.grams_used).toBeNull()
    expect(item.kcal_min).toBeNull()
    expect(item.kcal_typical).toBeNull()
    expect(item.kcal_max).toBeNull()
    expect(item.protein_g).toBeNull()
  })
})
