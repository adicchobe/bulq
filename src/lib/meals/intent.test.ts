import { describe, it, expect } from 'vitest'
import { isObviousQuestion } from './intent'

describe('isObviousQuestion', () => {
  it('leading question word → true', () => {
    expect(isObviousQuestion('what is protein')).toBe(true)
    expect(isObviousQuestion('should I eat more?')).toBe(true)
  })
  it('trailing "?" → true', () => {
    expect(isObviousQuestion('how much protein in paneer?')).toBe(true)
  })
  it('food statements / bare lists → false (go through the classifier)', () => {
    expect(isObviousQuestion('had 2 eggs and milk')).toBe(false)
    expect(isObviousQuestion('rice dal sabzi')).toBe(false)
  })
})
