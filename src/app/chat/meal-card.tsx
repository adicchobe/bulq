'use client'

import { useState } from 'react'
import type { MealProposal, MealProposalItem } from '@/lib/meals/proposal'

export type MealCardStatus = 'pending' | 'confirmed' | 'dismissed'
type Confidence = 'high' | 'medium' | 'low'

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

function ItemRow({ item }: { item: MealProposalItem }) {
  const name = item.matched_food_name ?? item.food_name_raw
  const unitWord = item.unit_key ? item.unit_key.split('_')[0] : null
  const isUnknown = item.match_method === 'unknown' || item.kcal_min === null

  return (
    <li className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-black/75 dark:text-white/75">
          {name}
        </p>
        {isUnknown ? (
          <p className="text-xs text-black/45 dark:text-white/45">
            couldn&apos;t estimate this one precisely
          </p>
        ) : (
          <p className="text-xs tabular-nums text-black/50 dark:text-white/50">
            {item.quantity}
            {unitWord ? ` ${unitWord}` : ''}
            {item.grams_used != null ? ` · ≈${kcal(item.grams_used)}g` : ''} · ≈
            {kcal(item.kcal_min as number)}–{kcal(item.kcal_max as number)} kcal
          </p>
        )}
      </div>
      <span className="mt-1.5">
        <ConfidenceDot c={item.confidence} />
      </span>
    </li>
  )
}

export function MealProposalCard({
  proposal,
  status,
  onConfirm,
  onDismiss,
}: {
  proposal: MealProposal
  status: MealCardStatus
  onConfirm: () => Promise<void>
  onDismiss: () => Promise<void>
}) {
  const [busy, setBusy] = useState<null | 'confirm' | 'dismiss'>(null)

  const run = (which: 'confirm' | 'dismiss', fn: () => Promise<void>) => async () => {
    setBusy(which)
    try {
      await fn()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="max-w-[90%] self-start rounded-2xl rounded-bl-sm border border-black/[.08] bg-white/40 p-4 dark:border-white/[.12] dark:bg-white/[.04]">
      <p className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
        Proposed meal
      </p>

      <ul className="mt-3 flex flex-col gap-2.5">
        {proposal.items.map((item, i) => (
          <ItemRow key={`${proposal.mealId}-${i}`} item={item} />
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
