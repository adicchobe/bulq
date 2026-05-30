import type { FoodRow } from '@/lib/db/foods'
import type { UnitRow } from '@/lib/db/units'
import type { MealItemInput } from '@/lib/db/meals'
import type { ParsedItem } from './types'
import type { FoodMatch } from './match'

export interface GramsRange {
  grams_min: number
  grams_typical: number
  grams_max: number
}

export interface ResolvedPortion extends GramsRange {
  unit_key: string | null // null = unresolved (fallback band used)
}

export interface ItemMacros {
  kcal_min: number
  kcal_typical: number
  kcal_max: number
  protein_g: number
  fat_g: number
  carb_g: number
  fiber_g: number
}

// Fallback when no unit can be resolved: 100g typical with a WIDE band, so the
// uncertainty is surfaced (not hidden). unit_key null flags it (→ lower confidence in 4c).
const FALLBACK_PORTION: ResolvedPortion = {
  unit_key: null,
  grams_min: 50,
  grams_typical: 100,
  grams_max: 200,
}

function nameHas(food: FoodRow, ...keywords: string[]): boolean {
  const n = food.name.toLowerCase()
  return keywords.some((k) => n.includes(k))
}

/**
 * Map a food (+ optional unit hint) to a units.unit_key, or null when there's no
 * natural unit (→ fallback). The FOOD is the reliable signal (it disambiguates
 * "katori of dal" vs "katori of rice"); unit_raw only overrides the genuinely
 * ambiguous grain case ("plate" upgrades a katori to a full plate). variance_class
 * is NOT used here — it's a confidence input for 4c only.
 */
export function pickUnitKey(food: FoodRow, unitRaw: string | null): string | null {
  const u = unitRaw?.toLowerCase().trim() ?? null
  const cat = food.category

  let key: string | null = null
  if (cat === 'grain') {
    if (nameHas(food, 'paratha')) key = 'paratha'
    else if (nameHas(food, 'roti', 'chapati', 'phulka')) key = 'chapati'
    else if (nameHas(food, 'biryani', 'pulao', 'pulav')) key = 'plate_biryani'
    else if (nameHas(food, 'poha', 'upma')) key = 'katori_poha_upma'
    else if (nameHas(food, 'rice')) key = 'katori_rice'
  } else if (cat === 'dal_legume') {
    key = nameHas(food, 'rajma', 'chole', 'chhole', 'chana masala')
      ? 'katori_gravy'
      : 'katori_dal'
  } else if (cat === 'vegetable') {
    key = nameHas(food, 'palak paneer') ? 'katori_gravy' : 'katori_sabzi'
  } else if (cat === 'dairy_paneer') {
    if (nameHas(food, 'milk')) key = 'glass_milk'
    else if (nameHas(food, 'curd', 'dahi')) key = 'cup_curd'
    else if (nameHas(food, 'paneer')) key = 'paneer_serving'
  } else if (cat === 'non_veg') {
    if (nameHas(food, 'egg')) key = 'egg_large'
    // chicken etc. → null (fallback; logged by weight, no household unit)
  } else if (cat === 'supplement') {
    if (nameHas(food, 'whey')) key = 'scoop_whey'
    else if (nameHas(food, 'chia')) key = 'tbsp_chia'
    // soya chunks → null (fallback)
  } else if (cat === 'fruit') {
    if (nameHas(food, 'banana')) key = 'banana_medium'
  } else if (cat === 'beverage') {
    if (nameHas(food, 'chai', 'tea', 'coffee')) key = 'cup_chai'
  }

  // An explicit "plate" upgrades a grain katori to a full plate.
  if (u === 'plate' && cat === 'grain') key = 'plate_biryani'

  return key
}

/**
 * Resolve the PER-UNIT grams range for an item (NOT × quantity — quantity is
 * applied once, in computeItemMacros). Falls back to a wide 100g (50–200) band
 * with unit_key null when no unit can be resolved.
 */
export function resolveGrams(
  parsedItem: ParsedItem,
  food: FoodRow,
  units: UnitRow[],
): ResolvedPortion {
  const key = pickUnitKey(food, parsedItem.unit_raw)
  if (key) {
    const unit = units.find((un) => un.unit_key === key)
    if (unit) {
      return {
        unit_key: key,
        grams_min: unit.grams_min,
        grams_typical: unit.grams_typical,
        grams_max: unit.grams_max,
      }
    }
  }
  return { ...FALLBACK_PORTION }
}

const round0 = (n: number): number => Math.round(n)
const round1 = (n: number): number => Math.round(n * 10) / 10

/**
 * Per-item macro band. Quantity is applied EXACTLY ONCE here (factor = qty/100).
 * kcal compounds the stored composition band (food.kcal_min/typical/max, already
 * source/prep-derived) with the portion band (grams_min/typical/max). protein/
 * fat/carb/fiber are point estimates at grams_typical (schema has no macro band).
 * Round only at the end.
 */
export function computeItemMacros(
  food: FoodRow,
  grams: GramsRange,
  quantity: number,
): ItemMacros {
  const factor = quantity / 100
  return {
    kcal_min: round0(food.kcal_min * grams.grams_min * factor),
    kcal_typical: round0(food.kcal_typical * grams.grams_typical * factor),
    kcal_max: round0(food.kcal_max * grams.grams_max * factor),
    protein_g: round1(food.protein_g * grams.grams_typical * factor),
    fat_g: round1(food.fat_g * grams.grams_typical * factor),
    carb_g: round1(food.carb_g * grams.grams_typical * factor),
    fiber_g: round1(food.fiber_g * grams.grams_typical * factor),
  }
}

/**
 * Turn a parsed item + its food match into a MealItemInput. A matched food gets
 * grams + the computed macro band; an UNKNOWN food gets nulls everywhere (no
 * fabrication — computeMealTotals treats null as 0 → conservative lower bound).
 */
export function buildMealItem(
  parsedItem: ParsedItem,
  foodMatch: FoodMatch,
  units: UnitRow[],
): MealItemInput {
  if (foodMatch.method === 'unknown') {
    return {
      food_id: null,
      food_name_raw: parsedItem.food_name_raw,
      matched_food_name: null,
      quantity: parsedItem.quantity,
      unit_key: null,
      grams_used: null,
      match_method: 'unknown',
      kcal_min: null,
      kcal_typical: null,
      kcal_max: null,
      protein_g: null,
      fat_g: null,
      carb_g: null,
      fiber_g: null,
    }
  }

  const food = foodMatch.food
  const portion = resolveGrams(parsedItem, food, units)
  const macros = computeItemMacros(food, portion, parsedItem.quantity)
  return {
    food_id: food.id,
    food_name_raw: parsedItem.food_name_raw,
    matched_food_name: food.name,
    quantity: parsedItem.quantity,
    unit_key: portion.unit_key,
    grams_used: round0(portion.grams_typical * parsedItem.quantity), // total grams eaten
    match_method: foodMatch.method,
    ...macros,
  }
}
