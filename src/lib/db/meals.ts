import { createClient } from './server'

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'unknown'
export type MealConfidence = 'high' | 'medium' | 'low'
export type MealStatus = 'pending' | 'confirmed' | 'rejected'
export type MatchMethod = 'exact' | 'alias' | 'fuzzy' | 'llm_inferred' | 'unknown'

// ---------------------------------------------------------------------------
// Inputs (app-side; macros are number|null, already numeric — no DB coercion).
// ---------------------------------------------------------------------------
export interface MealItemInput {
  food_id: string | null
  food_name_raw: string
  matched_food_name: string | null
  quantity: number
  unit_key: string | null
  grams_used: number | null
  match_method: MatchMethod
  kcal_min: number | null
  kcal_typical: number | null
  kcal_max: number | null
  protein_g: number | null
  fat_g: number | null
  carb_g: number | null
  fiber_g: number | null
}

export interface MealInput {
  logged_at?: Date // optional → DB now()
  raw_text: string | null
  meal_type: MealType | null
  note: string | null
  confidence: MealConfidence | null
  items: MealItemInput[]
}

// ---------------------------------------------------------------------------
// Row shapes (as stored / returned).
// ---------------------------------------------------------------------------
export interface MealRow {
  id: string
  user_id: string
  logged_at: string
  raw_text: string | null
  meal_type: MealType | null
  note: string | null
  kcal_min: number | null
  kcal_typical: number | null
  kcal_max: number | null
  protein_g: number | null
  fat_g: number | null
  carb_g: number | null
  fiber_g: number | null
  confidence: MealConfidence | null
  status: MealStatus
  created_at: string
  updated_at: string
}

export interface MealItemRow {
  id: string
  meal_id: string
  user_id: string
  food_id: string | null
  food_name_raw: string
  matched_food_name: string | null
  quantity: number
  unit_key: string | null
  grams_used: number | null
  match_method: MatchMethod | null
  kcal_min: number | null
  kcal_typical: number | null
  kcal_max: number | null
  protein_g: number | null
  fat_g: number | null
  carb_g: number | null
  fiber_g: number | null
  created_at: string
}

export type MealWithItems = MealRow & { items: MealItemRow[] }

export interface MacroTotals {
  kcal_min: number
  kcal_typical: number
  kcal_max: number
  protein_g: number
  fat_g: number
  carb_g: number
  fiber_g: number
}

/**
 * Field-wise SUM of item macros, treating null as 0.
 *
 * An unknown item (null macros) contributes 0, so the total is a conservative
 * LOWER bound (pillar #3 — under-count for a gainer rather than over). The meal's
 * `confidence` (passed separately, worst-item rule) captures that incompleteness.
 * Enforces the invariant: stored meal totals === sum of stored items.
 */
export function computeMealTotals(items: MealItemInput[]): MacroTotals {
  const total: MacroTotals = {
    kcal_min: 0,
    kcal_typical: 0,
    kcal_max: 0,
    protein_g: 0,
    fat_g: 0,
    carb_g: 0,
    fiber_g: 0,
  }
  for (const item of items) {
    total.kcal_min += item.kcal_min ?? 0
    total.kcal_typical += item.kcal_typical ?? 0
    total.kcal_max += item.kcal_max ?? 0
    total.protein_g += item.protein_g ?? 0
    total.fat_g += item.fat_g ?? 0
    total.carb_g += item.carb_g ?? 0
    total.fiber_g += item.fiber_g ?? 0
  }
  return total
}

// ---------------------------------------------------------------------------
// Mappers — coerce numeric columns with Number() (PostgREST may return strings).
// ---------------------------------------------------------------------------
function num(v: unknown): number | null {
  return v === null || v === undefined ? null : Number(v)
}

function mapMealRow(r: Record<string, unknown>): MealRow {
  return {
    id: r.id as string,
    user_id: r.user_id as string,
    logged_at: r.logged_at as string,
    raw_text: (r.raw_text as string | null) ?? null,
    meal_type: (r.meal_type as MealType | null) ?? null,
    note: (r.note as string | null) ?? null,
    kcal_min: num(r.kcal_min),
    kcal_typical: num(r.kcal_typical),
    kcal_max: num(r.kcal_max),
    protein_g: num(r.protein_g),
    fat_g: num(r.fat_g),
    carb_g: num(r.carb_g),
    fiber_g: num(r.fiber_g),
    confidence: (r.confidence as MealConfidence | null) ?? null,
    status: r.status as MealStatus,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  }
}

