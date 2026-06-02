import { describe, it, expect } from 'vitest'
import { checkResponse, type ViolationType } from './anti-hallucination'

const types = (text: string, facts: Parameters<typeof checkResponse>[1]): ViolationType[] =>
  checkResponse(text, facts).violations.map((v) => v.type)

const QUESTION = { allowedNutritionNumbers: [], nowIst: null, path: 'question' as const }

describe('ungrounded_number', () => {
  const allowed = [2936, 305, 593, 25, 97]
  const facts = { allowedNutritionNumbers: allowed, nowIst: null, path: 'question' as const }

  it('passes grounded numbers (target, range, protein)', () => {
    expect(types('Your target is about 2,936 kcal.', facts)).toEqual([])
    expect(types('That leaves roughly 305–593 kcal to go.', facts)).toEqual([])
    expect(types('about 25 g protein', facts)).toEqual([])
    expect(types('25g of protein', facts)).toEqual([])
  })

  it('absorbs rounding within tolerance', () => {
    expect(types('roughly 2,940 kcal', facts)).toEqual([]) // ±5% of 2936
  })

  it('does NOT flag plain quantities (not in nutrition context)', () => {
    expect(types('Have 2 eggs and 3 rotis.', facts)).toEqual([])
  })

  it('flags an ungrounded nutrition number', () => {
    expect(types("that's about 450 kcal", facts)).toEqual(['ungrounded_number'])
    expect(types('roughly 40 g protein', facts)).toEqual(['ungrounded_number']) // 40 not allowed
  })

  it('flags one end of a range that is ungrounded', () => {
    // 305 allowed, 999 not
    expect(types('between 305 and 999 kcal', facts)).toEqual(['ungrounded_number'])
  })
})

describe('invented_time', () => {
  const now = '2026-05-31 1:24 am IST'

  it('passes a time that matches nowIst', () => {
    expect(types('It is 1:24 am now.', { ...QUESTION, nowIst: now })).toEqual([])
  })
  it('passes vague terms', () => {
    expect(types('It is early in the morning — late, even.', { ...QUESTION, nowIst: now })).toEqual([])
  })
  it('flags a clock time that does not match nowIst', () => {
    expect(types('It is 11 pm.', { ...QUESTION, nowIst: now })).toEqual(['invented_time'])
    expect(types('Around 13:00.', { ...QUESTION, nowIst: now })).toEqual(['invented_time'])
  })
  it('does not flag when nowIst is null (no ground truth)', () => {
    expect(types('It is 11 pm.', { ...QUESTION, nowIst: null })).toEqual([])
  })
})

describe('false_logged (question path only)', () => {
  it('flags a present-tense logged claim on the question path', () => {
    const v = checkResponse("I've logged that for you.", QUESTION).violations
    expect(v.some((x) => x.type === 'false_logged')).toBe(true)
  })
  it('does NOT flag a reference to past confirmed meals', () => {
    expect(types("You've logged 2 meals today.", QUESTION)).toEqual([])
  })
  it('does not run on the meal_log path', () => {
    const facts = { allowedNutritionNumbers: [], nowIst: null, path: 'meal_log' as const }
    expect(types("I've logged that for you.", facts)).toEqual([])
  })
})

describe('shaming', () => {
  it('flags diet-app language', () => {
    expect(types('No cheat day needed!', QUESTION)).toEqual(['shaming'])
    expect(types('A guilt-free treat.', QUESTION)).toEqual(['shaming']) // guilt-free (treat-yourself not present)
    expect(types('You can burn it off later.', QUESTION)).toEqual(['shaming'])
  })
  it('passes clean, supportive language', () => {
    expect(types('A balanced plate of dal and rice works well.', QUESTION)).toEqual([])
  })
})

describe('fabricated_source (RAG citations)', () => {
  const retrieved = [
    'Summarized from: ICMR-NIN, Dietary Guidelines for Indians (2024)',
    'Summarized from: Examine.com, Protein Intake guide (citing Morton et al. 2018 meta-analysis)',
  ]
  const facts = { ...QUESTION, retrievedSourceTitles: retrieved }

  it('does NOT flag a citation of a real retrieved source', () => {
    expect(
      types('According to ICMR-NIN Dietary Guidelines (2024), aim for varied protein.', facts),
    ).toEqual([])
    expect(types('As per Examine.com, 1.6 g/kg is plenty.', facts)).toEqual([])
  })

  it('flags a source NOT in the retrieved list', () => {
    expect(types('According to the USDA FoodData reference, that holds.', facts)).toEqual([
      'fabricated_source',
    ])
    expect(types('As stated in the Harvard Nutrition Source, eat more.', facts)).toEqual([
      'fabricated_source',
    ])
  })

  it('skips the check entirely when no chunks were retrieved', () => {
    expect(types('According to the USDA FoodData reference, that holds.', QUESTION)).toEqual([])
    expect(
      types('According to the USDA reference.', { ...QUESTION, retrievedSourceTitles: [] }),
    ).toEqual([])
  })
})

describe('clean reply across all checks', () => {
  it('zero violations for a realistic grounded reply', () => {
    const facts = { allowedNutritionNumbers: [2936, 467, 1056, 32, 97], nowIst: '2026-05-31 1:24 am IST', path: 'question' as const }
    const text =
      "You've logged 2 meals today — roughly 467–1,056 kcal and about 32 g protein so far, " +
      'against your ~2,936 kcal target. Some paneer or a couple of eggs would help close the gap.'
    expect(types(text, facts)).toEqual([])
  })
})
