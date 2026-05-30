import { createClient } from './server'

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
export type FoodSourceType = 'IFCT2017' | 'USDA' | 'INDB' | 'brand_label' | 'derived'

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

function mapFoodRow(r: Record<string, unknown>): FoodRow {
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
