import { createClient } from './server'

// ---------------------------------------------------------------------------
// weight_logs — longitudinal weight record (migration 0001). User-owned core
// data: RLS owner-all, append-only (no updated_at). Mirrors meals.ts — THROWS on
// real failure so the caller can tell the user the write didn't land.
// ---------------------------------------------------------------------------

export interface WeightLogRow {
  id: string
  user_id: string
  weight_kg: number
  logged_at: string
  measured_at: string | null // 'YYYY-MM-DD' (the day the weight applies to) or null
  notes: string | null
  source: string
  created_at: string
}

/** What a caller supplies to log a weight (camelCase; macros already numeric). */
export interface WeightLogInput {
  weightKg: number
  measuredAt?: string // 'YYYY-MM-DD'
  notes?: string
}

// PostgREST may return `numeric` as a string → coerce.
function num(v: unknown): number {
  return Number(v)
}

function mapWeightLogRow(r: Record<string, unknown>): WeightLogRow {
  return {
    id: r.id as string,
    user_id: r.user_id as string,
    weight_kg: num(r.weight_kg),
    logged_at: r.logged_at as string,
    measured_at: (r.measured_at as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    source: r.source as string,
    created_at: r.created_at as string,
  }
}

/**
 * Insert one weight measurement, stamped with user_id (RLS with-check requires
 * it). source defaults to 'manual'. Returns the inserted row; throws on error.
 */
export async function insertWeightLog(
  userId: string,
  input: WeightLogInput,
): Promise<WeightLogRow> {
  const supabase = createClient()

  const row: Record<string, unknown> = {
    user_id: userId,
    weight_kg: input.weightKg,
    source: 'manual',
  }
  if (input.measuredAt) row.measured_at = input.measuredAt
  if (input.notes != null) row.notes = input.notes

  const { data, error } = await supabase
    .from('weight_logs')
    .insert(row)
    .select('*')
    .single()
  if (error || !data) {
    throw new Error(`insertWeightLog failed: ${error?.message ?? 'no row returned'}`)
  }
  return mapWeightLogRow(data as Record<string, unknown>)
}

/**
 * The latest N weight logs, newest first. Orders by measured_at desc (nulls last)
 * then logged_at desc as a tie-break / fallback for rows without a measured day.
 * RLS-scoped; throws on real error.
 */
export async function getWeightLogs(userId: string, limit = 14): Promise<WeightLogRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('weight_logs')
    .select('*')
    .eq('user_id', userId)
    .order('measured_at', { ascending: false, nullsFirst: false })
    .order('logged_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`getWeightLogs failed: ${error.message}`)
  return ((data ?? []) as Record<string, unknown>[]).map(mapWeightLogRow)
}

/** The single most recent weight log, or null if none. */
export async function getLatestWeight(userId: string): Promise<WeightLogRow | null> {
  const logs = await getWeightLogs(userId, 1)
  return logs[0] ?? null
}
