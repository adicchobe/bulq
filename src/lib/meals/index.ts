export { parseMealText, extractParsedMeal } from './parse'
export { ParsedItemSchema, ParsedMealSchema } from './types'
export type { ParsedItem, ParsedMeal, ParseResult } from './types'
export { matchFood, normalizeFoodName } from './match'
export type { FoodMatch } from './match'
export { pickUnitKey, resolveGrams, computeItemMacros, buildMealItem } from './portion'
export type { GramsRange, ResolvedPortion, ItemMacros } from './portion'
export {
  assembleMeal,
  assembleMealItems,
  computeItemConfidence,
  worstConfidence,
} from './assemble'
export type { MealAssembly } from './assemble'
export { classifyMealIntent, extractIntent } from './intent'
export type { MealIntent } from './intent'
export { buildProposal } from './proposal'
export type { MealProposal, MealProposalItem } from './proposal'
export { istDayRangeUtc, computeTodaySummary, getTodaySummary } from './summary'
export type { TodaySummary } from './summary'
