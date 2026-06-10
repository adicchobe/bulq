import { tool, type CoreTool } from 'ai'
import { z } from 'zod'
import { assembleMeal, estimateUnknownFoods, getTodaySummary } from '@/lib/meals'
import { searchKnowledge } from '@/lib/rag/search'
import { insertWeightLog, getWeightLogs } from '@/lib/db/weight-logs'
import { createUserFood, getMatchableFoods } from '@/lib/db/foods'
import { getProfile } from '@/lib/db/profiles'
import { weeklyRateOfChange, interpretTrend } from '@/lib/nutrition'

// Tools wrap the EXISTING deterministic business logic — the agent decides WHICH
// to call, but the numbers come from the sourced pipeline, not the model (pillar
// #1). Every execute is fail-safe: it returns { error } rather than throwing, so a
// failure becomes something the agent can explain instead of a 500.

const errMsg = (err: unknown): string => (err instanceof Error ? err.message : String(err))
const round2 = (n: number): number => Math.round(n * 100) / 100

/**
 * Build the agent's tool set with `userId` bound via closure (the tools never
 * trust a model-supplied user id — it comes from the authenticated session).
 */
export function createAgentTools(userId: string): Record<string, CoreTool> {
  return {
    // a. Parse + price a reported meal. Does NOT persist — the route handles the
    //    insert + confirmation card; this returns a summary for the agent to relay.
    log_meal: tool({
      description:
        'Log a meal the user reports eating. Parses their free text into food items with sourced nutrition numbers (estimating any unknown foods). Returns an item summary that still needs the user to confirm — it does NOT save the meal itself.',
      parameters: z.object({
        text: z
          .string()
          .describe('What the user ate, in their words (e.g. "2 rotis and a katori of dal").'),
      }),
      execute: async ({ text }) => {
        try {
          const assembled = await assembleMeal(userId, text)
          if (!assembled.ok) return { ok: false, reason: assembled.reason }
          const items = await estimateUnknownFoods(assembled.mealInput.items, userId)
          return {
            ok: true,
            needs_confirmation: true,
            items: items.map((it) => ({
              name: it.matched_food_name ?? it.food_name_raw,
              quantity: it.quantity,
              kcal_min: it.kcal_min,
              kcal_typical: it.kcal_typical,
              kcal_max: it.kcal_max,
              protein_g: it.protein_g,
            })),
          }
        } catch (err) {
          return { error: errMsg(err) }
        }
      },
    }),

    // b. Today's intake vs target (IST day).
    get_day_state: tool({
      description:
        "Get the user's intake so far today (IST): calories and protein consumed, what's remaining against their target, and the list of meals logged today.",
      parameters: z.object({}),
      execute: async () => {
        try {
          const s = await getTodaySummary(userId)
          return {
            consumed: s.consumed,
            target: s.target,
            remaining: s.remaining,
            mealCount: s.mealCount,
            meals: s.meals.map((m) => ({ rawText: m.rawText, mealType: m.mealType })),
          }
        } catch (err) {
          return { error: errMsg(err) }
        }
      },
    }),

    // c. Sourced retrieval over the trusted knowledge base.
    search_knowledge: tool({
      description:
        'Search the trusted nutrition knowledge base (ICMR-NIN, Examine, PMC, etc.) for sourced information to answer a nutrition or health question. Returns the most relevant passages with their source titles — cite the source when you use them.',
      parameters: z.object({
        query: z.string().describe('The nutrition/health question or topic to look up.'),
      }),
      execute: async ({ query }) => {
        try {
          const chunks = await searchKnowledge(query, 5)
          return {
            chunks: chunks.map((c) => ({
              content: c.content,
              source_title: c.source_title,
              source_ref: c.source_ref,
              source_tier: c.source_tier,
            })),
          }
        } catch (err) {
          return { error: errMsg(err) }
        }
      },
    }),

    // d. Record a body-weight measurement.
    log_weight: tool({
      description: "Record the user's body weight in kilograms for today.",
      parameters: z.object({
        weightKg: z.number().positive().describe('Body weight in kilograms.'),
      }),
      execute: async ({ weightKg }) => {
        try {
          const row = await insertWeightLog(userId, { weightKg })
          return { ok: true, weightKg: row.weight_kg }
        } catch (err) {
          return { error: errMsg(err) }
        }
      },
    }),

    // e. Create a custom (user-taught) food.
    teach_food: tool({
      description:
        'Create a custom food the user defines, with their per-serving protein and (optionally) calories and serving size. Use when the user tells Bulq the nutrition of a food it does not already know.',
      parameters: z.object({
        name: z.string().describe('The food name.'),
        proteinPerServing: z.number().nonnegative().describe('Protein per serving, in grams.'),
        kcalPerServing: z.number().nonnegative().optional().describe('Calories per serving (optional).'),
        servingGrams: z.number().positive().optional().describe('Serving size in grams (default 100).'),
      }),
      execute: async (input) => {
        try {
          const food = await createUserFood(userId, input)
          return { ok: true, foodName: food.name }
        } catch (err) {
          return { error: errMsg(err) }
        }
      },
    }),

    // f. Weight-trend analysis vs goal.
    get_weight_trend: tool({
      description:
        "Analyze the user's recent weight logs: weekly rate of change, direction, and whether they're on track for their goal. Needs ~2 weeks of data.",
      parameters: z.object({}),
      execute: async () => {
        try {
          const logs = await getWeightLogs(userId, 30)
          const trendLogs = logs.map((l) => ({
            weight_kg: l.weight_kg,
            measured_at: l.measured_at ?? l.logged_at,
          }))
          const rate = weeklyRateOfChange(trendLogs)
          if (!rate) {
            return {
              ok: true,
              hasTrend: false,
              message: 'Not enough weight data yet — log for 2+ weeks to see a trend.',
            }
          }
          const profile = await getProfile(userId)
          const goal =
            profile?.goal_direction === 'gain'
              ? 'gain'
              : profile?.goal_direction === 'lose'
                ? 'loss'
                : null
          const interp = goal ? interpretTrend(rate, goal) : null
          return {
            ok: true,
            hasTrend: true,
            rateKgPerWeek: round2(rate.rateKgPerWeek),
            ratePercentPerWeek: round2(rate.ratePercentPerWeek),
            direction: rate.direction,
            status: interp?.status ?? null,
            message: interp?.message ?? null,
          }
        } catch (err) {
          return { error: errMsg(err) }
        }
      },
    }),

    // g. Protein-dense food suggestions for the remaining day.
    suggest_meals: tool({
      description:
        "Suggest foods from the user's database to help hit their remaining calorie and protein targets for the day. Returns real per-100g values, ranked by protein density — combine them into realistic Indian meals.",
      parameters: z.object({
        remainingKcal: z.number().describe('Calories left for the day.'),
        remainingProtein: z.number().describe('Protein (g) left for the day.'),
      }),
      execute: async ({ remainingKcal, remainingProtein }) => {
        try {
          const foods = await getMatchableFoods(userId)
          const suggestions = foods
            .filter((f) => f.kcal_typical > 0)
            // protein density = protein per kcal (more protein per calorie first).
            .sort((a, b) => b.protein_g / b.kcal_typical - a.protein_g / a.kcal_typical)
            .slice(0, 8)
            .map((f) => ({
              name: f.name,
              kcal_typical: f.kcal_typical,
              protein_g: f.protein_g,
              category: f.category,
            }))
          return { remainingKcal, remainingProtein, suggestions }
        } catch (err) {
          return { error: errMsg(err) }
        }
      },
    }),
  }
}
