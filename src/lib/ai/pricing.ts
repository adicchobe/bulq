/**
 * Single source of truth for LLM cost math (R3 — the $4.51 Anthropic balance).
 *
 * Rates are STANDARD list prices (no prompt-caching, batch, or region discounts),
 * so estimates may run slightly HIGH — the safe direction for a budget guard: it
 * never UNDER-counts spend. Verified May 2026 from Anthropic's published pricing.
 *
 * Gemini is free-tier ($0), so its dollar figure is always 0 regardless of tokens.
 * Note (R11): Gemini token counts can under-read because hidden "thinking" tokens
 * aren't surfaced — but since the rate is $0, the cost figure here is unaffected.
 */

export interface ModelRate {
  /** USD per 1,000,000 input (prompt) tokens. */
  inputPerMillion: number
  /** USD per 1,000,000 output (completion) tokens. */
  outputPerMillion: number
}

/** Keyed by the EXACT model id the adapter passes (see src/lib/ai/adapter.ts). */
export const MODEL_RATES: Record<string, ModelRate> = {
  // Anthropic (paid — draws down the $4.51 balance).
  'claude-haiku-4-5-20251001': { inputPerMillion: 1.0, outputPerMillion: 5.0 },
  'claude-sonnet-4-6': { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  // Google Gemini (free tier).
  'gemini-2.5-flash': { inputPerMillion: 0, outputPerMillion: 0 },
}

const TOKENS_PER_MILLION = 1_000_000

/** Coerce possibly-null/NaN token counts to a safe non-negative number. */
function safeTokens(n: number | null | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Cost of one call. Returns rateKnown:false (and costUsd:0) for any model not in
 * the table — we never GUESS a rate (pillar #1). The caller can log rateKnown.
 */
export function computeCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): { costUsd: number; rateKnown: boolean } {
  const rate = MODEL_RATES[model]
  if (!rate) return { costUsd: 0, rateKnown: false }

  const p = safeTokens(promptTokens)
  const c = safeTokens(completionTokens)
  const costUsd =
    (p * rate.inputPerMillion + c * rate.outputPerMillion) / TOKENS_PER_MILLION

  return { costUsd, rateKnown: true }
}

// =====================================================================
// Budget constants — for the spend guard and usage tracker (R3).
// =====================================================================
export const ANTHROPIC_BUDGET_USD = 4.51

export const BUDGET_AMBER_PCT = 0.7
export const BUDGET_RED_PCT = 0.9
export const BUDGET_HARD_STOP_PCT = 0.95

/**
 * Display-only reference for the usage page. Google's free Gemini Flash
 * requests-per-day varies by account/region and changed Dec 2025 — the
 * authoritative number is in the user's Google AI Studio console. Used ONLY as
 * a UI comparison figure; never for gating.
 */
export const GEMINI_FREE_RPD_APPROX = 250

/** Dollar thresholds derived from the budget — convenience for the guard. */
export const BUDGET_AMBER_USD = ANTHROPIC_BUDGET_USD * BUDGET_AMBER_PCT
export const BUDGET_RED_USD = ANTHROPIC_BUDGET_USD * BUDGET_RED_PCT
export const BUDGET_HARD_STOP_USD = ANTHROPIC_BUDGET_USD * BUDGET_HARD_STOP_PCT
