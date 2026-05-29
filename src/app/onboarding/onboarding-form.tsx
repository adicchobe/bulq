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
            <Num label="Goal weight (kg)" value={form.goalWeightKg} onChange={set('goalWeightKg')} step="0.1" />
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
            <Num label="Rate (% body weight / week)" value={form.goalRatePctPerWeek} onChange={set('goalRatePctPerWeek')} step="0.05" />
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
            </label>
            <Num label="Training days / week" value={form.trainingDaysPerWeek} onChange={set('trainingDaysPerWeek')} />
          </fieldset>

          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
              Diet &amp; lifestyle
            </legend>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Dietary pattern</span>
              <input className={inputClass} value={form.dietaryPattern} onChange={set('dietaryPattern')} />
            </label>
            <Num label="Chicken max / week" value={form.chickenMaxPerWeek} onChange={set('chickenMaxPerWeek')} />
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
}: {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  step?: string
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
    </label>
  )
}
