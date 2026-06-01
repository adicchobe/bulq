import { describe, it, expect } from 'vitest'
import { normalizeVector, toPgVector } from './embed'

describe('normalizeVector', () => {
  it('scales a vector to unit length', () => {
    const out = normalizeVector([3, 4]) // magnitude 5
    expect(out[0]).toBeCloseTo(0.6, 10)
    expect(out[1]).toBeCloseTo(0.8, 10)
    const mag = Math.sqrt(out[0] ** 2 + out[1] ** 2)
    expect(mag).toBeCloseTo(1, 10)
  })

  it('leaves an already-unit vector effectively unchanged', () => {
    const out = normalizeVector([1, 0, 0])
    expect(out).toEqual([1, 0, 0])
  })

  it('returns a zero vector unchanged (no divide-by-zero)', () => {
    expect(normalizeVector([0, 0, 0])).toEqual([0, 0, 0])
  })

  it('produces a unit vector for arbitrary input', () => {
    const out = normalizeVector([5, -2, 7, 0.3])
    const mag = Math.sqrt(out.reduce((s, v) => s + v * v, 0))
    expect(mag).toBeCloseTo(1, 10)
  })
})

describe('toPgVector', () => {
  it('formats as a bracketed comma list', () => {
    expect(toPgVector([0.1, 0.2, 0.3])).toBe('[0.1,0.2,0.3]')
  })
})
