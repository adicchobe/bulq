'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { logWeight, getRecentWeights, recalibrateTargets } from './actions/weight'
import type { WeightLogRow } from '@/lib/db/weight-logs'
import { weeklyRateOfChange, interpretTrend, type TrendStatus } from '@/lib/nutrition'
import type { GoalDirection } from '@/lib/nutrition'

const MS_PER_DAY = 86_400_000

/** Calendar span (days) the logs cover; 0 if fewer than 2 entries. */
function spanDays(logs: WeightLogRow[]): number {
  if (logs.length < 2) return 0
  const times = logs.map((l) => new Date(l.measured_at ?? l.logged_at).getTime())
  return (Math.max(...times) - Math.min(...times)) / MS_PER_DAY
}

/** Today's date as YYYY-MM-DD in the BROWSER's local zone (IST for our user). */
function todayLocalISO(): string {
  const d = new Date()
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

/** A weight log's display date — prefer measured_at (the day it applies to). */
function formatLogDate(log: WeightLogRow): string {
  const raw = log.measured_at ?? log.logged_at
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return String(raw)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

const round1 = (n: number): number => Math.round(n * 10) / 10

const STATUS_LABEL: Record<TrendStatus, string> = {
  on_track: 'on track',
  too_fast: 'too fast',
  too_slow: 'too slow',
  wrong_direction: 'wrong direction',
}

export function WeightLog({
  initialLogs,
  goalDirection,
}: {
  initialLogs: WeightLogRow[]
  goalDirection: GoalDirection
}) {
  const [logs, setLogs] = useState<WeightLogRow[]>(initialLogs)
  const [weight, setWeight] = useState('')
  const [date, setDate] = useState(todayLocalISO())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const w = parseFloat(weight)
    if (!Number.isFinite(w) || w <= 0) {
      setError('Enter your weight in kg.')
      return
    }
    setError(null)
    setSaving(true)
    const res = await logWeight({ weightKg: w, measuredAt: date || undefined })
    if (res.ok) {
      const refreshed = await getRecentWeights()
      if (refreshed.ok) setLogs(refreshed.logs)
      setWeight('')
    } else {
      setError("Couldn't save that — please try again.")
    }
    setSaving(false)
  }

  const fieldClass =
    'rounded-xl border border-black/[.12] bg-transparent px-3 py-2.5 text-base outline-none transition-colors focus:border-black/40 dark:border-white/[.15] dark:focus:border-white/40'

  return (
    <section>
      <h2 className="text-sm font-medium text-black/70 dark:text-white/70">Log your weight</h2>

      <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.1"
            placeholder="Weight (kg)"
            aria-label="Weight in kilograms"
            className={`${fieldClass} w-28 tabular-nums`}
          />
          <input
            value={date}
            onChange={(e) => setDate(e.target.value)}
            type="date"
            max={todayLocalISO()}
            aria-label="Measurement date"
            className={`${fieldClass} flex-1 tabular-nums`}
          />
        </div>
        {error ? <p className="text-xs text-red-500">{error}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-[var(--foreground)] px-4 py-2.5 text-base font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save weight'}
        </button>
      </form>

      {logs.length > 0 ? (
        <>
          <ul className="mt-4 flex flex-col gap-1.5">
            {logs.map((log) => (
              <li
                key={log.id}
                className="flex items-baseline justify-between text-sm text-black/55 dark:text-white/55"
              >
                <span>{formatLogDate(log)}</span>
                <span className="tabular-nums font-medium text-black/75 dark:text-white/75">
                  {log.weight_kg} kg
                </span>
              </li>
            ))}
          </ul>
          <TrendSummary logs={logs} goalDirection={goalDirection} />
        </>
      ) : (
        <p className="mt-4 text-sm text-black/40 dark:text-white/40">
          No weigh-ins yet — log your first above.
        </p>
      )}
    </section>
  )
}

/** Trend line below the history. Shows a summary once a real rate can be derived
 *  (3+ entries spanning 7+ days), else a gentle "keep logging" note. */
function TrendSummary({
  logs,
  goalDirection,
}: {
  logs: WeightLogRow[]
  goalDirection: GoalDirection
}) {
  const trend =
    logs.length >= 3
      ? weeklyRateOfChange(
          logs.map((l) => ({ weight_kg: l.weight_kg, measured_at: l.measured_at ?? l.logged_at })),
        )
      : null

  if (!trend) {
    return (
      <p className="mt-3 text-xs text-black/40 dark:text-white/40">
        Not enough data yet — log for 2+ weeks to see trends.
      </p>
    )
  }

  const goalForInterp = goalDirection === 'gain' ? 'gain' : goalDirection === 'lose' ? 'loss' : null
  const interp = goalForInterp ? interpretTrend(trend, goalForInterp) : null

  // Recalibration needs 14+ days of trend AND a gain/loss goal.
  const canRecalibrate = goalForInterp !== null && spanDays(logs) >= 14

  return (
    <div className="mt-3">
      <p className="text-sm font-medium text-black/70 dark:text-white/70">
        Trend: {trend.direction} ~{round1(Math.abs(trend.rateKgPerWeek))} kg/week
        {interp ? ` (${STATUS_LABEL[interp.status]})` : ''}
      </p>
      {interp ? (
        <p className="mt-1 text-xs leading-relaxed text-black/45 dark:text-white/45">
          {interp.message}
        </p>
      ) : null}
      {canRecalibrate ? <Recalibrate /> : null}
    </div>
  )
}

/** Button to recalibrate TDEE from the trend; shows the outcome message. */
function Recalibrate() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const onClick = async () => {
    setBusy(true)
    const res = await recalibrateTargets()
    setResult(res.reason)
    setBusy(false)
    // A real adjustment changes the daily target → re-render the dashboard.
    if (res.adjusted) router.refresh()
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="rounded-lg border border-black/[.12] px-3 py-1.5 text-sm font-medium text-black/65 transition-colors hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.15] dark:text-white/65 dark:hover:bg-white/[.06]"
      >
        {busy ? 'Checking…' : 'Recalibrate targets'}
      </button>
      {result ? (
        <p className="mt-2 text-xs leading-relaxed text-black/55 dark:text-white/55">{result}</p>
      ) : null}
    </div>
  )
}
