'use server'

import { createClient } from '@/lib/db/server'
import { insertWeightLog, getWeightLogs, type WeightLogRow } from '@/lib/db/weight-logs'

/**
 * Log a manual weight entry for the signed-in user. Validates weightKg > 0 and
 * auths via the session (never trusts a client-supplied user id). Never throws to
 * the client — failure surfaces as { ok: false }.
 */
export async function logWeight(input: {
  weightKg: number
  measuredAt?: string
  notes?: string
}): Promise<{ ok: boolean }> {
  if (
    !input ||
    typeof input.weightKg !== 'number' ||
    !Number.isFinite(input.weightKg) ||
    input.weightKg <= 0
  ) {
    return { ok: false }
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  try {
    await insertWeightLog(user.id, {
      weightKg: input.weightKg,
      measuredAt: input.measuredAt,
      notes: input.notes,
    })
    return { ok: true }
  } catch (err) {
    console.error('logWeight failed:', err)
    return { ok: false }
  }
}

/** The signed-in user's 7 most recent weight logs (newest first). */
export async function getRecentWeights(): Promise<{ ok: boolean; logs: WeightLogRow[] }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, logs: [] }

  try {
    const logs = await getWeightLogs(user.id, 7)
    return { ok: true, logs }
  } catch (err) {
    console.error('getRecentWeights failed:', err)
    return { ok: false, logs: [] }
  }
}
