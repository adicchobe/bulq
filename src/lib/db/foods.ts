import { createClient } from './server'
import { normalizeFoodName } from '@/lib/meals/match'

export type FoodCategory =
  | 'grain'
  | 'dal_legume'
  | 'dairy_paneer'
  | 'vegetable'
  | 'non_veg'
  | 'supplement'
  | 'fruit'
  | 'beverage'
  | 'composite'
export type FoodState = 'raw' | 'cooked'
export type VarianceClass = 'raw_ingredient' | 'cooked_single' | 'composite' | 'restaurant'
export type FoodSourceType =
  | 'IFCT2017'
  | 'USDA'
  | 'INDB'
  | 'brand_label'
  | 'derived'
  | 'user' // user-taught food ("teach your foods"); see migration 0011

/** A row of the `foods` table. Per-100g macros are NOT NULL in the schema. */
export interface FoodRow {
  id: string
  user_id: string | null // null = system/global row
  name: string
  aliases: string[]
  category: FoodCategory
  state: FoodState
  variance_class: VarianceClass
  kcal_typical: number
  kcal_min: number
  kcal_max: number
  protein_g: number
  fat_g: number
  carb_g: number
  fiber_g: number
  source_type: FoodSourceType
  source_ref: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

function num(v: unknown): number {
  return Number(v)
}

export function mapFoodRow(r: Record<string, unknown>): FoodRow {
  return {
    id: r.id as string,
    user_id: (r.user_id as string | null) ?? null,
    name: r.name as string,
    aliases: (r.aliases as string[] | null) ?? [],
    category: r.category as FoodCategory,
    state: r.state as FoodState,
    variance_class: r.variance_class as VarianceClass,
    kcal_typical: num(r.kcal_typical),
    kcal_min: num(r.kcal_min),
    kcal_max: num(r.kcal_max),
    protein_g: num(r.protein_g),
    fat_g: num(r.fat_g),
    carb_g: num(r.carb_g),
    fiber_g: num(r.fiber_g),
    source_type: r.source_type as FoodSourceType,
    source_ref: (r.source_ref as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  }
}

/**
 * All foods visible to this user: system rows (user_id IS NULL) + the user's own
 * custom rows. RLS enforces the same set; the explicit .or makes the intent clear
 * (belt-and-suspenders). One query per meal; the matcher works in-memory against
 * this list — fine for ~60 foods. At scale, push matching into Postgres via
 * pg_trgm similarity + the foods.aliases GIN index instead of fetching all rows.
 */
export async function getMatchableFoods(userId: string): Promise<FoodRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('foods')
    .select('*')
    .or(`user_id.is.null,user_id.eq.${userId}`)
  if (error) throw new Error(`getMatchableFoods failed: ${error.message}`)
  return ((data ?? []) as Record<string, unknown>[]).map(mapFoodRow)
}

// ---- user-taught foods ("teach your foods") -------------------------------

/**
 * What the user tells us when teaching a food. Macros are PER SERVING; we
 * back-calculate the table's per-100g figures from `servingGrams` (default 100,
 * i.e. the per-serving values ARE the per-100g values).
 */
export interface UserFoodInput {
  name: string
  proteinPerServing: number
  kcalPerServing?: number
  servingGrams?: number
}

/**
 * PURE. Convert a per-serving teach-input to the foods table's per-100g band.
 * If kcal is given, the band collapses to a single point (we trust the user's
 * number). If not, we estimate a conservative band from protein alone:
 * 4 kcal/g protein (floor) → 6 (typical, assumes some carb/fat) → 8 (generous).
 */
function deriveFoodMacros(input: UserFoodInput): {
  protein_g: number
  kcal_min: number
  kcal_typical: number
  kcal_max: number
} {
  const servingGrams = input.servingGrams ?? 100
  if (!(servingGrams > 0)) throw new Error('servingGrams must be > 0')

  const protein_g = (input.proteinPerServing * 100) / servingGrams

  if (input.kcalPerServing != null) {
    const k = (input.kcalPerServing * 100) / servingGrams
    return { protein_g, kcal_min: k, kcal_typical: k, kcal_max: k }
  }
  return {
    protein_g,
    kcal_min: protein_g * 4, // protein-only floor
    kcal_typical: protein_g * 6, // assumes some carbs/fat
    kcal_max: protein_g * 8, // generous upper
  }
}

/**
 * PURE. A provenance note recording the serving basis the user taught — but only
 * when it's a non-100g serving (otherwise per-serving == per-100g and the note
 * adds nothing). Returns null to clear the note in that case.
 */
function deriveFoodNotes(input: UserFoodInput): string | null {
  if (input.servingGrams == null || input.servingGrams === 100) return null
  const kcalPart = input.kcalPerServing != null ? `, ${input.kcalPerServing} kcal` : ''
  return `User-taught: ${input.proteinPerServing}g protein${kcalPart} per ${input.servingGrams}g serving`
}

/**
 * Create a user-taught food row (source_type 'user', owned by this user). Macros
 * are derived per-100g from the teach input; unknown macros default to 0 and the
 * food gets conservative composite/cooked defaults. RLS allows insert only when
 * user_id = auth.uid(); we stamp it here for clarity (belt-and-suspenders).
 */
export async function createUserFood(userId: string, input: UserFoodInput): Promise<FoodRow> {
  const { protein_g, kcal_min, kcal_typical, kcal_max } = deriveFoodMacros(input)

  const supabase = createClient()
  const { data, error } = await supabase
    .from('foods')
    .insert({
      user_id: userId,
      name: input.name,
      aliases: [],
      category: 'composite',
      state: 'cooked',
      variance_class: 'composite',
      kcal_typical,
      kcal_min,
      kcal_max,
      protein_g,
      fat_g: 0,
      carb_g: 0,
      fiber_g: 0,
      source_type: 'user',
      notes: deriveFoodNotes(input),
    })
    .select()
    .single()
  if (error) throw new Error(`createUserFood failed: ${error.message}`)
  return mapFoodRow(data as Record<string, unknown>)
}

/**
 * Edit a user-taught food: recompute per-100g macros from the new input and
 * update the row. Scoped to user_id = userId, so a user can never edit a system
 * row or another user's food (RLS enforces the same).
 */
export async function updateUserFood(
  foodId: string,
  userId: string,
  input: UserFoodInput,
): Promise<FoodRow> {
  const { protein_g, kcal_min, kcal_typical, kcal_max } = deriveFoodMacros(input)

  const supabase = createClient()
  const { data, error } = await supabase
    .from('foods')
    .update({
      name: input.name,
      protein_g,
      kcal_min,
      kcal_typical,
      kcal_max,
      notes: deriveFoodNotes(input),
    })
    .eq('id', foodId)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw new Error(`updateUserFood failed: ${error.message}`)
  return mapFoodRow(data as Record<string, unknown>)
}

/**
 * Append a normalized alias to a user-taught food, skipping it if an equivalent
 * alias (or the food's own name) already matches. Scoped to user_id = userId.
 * Returns the (possibly unchanged) row.
 */
export async function addAliasToUserFood(
  foodId: string,
  userId: string,
  alias: string,
): Promise<FoodRow> {
  const normalized = normalizeFoodName(alias)
  if (!normalized) throw new Error('addAliasToUserFood: empty alias')

  const supabase = createClient()
  const { data: existing, error: fetchErr } = await supabase
    .from('foods')
    .select('*')
    .eq('id', foodId)
    .eq('user_id', userId)
    .single()
  if (fetchErr) throw new Error(`addAliasToUserFood fetch failed: ${fetchErr.message}`)

  const row = mapFoodRow(existing as Record<string, unknown>)

  // Dedup against existing aliases AND the food name (all normalized).
  const taken = [row.name, ...row.aliases].map(normalizeFoodName)
  if (taken.includes(normalized)) return row // nothing to add

  const { data, error } = await supabase
    .from('foods')
    .update({ aliases: [...row.aliases, normalized] })
    .eq('id', foodId)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw new Error(`addAliasToUserFood failed: ${error.message}`)
  return mapFoodRow(data as Record<string, unknown>)
}
