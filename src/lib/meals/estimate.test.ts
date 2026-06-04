import { describe, it, expect } from 'vitest'
import { parseEstimates } from './estimate'

describe('parseEstimates', () => {
  it('parses a clean JSON array', () => {
    const raw = '[{"name":"samosa","kcal_per_100g":260,"protein_per_100g":5}]'
    expect(parseEstimates(raw)).toEqual([
      { name: 'samosa', kcal_per_100g: 260, protein_per_100g: 5 },
    ])
  })

  it('strips markdown fences and surrounding prose, then parses', () => {
    const raw =
      'Here you go:\n```json\n[{"name":"vada pav","kcal_per_100g":290,"protein_per_100g":7}]\n```'
    expect(parseEstimates(raw)).toEqual([
      { name: 'vada pav', kcal_per_100g: 290, protein_per_100g: 7 },
    ])
  })

  it('drops entries with missing / non-numeric fields, keeps valid ones', () => {
    const raw =
      '[{"name":"a","kcal_per_100g":100,"protein_per_100g":3},{"name":"b","kcal_per_100g":"x"},{"protein_per_100g":2}]'
    expect(parseEstimates(raw)).toEqual([
      { name: 'a', kcal_per_100g: 100, protein_per_100g: 3 },
    ])
  })

  it('returns [] for empty, non-array, or malformed input', () => {
    expect(parseEstimates('')).toEqual([])
    expect(parseEstimates('not json at all')).toEqual([])
    expect(parseEstimates('{"name":"x"}')).toEqual([]) // object, not an array
    expect(parseEstimates('[unterminated')).toEqual([])
    expect(parseEstimates('[]')).toEqual([]) // valid but empty
  })
})
