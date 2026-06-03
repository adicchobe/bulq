import { describe, it, expect } from 'vitest'
import {
  rollingAverage,
  weeklyRateOfChange,
  interpretTrend,
  type TrendLog,
  type WeeklyRate,
} from './trends'

const log = (measured_at: string, weight_kg: number): TrendLog => ({ measured_at, weight_kg })

describe('rollingAverage', () => {
  it('empty → null', () => {
    expect(rollingAverage([])).toBeNull()
  })

  it('single entry → that weight', () => {
    expect(rollingAverage([log('2026-06-01', 72.5)])).toBe(72.5)
  })

  it('7 entries within the window → their mean', () => {
    const logs = [
      log('2026-06-01', 70),
      log('2026-06-02', 71),
      log('2026-06-03', 72),
      log('2026-06-04', 73),
      log('2026-06-05', 74),
      log('2026-06-06', 75),
      log('2026-06-07', 76),
    ]
    expect(rollingAverage(logs, 7)).toBe(73) // (70..76)/7
  })

  it('excludes entries older than the window (relative to newest log)', () => {
    const logs = [
      log('2026-05-01', 60), // 37 days before newest → excluded from a 7-day window
      log('2026-06-06', 80),
      log('2026-06-07', 82),
    ]
    expect(rollingAverage(logs, 7)).toBe(81) // only the two recent ones
  })
})

describe('weeklyRateOfChange', () => {
  it('fewer than 2 points → null', () => {
    expect(weeklyRateOfChange([log('2026-06-01', 70)])).toBeNull()
  })

  it('points less than 7 days apart → null', () => {
    const logs = [log('2026-06-01', 70), log('2026-06-05', 70.3)] // 4 days
    expect(weeklyRateOfChange(logs)).toBeNull()
  })

  it('gaining → positive rate, direction gaining', () => {
    const logs = [log('2026-06-01', 70), log('2026-06-08', 70.3)] // +0.3 over 7 days
    const r = weeklyRateOfChange(logs)
    expect(r).not.toBeNull()
    expect((r as WeeklyRate).rateKgPerWeek).toBeCloseTo(0.3, 5)
    expect((r as WeeklyRate).direction).toBe('gaining')
  })

  it('losing → negative rate, direction losing', () => {
    const logs = [log('2026-06-01', 70), log('2026-06-08', 69.6)] // -0.4 over 7 days
    const r = weeklyRateOfChange(logs)
    expect((r as WeeklyRate).rateKgPerWeek).toBeCloseTo(-0.4, 5)
    expect((r as WeeklyRate).direction).toBe('losing')
  })

  it('within the noise band → direction stable', () => {
    const logs = [log('2026-06-01', 70), log('2026-06-08', 70.02)] // +0.02/week < 0.05
    const r = weeklyRateOfChange(logs)
    expect((r as WeeklyRate).direction).toBe('stable')
  })
})

describe('interpretTrend (gain goal)', () => {
  const rate = (rateKgPerWeek: number, direction: WeeklyRate['direction']): WeeklyRate => ({
    rateKgPerWeek,
    ratePercentPerWeek: (rateKgPerWeek / 75) * 100,
    direction,
  })

  it('on_track: 0.3 kg/week gaining', () => {
    expect(interpretTrend(rate(0.3, 'gaining'), 'gain').status).toBe('on_track')
  })

  it('too_slow: 0.05 kg/week', () => {
    expect(interpretTrend(rate(0.05, 'gaining'), 'gain').status).toBe('too_slow')
  })

  it('too_fast: 0.6 kg/week', () => {
    expect(interpretTrend(rate(0.6, 'gaining'), 'gain').status).toBe('too_fast')
  })

  it('wrong_direction: losing while goal is gain', () => {
    expect(interpretTrend(rate(-0.3, 'losing'), 'gain').status).toBe('wrong_direction')
  })
})
