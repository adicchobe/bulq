import { describe, it, expect } from 'vitest'
import { extractIntent } from './intent'

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
