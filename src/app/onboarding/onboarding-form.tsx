'use client'

import { useState } from 'react'
import { saveProfile } from './actions'
import type { OnboardingInput } from './schema'

// Pre-filled with the §3 primary-user values — near-zero typing to confirm.
const DEFAULTS = {
  sex: 'male',
  ageYears: '26',
  heightCm: '180',
  currentWeightKg: '54',
  goalWeightKg: '63',
  goalDirection: 'gain',
  goalRatePctPerWeek: '0.3',
  activityLevel: 'moderate_plus',
  trainingDaysPerWeek: '5',
  dietaryPattern: 'vegetarian',
  chickenMaxPerWeek: '2',
  sleepAvgHours: '8',
} as const

type FormState = { [K in keyof typeof DEFAULTS]: string }

const inputClass =
  'rounded-xl border border-black/[.12] bg-transparent px-4 py-3 text-base outline-none transition-colors focus:border-black/40 dark:border-white/[.15] dark:focus:border-white/40'
const labelClass = 'text-sm font-medium text-black/60 dark:text-white/60'
const hintClass = 'text-xs leading-relaxed text-black/45 dark:text-white/45'

// Per-option descriptions, shown below the activity select for the chosen value.
const ACTIVITY_HINTS: Record<string, string> = {
  sedentary: 'Desk job, little to no exercise.',
  light: 'Light exercise 1–2 days/week.',
  moderate: 'Moderate exercise ~3 days/week.',
  moderate_plus: 'Gym 4–5x/week plus an active daily routine.',
  active: 'Hard exercise 6–7 days/week.',
  very_active: 'Physical job, or training twice a day.',
}

export function OnboardingForm() {
  const [form, setForm] = useState<FormState>({ ...DEFAULTS })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const set =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const input: OnboardingInput = {
      sex: form.sex as OnboardingInput['sex'],
      ageYears: Number(form.ageYears),
      heightCm: Number(form.heightCm),
      currentWeightKg: Number(form.currentWeightKg),
      goalWeightKg: Number(form.goalWeightKg),
      goalDirection: form.goalDirection as OnboardingInput['goalDirection'],
      goalRatePctPerWeek: Number(form.goalRatePctPerWeek),
      activityLevel: form.activityLevel as OnboardingInput['activityLevel'],
      trainingDaysPerWeek: Number(form.trainingDaysPerWeek),
      dietaryPattern: form.dietaryPattern,
      chickenMaxPerWeek: Number(form.chickenMaxPerWeek),
      sleepAvgHours: Number(form.sleepAvgHours),
    }

    // On success the action redirects; control only returns here on failure.
    const result = await saveProfile(input)
    if (result && !result.ok) {
      setError(result.error)
      setLoading(false)
    }
  }

  // Translate the chosen %/week into kg/week at the current weight, so the rate
  // hint stays accurate if either value is edited.
  const rateKgPerWeek = (() => {
    const r = Number(form.goalRatePctPerWeek)
    const w = Number(form.currentWeightKg)
    return Number.isFinite(r) && Number.isFinite(w) && r > 0 && w > 0 ? (r / 100) * w : null
  })()
  const rateHint = `Recommended 0.25–0.4% of body weight per week${
    rateKgPerWeek != null ? ` — about ${rateKgPerWeek.toFixed(2)} kg/week at your current weight` : ''
  }. Slow and sustainable: mostly muscle, minimal fat.`

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-5 py-12 font-[family-name:var(--font-geist-sans)]">
      <section className="w-full max-w-md rounded-3xl border border-black/[.08] bg-white/40 p-7 shadow-sm sm:p-9 dark:border-white/[.12] dark:bg-white/[.03]">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-black/40 dark:text-white/40">
          Bulq
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Let&apos;s set up your profile
        </h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          These give Bulq a starting point. It refines from your real weight
          trend over time — nothing here is set in stone.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-7">
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
              Basics
            </legend>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Sex</span>
              <select className={inputClass} value={form.sex} onChange={set('sex')}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
            <Num label="Age (years)" value={form.ageYears} onChange={set('ageYears')} />
            <Num label="Height (cm)" value={form.heightCm} onChange={set('heightCm')} step="0.1" />
            <Num label="Current weight (kg)" value={form.currentWeightKg} onChange={set('currentWeightKg')} step="0.1" />
            <Num
              label="Goal weight (kg)"
              value={form.goalWeightKg}
              onChange={set('goalWeightKg')}
              step="0.1"
              hint="Aim for a healthy target range for your height."
            />
          </fieldset>

          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
              Goal
            </legend>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Direction</span>
              <select className={inputClass} value={form.goalDirection} onChange={set('goalDirection')}>
                <option value="gain">Lean gain</option>
                <option value="maintain">Maintain</option>
                <option value="lose">Lose</option>
              </select>
            </label>
            <Num
              label="Rate (% body weight / week)"
              value={form.goalRatePctPerWeek}
              onChange={set('goalRatePctPerWeek')}
              step="0.05"
              hint={rateHint}
            />
          </fieldset>

          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
              Activity
            </legend>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Activity level</span>
              <select className={inputClass} value={form.activityLevel} onChange={set('activityLevel')}>
                <option value="sedentary">Sedentary</option>
                <option value="light">Light</option>
                <option value="moderate">Moderate</option>
                <option value="moderate_plus">Moderate+ (active lifestyle, regular training)</option>
                <option value="active">Active</option>
                <option value="very_active">Very active</option>
              </select>
              <span className={hintClass}>{ACTIVITY_HINTS[form.activityLevel]}</span>
            </label>
            <Num
              label="Training days / week"
              value={form.trainingDaysPerWeek}
              onChange={set('trainingDaysPerWeek')}
              hint="Days per week you train — shapes protein timing, not the calorie target."
            />
          </fieldset>

          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
              Diet &amp; lifestyle
            </legend>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Dietary pattern</span>
              <input className={inputClass} value={form.dietaryPattern} onChange={set('dietaryPattern')} />
              <span className={hintClass}>
                Free text — e.g. vegetarian, eggetarian, non-vegetarian, or vegan.
              </span>
            </label>
            <Num
              label="Chicken max / week"
              value={form.chickenMaxPerWeek}
              onChange={set('chickenMaxPerWeek')}
              hint="Caps how often Bulq suggests chicken, so protein variety matches your preference."
            />
            <Num label="Sleep (avg hours / night)" value={form.sleepAvgHours} onChange={set('sleepAvgHours')} step="0.5" />
          </fieldset>

          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-[var(--foreground)] px-4 py-3 text-base font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Save and see my target'}
          </button>
        </form>
      </section>
    </main>
  )
}

function Num({
  label,
  value,
  onChange,
  step,
  hint,
}: {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  step?: string
  hint?: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelClass}>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step ?? '1'}
        required
        value={value}
        onChange={onChange}
        className={inputClass}
      />
      {hint ? <span className={hintClass}>{hint}</span> : null}
    </label>
  )
}
