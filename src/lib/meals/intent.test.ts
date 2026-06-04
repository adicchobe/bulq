import { describe, it, expect } from 'vitest'
import { extractIntent, isObviousQuestion } from './intent'

describe('extractIntent', () => {
  it('reads a clean "meal_log"', () => {
    expect(extractIntent('meal_log')).toBe('meal_log')
  })
  it('reads a clean "question"', () => {
    expect(extractIntent('question')).toBe('question')
  })
  it('tolerates whitespace / case / quotes / trailing punctuation', () => {
    expect(extractIntent('  MEAL_LOG \n')).toBe('meal_log')
    expect(extractIntent('"meal_log"')).toBe('meal_log')
    expect(extractIntent('meal_log.')).toBe('meal_log')
  })
  it('defaults to "question" on prose / ambiguity / empty / unexpected', () => {
    expect(extractIntent('this is a question')).toBe('question')
    expect(extractIntent('meal log')).toBe('question') // "meal log" (space) ≠ "meal_log"
    expect(extractIntent('')).toBe('question')
    expect(extractIntent('unexpected')).toBe('question')
  })
})

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
