export { parseMealText, extractParsedMeal } from './parse'
export { ParsedItemSchema, ParsedMealSchema } from './types'
export type { ParsedItem, ParsedMeal, ParseResult } from './types'
export { matchFood, normalizeFoodName } from './match'
export type { FoodMatch } from './match'
export { pickUnitKey, resolveGrams, computeItemMacros, buildMealItem } from './portion'
export type { GramsRange, ResolvedPortion, ItemMacros } from './portion'
export {
  assembleMeal,
  assembleParsedMeal,
  assembleMealItems,
  computeItemConfidence,
  worstConfidence,
} from './assemble'
export type { MealAssembly } from './assemble'
export { isObviousQuestion } from './intent'
export { classifyAndParse, deriveClassifyParse } from './classify-parse'
export type { ClassifyParseResult } from './classify-parse'
export { estimateUnknownFoods, parseEstimates } from './estimate'
export { buildProposal } from './proposal'
export type { MealProposal, MealProposalItem } from './proposal'
export { istDayRangeUtc, istNowLabel, computeTodaySummary, getTodaySummary } from './summary'
export type { TodaySummary, TodayMeal } from './summary'