function mapMealItemRow(r: Record<string, unknown>): MealItemRow {
  return {
    id: r.id as string,
    meal_id: r.meal_id as string,
    user_id: r.user_id as string,
    food_id: (r.food_id as string | null) ?? null,
    food_name_raw: r.food_name_raw as string,
    matched_food_name: (r.matched_food_name as string | null) ?? null,
    quantity: Number(r.quantity),
    unit_key: (r.unit_key as string | null) ?? null,
    grams_used: num(r.grams_used),
    match_method: (r.match_method as MatchMethod | null) ?? null,
    kcal_min: num(r.kcal_min),
    kcal_typical: num(r.kcal_typical),
    kcal_max: num(r.kcal_max),
    protein_g: num(r.protein_g),
    fat_g: num(r.fat_g),
    carb_g: num(r.carb_g),
    fiber_g: num(r.fiber_g),
    created_at: r.created_at as string,
  }
}

// ---------------------------------------------------------------------------
// Functions. CORE USER DATA — these THROW on real failure (not fail-safe-silent),
// so the caller can tell the user the meal didn't save. RLS with-check requires
// user_id stamped on the meal AND every item.
// ---------------------------------------------------------------------------

/**
 * Insert a proposed meal + its items. Status is always 'pending' here — the
 * pipeline proposes; the user confirms later via setMealStatus. Meal totals are
 * computed from the items (invariant: totals === sum of items).
 */
export async function insertMeal(
  userId: string,
  input: MealInput,
): Promise<MealWithItems> {
  const supabase = createClient()
  const totals = computeMealTotals(input.items)

  // 1 + 2. Insert the meal row (logged_at omitted → DB now()).
  const mealInsert: Record<string, unknown> = {
    user_id: userId,
    raw_text: input.raw_text,
    meal_type: input.meal_type,
    note: input.note,
    ...totals,
    confidence: input.confidence,
    status: 'pending',
  }
  if (input.logged_at) mealInsert.logged_at = input.logged_at.toISOString()

  const { data: mealData, error: mealError } = await supabase
    .from('meals')
    .insert(mealInsert)
    .select('*')
    .single()
  if (mealError || !mealData) {
    throw new Error(`insertMeal: meal insert failed: ${mealError?.message ?? 'no row returned'}`)
  }
  const meal = mapMealRow(mealData as Record<string, unknown>)

  // 3. Insert items in ONE batch, each stamped meal_id + user_id.
  let items: MealItemRow[] = []
  if (input.items.length > 0) {
    const itemRows = input.items.map((it) => ({
      meal_id: meal.id,
      user_id: userId,
      food_id: it.food_id,
      food_name_raw: it.food_name_raw,
      matched_food_name: it.matched_food_name,
      quantity: it.quantity,
      unit_key: it.unit_key,
      grams_used: it.grams_used,
      match_method: it.match_method,
      kcal_min: it.kcal_min,
      kcal_typical: it.kcal_typical,
      kcal_max: it.kcal_max,
      protein_g: it.protein_g,
      fat_g: it.fat_g,
      carb_g: it.carb_g,
      fiber_g: it.fiber_g,
    }))

    const { data: itemData, error: itemError } = await supabase
      .from('meal_items')
      .insert(itemRows)
      .select('*')
    if (itemError) {
      // 4. No REST transaction in Supabase JS — best-effort rollback of the
      // orphan meal so we don't leave a meal with no items. Pragmatic POC.
      await supabase.from('meals').delete().eq('id', meal.id).eq('user_id', userId)
      throw new Error(`insertMeal: items insert failed (meal rolled back): ${itemError.message}`)
    }
    items = (itemData ?? []).map((row) => mapMealItemRow(row as Record<string, unknown>))
  }

  // 5. Return meal + items.
  return { ...meal, items }
}

/** Fetch a meal + its items (oldest-first). null if not found; throws on real error. */
export async function getMealById(
  userId: string,
  mealId: string,
): Promise<MealWithItems | null> {
  const supabase = createClient()

  const { data: mealData, error: mealError } = await supabase
    .from('meals')
    .select('*')
    .eq('id', mealId)
    .eq('user_id', userId) // belt-and-suspenders alongside RLS
    .maybeSingle()
  if (mealError) throw new Error(`getMealById: meal fetch failed: ${mealError.message}`)
  if (!mealData) return null
  const meal = mapMealRow(mealData as Record<string, unknown>)

  const { data: itemData, error: itemError } = await supabase
    .from('meal_items')
    .select('*')
    .eq('meal_id', mealId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (itemError) throw new Error(`getMealById: items fetch failed: ${itemError.message}`)
  const items = (itemData ?? []).map((row) => mapMealItemRow(row as Record<string, unknown>))

  return { ...meal, items }
}

/** Update a meal's status (e.g. pending → confirmed / rejected). Throws on error. */
export async function setMealStatus(
  userId: string,
  mealId: string,
  status: MealStatus,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('meals')
    .update({ status })
    .eq('id', mealId)
    .eq('user_id', userId)
  if (error) throw new Error(`setMealStatus failed: ${error.message}`)
}
