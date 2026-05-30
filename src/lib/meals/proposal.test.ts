import { describe, it, expect } from 'vitest'
import { buildProposal } from './proposal'
import type { MealInput, MealItemInput } from '@/lib/db/meals'

function mealItem(over: Partial<MealItemInput> & Pick<MealItemInput, 'food_name_raw'>): MealItemInput {
  return {
    food_id: 'f',
    matched_food_name: over.food_name_raw,
    quantity: 1,
    unit_key: 'u',
    grams_used: 100,
    match_method: 'exact',
    kcal_min: 0,
    kcal_typical: 0,
    kcal_max: 0,
    protein_g: 0,
    fat_g: 0,
    carb_g: 0,
    fiber_g: 0,
    ...over,
  }
}

describe('buildProposal', () => {
  it('maps items in order, sums totals, and carries confidences + mealId', () => {
    const mealInput: MealInput = {
      raw_text: '3 rotis and a katori of dal',
      meal_type: 'lunch',
      note: null,
      confidence: 'medium',
      items: [
        mealItem({ food_name_raw: 'roti', matched_food_name: 'Chapati / roti', quantity: 3, unit_key: 'chapati', grams_used: 120, kcal_min: 227, kcal_typical: 356, kcal_max: 534 }),
        mealItem({ food_name_raw: 'dal', matched_food_name: 'Toor dal (cooked)', quantity: 1, unit_key: 'katori_dal', grams_used: 150, kcal_min: 120, kcal_typical: 173, kcal_max: 261 }),
      ],
    }
    const proposal = buildProposal('meal-123', mealInput, ['high', 'medium'])

    expect(proposal.mealId).toBe('meal-123')
    expect(proposal.mealConfidence).toBe('medium')
    expect(proposal.items).toHaveLength(2)
    expect(proposal.items[0]).toMatchObject({
      food_name_raw: 'roti',
      matched_food_name: 'Chapati / roti',
      quantity: 3,
      unit_key: 'chapati',
      grams_used: 120,
      kcal_typical: 356,
      confidence: 'high',
    })
    expect(proposal.items[1].confidence).toBe('medium')
    // totals = field-wise sum of the items
    expect(proposal.kcal_min).toBe(347) // 227 + 120
    expect(proposal.kcal_typical).toBe(529) // 356 + 173
    expect(proposal.kcal_max).toBe(795) // 534 + 261
  })

  it('an unknown item (null macros) contributes 0 to the totals; confidence defaults to low if missing', () => {
    const mealInput: MealInput = {
      raw_text: 'paneer and pizza',
      meal_type: 'unknown',
      note: null,
      confidence: 'low',
      items: [
        mealItem({ food_name_raw: 'paneer', kcal_min: 75, kcal_typical: 140, kcal_max: 256 }),
        mealItem({
          food_name_raw: 'pizza', food_id: null, matched_food_name: null, match_method: 'unknown',
          unit_key: null, grams_used: null,
          kcal_min: null, kcal_typical: null, kcal_max: null,
          protein_g: null, fat_g: null, carb_g: null, fiber_g: null,
        }),
      ],
    }
    const proposal = buildProposal('m2', mealInput, ['high']) // only one confidence provided

    expect(proposal.kcal_typical).toBe(140) // unknown contributes 0
    expect(proposal.items[1].kcal_typical).toBeNull()
    expect(proposal.items[1].match_method).toBe('unknown')
    expect(proposal.items[1].confidence).toBe('low') // defaulted (missing in array)
  })
})
