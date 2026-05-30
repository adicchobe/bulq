import { createClient } from './server'

/** A row of the `units` table (portion → grams). */
export interface UnitRow {
  id: string
  user_id: string | null // null = system/global row
  unit_key: string
  label: string
  grams_typical: number
  grams_min: number
  grams_max: number
  source_ref: string | null
  notes: string | null
  created_at: string
}

function num(v: unknown): number {
  return Number(v)
}

function mapUnitRow(r: Record<string, unknown>): UnitRow {
  return {
    id: r.id as string,
    user_id: (r.user_id as string | null) ?? null,
    unit_key: r.unit_key as string,
    label: r.label as string,
    grams_typical: num(r.grams_typical),
    grams_min: num(r.grams_min),
    grams_max: num(r.grams_max),
    source_ref: (r.source_ref as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    created_at: r.created_at as string,
  }
}

/**
 * All units visible to this user: system rows (user_id IS NULL) + the user's own.
 * Mirrors getMatchableFoods — RLS enforces the same set; the explicit .or makes
 * intent clear. Server-only; throws on real error.
 */
export async function getUnits(userId: string): Promise<UnitRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('units')
    .select('*')
    .or(`user_id.is.null,user_id.eq.${userId}`)
  if (error) throw new Error(`getUnits failed: ${error.message}`)
  return ((data ?? []) as Record<string, unknown>[]).map(mapUnitRow)
}
