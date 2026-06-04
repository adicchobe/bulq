'use client'

import { useState } from 'react'
import type { MealProposal, MealProposalItem } from '@/lib/meals/proposal'

export type MealCardStatus = 'pending' | 'confirmed' | 'dismissed'
type Confidence = 'high' | 'medium' | 'low'

/** What the teach form collects (per serving). Mirrors teachFood's food input. */
export interface TeachFormInput {
  name: string
  proteinPerServing: number
  kcalPerServing?: number
  servingGrams?: number
}

const kcal = (n: number) => n.toLocaleString('en-US')

function ConfidenceDot({ c }: { c: Confidence }) {
  const color =
    c === 'high' ? 'bg-emerald-500' : c === 'medium' ? 'bg-amber-500' : 'bg-gray-400'
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`}
      title={`${c} confidence`}
      aria-label={`${c} confidence`}
    />
  )
}

/** Inline form for teaching/editing one item's food. */
function TeachForm({
  initialName,
  initialProtein = '',
  initialCalories = '',
  initialGrams = '',
  onSave,
}: {
  initialName: string
  initialProtein?: string
  initialCalories?: string
  initialGrams?: string
  onSave: (input: TeachFormInput) => Promise<boolean>
}) {
  const [name, setName] = useState(initialName)
  const [protein, setProtein] = useState(initialProtein)
  const [calories, setCalories] = useState(initialCalories)
  const [grams, setGrams] = useState(initialGrams)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const proteinNum = parseFloat(protein)
    if (!name.trim() || !Number.isFinite(proteinNum) || proteinNum < 0) {
      setError('Add a food name and protein per serving.')
      return
    }
    const caloriesNum = calories.trim() ? parseFloat(calories) : undefined
    const gramsNum = grams.trim() ? parseFloat(grams) : undefined
    const input: TeachFormInput = {
      name: name.trim(),
      proteinPerServing: proteinNum,
      kcalPerServing: caloriesNum != null && Number.isFinite(caloriesNum) ? caloriesNum : undefined,
      servingGrams: gramsNum != null && Number.isFinite(gramsNum) ? gramsNum : undefined,
    }
    setError(null)
    setSaving(true)
    const ok = await onSave(input)
    setSaving(false)
    if (!ok) setError("Couldn't save that — please try again.")
  }

  const fieldClass =
    'w-full rounded-lg border border-black/[.12] bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-black/40 dark:border-white/[.15] dark:focus:border-white/40'

  return (
    <form onSubmit={submit} className="mt-2 flex flex-col gap-2 rounded-xl bg-black/[.03] p-3 dark:bg-white/[.04]">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Food name"
        aria-label="Food name"
        className={fieldClass}
      />
      <input
        value={protein}
        onChange={(e) => setProtein(e.target.value)}
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        placeholder="Protein per serving (g)"
        aria-label="Protein per serving in grams"
        className={fieldClass}
      />
      <input
        value={calories}
        onChange={(e) => setCalories(e.target.value)}
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        placeholder="Calories per serving — optional, I'll estimate"
        aria-label="Calories per serving, optional"
        className={fieldClass}
      />
      <input
        value={grams}
        onChange={(e) => setGrams(e.target.value)}
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        placeholder="Serving size in grams — default 100g"
        aria-label="Serving size in grams, optional"
        className={fieldClass}
      />
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
      <button
        type="submit"
        disabled={saving}
        className="self-start rounded-lg bg-[var(--foreground)] px-3 py-1.5 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}

function ItemRow({
  item,
  editable,
  isEditing,
  taughtInput,
  onToggleEdit,
  onSave,
}: {
  item: MealProposalItem
  editable: boolean
  isEditing: boolean
  taughtInput: TeachFormInput | undefined
  onToggleEdit: () => void
  onSave: (input: TeachFormInput) => Promise<boolean>
}) {
  // Estimated items carry a "(estimated)" suffix on matched_food_name — strip it
  // from the display name (the "AI estimate" label below conveys it instead).
  const isEstimated = (item.matched_food_name ?? '').includes('(estimated)')
  const baseName = (item.matched_food_name ?? item.food_name_raw).replace(/\s*\(estimated\)$/, '')
  const displayName = taughtInput?.name ?? baseName
  const unitWord = item.unit_key ? item.unit_key.split('_')[0] : null
  const isUnknown = item.match_method === 'unknown' || item.kcal_min === null

  // An untaught unknown gets the inviting label; everything else just "Edit".
  const buttonLabel = isUnknown && !taughtInput ? 'Teach Bulq this food' : 'Edit'

  return (
    <li>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-black/75 dark:text-white/75">
            {displayName}
          </p>
          {taughtInput ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              ✓ Taught: {taughtInput.proteinPerServing}g protein
              {taughtInput.kcalPerServing != null ? `, ${taughtInput.kcalPerServing} kcal` : ''} per{' '}
              {taughtInput.servingGrams ?? 100}g
            </p>
          ) : isUnknown ? (
            <p className="text-xs text-black/45 dark:text-white/45">
              couldn&apos;t estimate this one precisely
            </p>
          ) : (
            <>
              <p className="text-xs tabular-nums text-black/50 dark:text-white/50">
                {item.quantity}
                {unitWord ? ` ${unitWord}` : ''}
                {item.grams_used != null ? ` · ≈${kcal(item.grams_used)}g` : ''} · ≈
                {kcal(item.kcal_min as number)}–{kcal(item.kcal_max as number)} kcal
              </p>
              {isEstimated ? (
                <p className="text-[11px] text-black/40 dark:text-white/40">AI estimate</p>
              ) : null}
            </>
          )}
        </div>
        <div className="mt-1 flex shrink-0 items-center gap-2">
          <ConfidenceDot c={item.confidence} />
          {editable ? (
            <button
              type="button"
              onClick={onToggleEdit}
              className="text-xs font-medium text-black/55 underline-offset-2 hover:underline dark:text-white/55"
            >
              {isEditing ? 'Cancel' : buttonLabel}
            </button>
          ) : null}
        </div>
      </div>
      {isEditing ? (
        <TeachForm
          initialName={baseName}
          // For an AI-estimated item, pre-fill the estimate so the user can just
          // tweak + Save. serving = the item's total grams; protein/calories are the
          // totals for that serving (so per-100g re-derives to the same estimate).
          initialProtein={isEstimated && item.protein_g != null ? String(item.protein_g) : ''}
          initialCalories={isEstimated && item.kcal_typical != null ? String(item.kcal_typical) : ''}
          initialGrams={isEstimated ? String(item.grams_used ?? 100) : ''}
          onSave={onSave}
        />
      ) : null}
    </li>
  )
}

export function MealProposalCard({
  proposal,
  status,
  onConfirm,
  onDismiss,
  onTeach,
}: {
  proposal: MealProposal
  status: MealCardStatus
  onConfirm: () => Promise<void>
  onDismiss: () => Promise<void>
  onTeach: (foodNameRaw: string, input: TeachFormInput) => Promise<boolean>
}) {
  const [busy, setBusy] = useState<null | 'confirm' | 'dismiss'>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  // Optimistic per-item record of what the user just taught (keyed by item index).
  const [taught, setTaught] = useState<Map<number, TeachFormInput>>(new Map())

  const editable = status === 'pending'

  const run = (which: 'confirm' | 'dismiss', fn: () => Promise<void>) => async () => {
    setBusy(which)
    try {
      await fn()
    } finally {
      setBusy(null)
    }
  }

  const handleSave =
    (index: number, foodNameRaw: string) =>
    async (input: TeachFormInput): Promise<boolean> => {
      const ok = await onTeach(foodNameRaw, input)
      if (ok) {
        setTaught((prev) => new Map(prev).set(index, input))
        setEditingIndex(null)
      }
      return ok
    }

  return (
    <div className="max-w-[90%] self-start rounded-2xl rounded-bl-sm border border-black/[.08] bg-white/40 p-4 dark:border-white/[.12] dark:bg-white/[.04]">
      <p className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
        Proposed meal
      </p>

      <ul className="mt-3 flex flex-col gap-2.5">
        {proposal.items.map((item, i) => (
          <ItemRow
            key={`${proposal.mealId}-${i}`}
            item={item}
            editable={editable}
            isEditing={editingIndex === i}
            taughtInput={taught.get(i)}
            onToggleEdit={() => setEditingIndex(editingIndex === i ? null : i)}
            onSave={handleSave(i, item.food_name_raw)}
          />
        ))}
      </ul>

      <div className="my-3 h-px bg-black/[.07] dark:bg-white/[.1]" />

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold tabular-nums">
            ≈{kcal(proposal.kcal_min)}–{kcal(proposal.kcal_max)} kcal
          </p>
          <p className="text-xs tabular-nums text-black/50 dark:text-white/50">
            ≈{Math.round(proposal.protein_g)} g protein
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-black/50 dark:text-white/50">
          <ConfidenceDot c={proposal.mealConfidence} />
          {proposal.mealConfidence} confidence
        </span>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-black/45 dark:text-white/45">
        Estimates — ranges reflect portion &amp; recipe variation. Nothing&apos;s
        logged until you confirm.
      </p>

      {status === 'pending' ? (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={run('confirm', onConfirm)}
            disabled={busy !== null}
            className="flex-1 rounded-xl bg-[var(--foreground)] px-4 py-2.5 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy === 'confirm' ? 'Saving…' : 'Confirm'}
          </button>
          <button
            type="button"
            onClick={run('dismiss', onDismiss)}
            disabled={busy !== null}
            className="rounded-xl border border-black/[.12] px-4 py-2.5 text-sm font-medium text-black/55 transition-colors hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.15] dark:text-white/55 dark:hover:bg-white/[.06]"
          >
            {busy === 'dismiss' ? '…' : 'Dismiss'}
          </button>
        </div>
      ) : (
        <p className="mt-4 text-sm font-medium text-black/55 dark:text-white/55">
          {status === 'confirmed' ? '✓ Logged' : 'Dismissed'}
        </p>
      )}
    </div>
  )
}
