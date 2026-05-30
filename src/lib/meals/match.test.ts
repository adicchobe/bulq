import { describe, it, expect } from 'vitest'
import { matchFood, normalizeFoodName } from './match'
import type { FoodRow } from '@/lib/db/foods'

/** Build a full FoodRow fixture; only name/aliases matter for matching. */
function food(over: Partial<FoodRow> & Pick<FoodRow, 'name'>): FoodRow {
  return {
    id: `id-${over.name}`,
    user_id: null,
    aliases: [],
    category: 'grain',
    state: 'cooked',
    variance_class: 'cooked_single',
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

const FOODS: FoodRow[] = [
  food({ name: 'Chapati / roti', aliases: ['roti', 'phulka'] }),
  food({ name: 'Toor dal (cooked)', aliases: ['dal', 'tur dal'] }),
  food({ name: 'Paneer', aliases: ['cottage cheese'] }),
]

describe('matchFood', () => {
  it('(a) exact normalized name → exact', () => {
    const m = matchFood('Paneer', FOODS)
    expect(m.method).toBe('exact')
    expect(m.food?.name).toBe('Paneer')
  })

  it('(b) alias → alias', () => {
    const m = matchFood('roti', FOODS)
    expect(m.method).toBe('alias')
    expect(m.food?.name).toBe('Chapati / roti')
  })

  it('(c) close variant above threshold → fuzzy to the right food', () => {
    const m = matchFood('paneeer', FOODS) // one extra letter vs "paneer"
    expect(m.method).toBe('fuzzy')
    expect(m.food?.name).toBe('Paneer')
  })

  it('(d) clearly-unrelated name → unknown (no forced wrong match)', () => {
    const m = matchFood('chicken biryani', FOODS)
    expect(m.method).toBe('unknown')
    expect(m.food).toBeNull()
  })

  it('(e) normalization: case, whitespace, and plural', () => {
    expect(normalizeFoodName('  ROTIs ')).toBe('roti')
    expect(normalizeFoodName('Boiled Eggs')).toBe('boiled egg')
    expect(normalizeFoodName('dal')).toBe('dal')

    expect(matchFood('  DAL  ', FOODS).food?.name).toBe('Toor dal (cooked)') // case + ws
    expect(matchFood('rotis', FOODS).food?.name).toBe('Chapati / roti') // plural
  })
})
