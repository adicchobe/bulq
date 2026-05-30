import { createClient } from './server'
import { computeCostUsd } from '@/lib/ai/pricing'

export interface LogApiUsageInput {
  userId: string
  provider: 'gemini' | 'anthropic'
  model: string
  priority?: 'standard' | 'high_stakes' | null
  operation?: string | null // 'chat','parse','reason','compose'
  promptTokens?: number | null
  completionTokens?: number | null
  totalTokens?: number | null
  finishReason?: string | null
  success: boolean
  errorType?: string | null // 'rate_limit','timeout','server_error','auth','other'
  failedOver?: boolean
  latencyMs?: number | null
}

/**
 * Records one LLM call into api_usage_log. FIRE-AND-FORGET: any failure is
 * logged and swallowed — usage logging must NEVER throw into or break the caller
 * (a failed log must not break a chat reply).
 */
export async function logApiUsage(input: LogApiUsageInput): Promise<void> {
  try {
    const { costUsd, rateKnown } = computeCostUsd(
      input.model,
      input.promptTokens ?? 0,
      input.completionTokens ?? 0,
    )

    // If the model isn't in the pricing table we still log (cost 0), but flag it
    // so an unpriced model is queryable rather than silently counted as free.
    // Only on a SUCCESS with no existing error_type — never clobber a real error.
    let errorType = input.errorType ?? null
    if (input.success && !rateKnown && errorType === null) {
      errorType = 'unpriced_model'
    }

    const supabase = createClient()
    const { error } = await supabase.from('api_usage_log').insert({
      user_id: input.userId,
      provider: input.provider,
      model: input.model,
      priority: input.priority ?? null,
      operation: input.operation ?? null,
      prompt_tokens: input.promptTokens ?? null,
      completion_tokens: input.completionTokens ?? null,
      total_tokens: input.totalTokens ?? null,
      estimated_cost_usd: costUsd,
      finish_reason: input.finishReason ?? null,
      success: input.success,
      error_type: errorType,
      failed_over: input.failedOver ?? false,
      latency_ms: input.latencyMs ?? null,
    })

    if (error) {
      console.error(`logApiUsage insert failed: ${error.message}`)
    }
  } catch (err) {
    console.error('logApiUsage threw (swallowed):', err)
  }
}

/**
 * Lifetime Anthropic spend for a user (sum of estimated_cost_usd where
 * provider='anthropic'). FAIL-OPEN: on any read error return 0, so a single
 * query failure never blocks a call — the runaway-spend case is what the budget
 * guard protects, and spend keeps being logged regardless. RLS scopes the read.
 */
export async function getAnthropicSpendUsd(userId: string): Promise<number> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('api_usage_log')
      .select('estimated_cost_usd')
      .eq('user_id', userId)
      .eq('provider', 'anthropic')
    if (error) {
      console.error(`getAnthropicSpendUsd failed: ${error.message}`)
      return 0 // fail-open
    }
    const rows = (data ?? []) as { estimated_cost_usd: number | string | null }[]
    return rows.reduce((sum, r) => sum + Number(r.estimated_cost_usd ?? 0), 0)
  } catch (err) {
    console.error('getAnthropicSpendUsd threw (swallowed):', err)
    return 0 // fail-open
  }
}
