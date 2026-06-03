'use client'

import { useState } from 'react'
import { logWeight, getRecentWeights } from './actions/weight'
import type { WeightLogRow } from '@/lib/db/weight-logs'

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

export function WeightLog({ initialLogs }: { initialLogs: WeightLogRow[] }) {
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
      ) : (
        <p className="mt-4 text-sm text-black/40 dark:text-white/40">
          No weigh-ins yet — log your first above.
        </p>
      )}
    </section>
  )
}
