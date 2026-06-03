/**
 * Weight-trend math (Sprint 4.2). PURE — no DB, no Date.now(), so it's fully
 * Vitest-testable and deterministic. All "windows" are measured relative to the
 * most recent log's date (not the wall clock), which keeps results stable.
 *
 * The scale is the proof, the formula is the opening guess (pillar: calibrate from
 * real weight trend). We never fabricate: too few / too-close points → null.
 */

/** Minimal log shape the trend math needs. measured_at is 'YYYY-MM-DD' (or any
 *  Date-parseable string — we fall back to logged_at upstream). */
export interface TrendLog {
  weight_kg: number
  measured_at: string
}

export type TrendDirection = 'gaining' | 'losing' | 'stable'
export type TrendStatus = 'on_track' | 'too_fast' | 'too_slow' | 'wrong_direction'

export interface WeeklyRate {
  rateKgPerWeek: number
  ratePercentPerWeek: number
  direction: TrendDirection
}

export interface TrendInterpretation {
  status: TrendStatus
  message: string
}

const MS_PER_DAY = 86_400_000
// Below this magnitude the trend is noise, not a direction (kg/week).
const STABLE_KG_PER_WEEK = 0.05
// Sustainable lean-gain band (kg/week), per the brief's ~0.25–0.4% body weight.
const GAIN_MIN_KG_PER_WEEK = 0.1
const GAIN_MAX_KG_PER_WEEK = 0.4

const dateMs = (s: string): number => new Date(s).getTime()
const round = (n: number, dp: number): number => {
  const f = 10 ** dp
  return Math.round(n * f) / f
}
const fmtKg = (n: number): string => round(Math.abs(n), 2).toString()
const fmtPct = (n: number): string => round(Math.abs(n), 2).toString()

/**
 * Mean weight over the logs within the last `windowDays` (relative to the most
 * recent log). null if there are no logs. Absorbs day-to-day noise.
 */
export function rollingAverage(logs: TrendLog[], windowDays = 7): number | null {
  if (!logs || logs.length === 0) return null
  const refMs = Math.max(...logs.map((l) => dateMs(l.measured_at)))
  const windowMs = windowDays * MS_PER_DAY
  const inWindow = logs.filter((l) => refMs - dateMs(l.measured_at) <= windowMs)
  if (inWindow.length === 0) return null
  const sum = inWindow.reduce((s, l) => s + l.weight_kg, 0)
  return sum / inWindow.length
}

/**
 * Weekly rate of weight change over the last `windowDays`. Uses the earliest and
 * latest points in the window — they must be at least 7 days apart, else null
 * (a rate from <1 week of data is too noisy to trust). null also if <2 points.
 * Percent is of the most recent (current) body weight.
 */
export function weeklyRateOfChange(logs: TrendLog[], windowDays = 14): WeeklyRate | null {
  if (!logs || logs.length < 2) return null
  const sorted = [...logs].sort((a, b) => dateMs(a.measured_at) - dateMs(b.measured_at))
  const refMs = dateMs(sorted[sorted.length - 1].measured_at)
  const windowMs = windowDays * MS_PER_DAY
  const inWindow = sorted.filter((l) => refMs - dateMs(l.measured_at) <= windowMs)
  if (inWindow.length < 2) return null

  const first = inWindow[0]
  const last = inWindow[inWindow.length - 1]
  const spanDays = (dateMs(last.measured_at) - dateMs(first.measured_at)) / MS_PER_DAY
  if (spanDays < 7) return null // need 2 points 7+ days apart

  const rateKgPerWeek = ((last.weight_kg - first.weight_kg) / spanDays) * 7
  const base = last.weight_kg
  const ratePercentPerWeek = base > 0 ? (rateKgPerWeek / base) * 100 : 0
  const direction: TrendDirection =
    Math.abs(rateKgPerWeek) < STABLE_KG_PER_WEEK
      ? 'stable'
      : rateKgPerWeek > 0
        ? 'gaining'
        : 'losing'

  return { rateKgPerWeek, ratePercentPerWeek, direction }
}

/**
 * Interpret a weekly rate against the user's goal. For a gainer: on track at
 * 0.1–0.4 kg/week (~0.25–0.4% body weight), too slow below, too fast above, and
 * wrong-direction if actually losing. Loss mirrors the same magnitude band.
 */
export function interpretTrend(
  rate: WeeklyRate,
  goalDirection: 'gain' | 'loss',
): TrendInterpretation {
  const kg = rate.rateKgPerWeek
  const pctStr = fmtPct(rate.ratePercentPerWeek)

  if (goalDirection === 'gain') {
    if (rate.direction === 'losing') {
      return {
        status: 'wrong_direction',
        message: `You're losing about ${fmtKg(kg)} kg/week, but your goal is to gain. Time to add some calories.`,
      }
    }
    if (kg > GAIN_MAX_KG_PER_WEEK) {
      return {
        status: 'too_fast',
        message: `Gaining about ${fmtKg(kg)} kg/week — faster than the ~0.25–0.4% body-weight/week sweet spot. Easing the surplus keeps more of the gain lean.`,
      }
    }
    if (kg >= GAIN_MIN_KG_PER_WEEK) {
      return {
        status: 'on_track',
        message: `Gaining about ${fmtKg(kg)} kg/week (~${pctStr}% of body weight) — a sustainable lean-gain pace.`,
      }
    }
    return {
      status: 'too_slow',
      message: `Only about ${fmtKg(kg)} kg/week of gain — a touch slow. A small calorie bump targets the 0.25–0.4% body-weight/week range.`,
    }
  }

  // goalDirection === 'loss' — mirror of the gain logic on loss magnitude.
  const lossKg = -kg
  if (rate.direction === 'gaining') {
    return {
      status: 'wrong_direction',
      message: `You're gaining about ${fmtKg(kg)} kg/week, but your goal is to lose. Time to trim some calories.`,
    }
  }
  if (lossKg > GAIN_MAX_KG_PER_WEEK) {
    return {
      status: 'too_fast',
      message: `Losing about ${fmtKg(kg)} kg/week — faster than ideal. A smaller deficit protects muscle.`,
    }
  }
  if (lossKg >= GAIN_MIN_KG_PER_WEEK) {
    return {
      status: 'on_track',
      message: `Losing about ${fmtKg(kg)} kg/week (~${pctStr}% of body weight) — a sustainable pace.`,
    }
  }
  return {
    status: 'too_slow',
    message: `Only about ${fmtKg(kg)} kg/week of loss — a touch slow. A slightly larger deficit would speed it up.`,
  }
}
