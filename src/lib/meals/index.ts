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
export { classifyMealIntent, extractIntent, isObviousQuestion } from './intent'
export { estimateUnknownFoods, parseEstimates } from './estimate'
export type { MealIntent } from './intent'
export { buildProposal } from './proposal'
export type { MealProposal, MealProposalItem } from './proposal'
export { istDayRangeUtc, istNowLabel, computeTodaySummary, getTodaySummary } from './summary'
export type { TodaySummary, TodayMeal } from './summary'
