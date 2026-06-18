import { generateText, streamText, type CoreMessage } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'
import type {
  LLMCallOptions,
  LLMResponse,
  LLMProvider,
  LLMStreamCallbacks,
  LLMFinishReason,
} from './types'
import { logApiUsage, getAnthropicSpendUsd } from '@/lib/db/usage'
import { classifyLlmError, type LlmErrorType } from './errors'
import { BUDGET_HARD_STOP_USD } from './pricing'

const GEMINI_MODEL = 'gemini-2.5-flash'

// High-stakes PRIMARY: Sonnet 4.6 — the reasoning tier for the genuinely hard
// moments (trend interpretation, contradiction resolution, recalibration
// explanations). $3/$15 per M (3x Haiku); the budget guard caps spend at 95% of
// the $4.51 balance. The FAILOVER model stays cheap Haiku (separate constant).
const CLAUDE_HIGH_STAKES_MODEL = 'claude-sonnet-4-6'

// FAILOVER target model — deliberately a SEPARATE constant from the high-stakes
// primary. Failover should always use cheap Haiku; keeping it independent means
// the upcoming Sonnet swap (changing CLAUDE_HIGH_STAKES_MODEL above) is a true
// one-liner that does NOT silently make failover 3x more expensive.
const CLAUDE_FAILOVER_MODEL = 'claude-haiku-4-5-20251001'

// R11 — Gemini 2.5 Flash spends hidden "thinking" tokens that count against
// maxTokens but aren't surfaced in completionTokens. With a tight cap the
// visible answer truncates mid-stream (observed in the Sprint 0 smoke test: a
// 16-token cap returned "P" instead of "PONG"). @ai-sdk/google@0.0.55 exposes
// NO thinkingConfig/thinkingBudget setting — it predates Gemini 2.5 — so a
// generous default cap is our only lever. 2048 leaves ample room for thinking
// plus a full chat reply. Revisit (add a real thinking-budget param) on an
// @ai-sdk/google upgrade that surfaces it.
const DEFAULT_MAX_TOKENS = 2048

const gemini = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
})

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * Effective maxTokens. For GEMINI, DEFAULT_MAX_TOKENS is a HARD FLOOR, not just a
 * default: Gemini 2.5's hidden "thinking" tokens count against maxTokens, so a cap
 * below ~2048 can be fully consumed by thinking and truncate the visible output
 * (the R11 bug — it bit intent_detect, meal_estimate, and meal_parse in turn). A
 * caller may go ABOVE the floor (e.g. chat at 4096) but never below it. Anthropic
 * has no such hidden-thinking tax, so its budget is used as requested.
 */
function effectiveMaxTokens(provider: LLMProvider, requested?: number): number {
  const base = requested ?? DEFAULT_MAX_TOKENS
  return provider === 'gemini' ? Math.max(base, DEFAULT_MAX_TOKENS) : base
}

function selectProvider(priority: LLMCallOptions['priority']): LLMProvider {
  return priority === 'high_stakes' ? 'anthropic' : 'gemini'
}

/** Resolve provider + bound model from an explicit provider (primary routing). */
function resolveByProvider(provider: LLMProvider) {
  const modelId =
    provider === 'anthropic' ? CLAUDE_HIGH_STAKES_MODEL : GEMINI_MODEL
  const model = provider === 'anthropic' ? anthropic(modelId) : gemini(modelId)
  return { provider, modelId, model }
}

type ResolvedModel = ReturnType<typeof resolveByProvider>

/** Resolve provider + bound model from the request priority (shared routing). */
function resolveModel(priority: LLMCallOptions['priority']): ResolvedModel {
  return resolveByProvider(selectProvider(priority))
}

/**
 * Resolve the FAILOVER target (the other provider's cheap model). Intentionally
 * uses CLAUDE_FAILOVER_MODEL — NOT the high-stakes primary — so failover stays
 * cheap Haiku even after the high-stakes primary swaps to Sonnet.
 */
function resolveFailoverModel(primaryProvider: LLMProvider): ResolvedModel {
  if (primaryProvider === 'gemini') {
    return {
      provider: 'anthropic',
      modelId: CLAUDE_FAILOVER_MODEL,
      model: anthropic(CLAUDE_FAILOVER_MODEL),
    }
  }
  return {
    provider: 'gemini',
    modelId: GEMINI_MODEL,
    model: gemini(GEMINI_MODEL),
  }
}

function toCoreMessages(messages: LLMCallOptions['messages']): CoreMessage[] {
  return messages.map((m): CoreMessage => ({ role: m.role, content: m.content }))
}

/**
 * Budget hard-stop (R3): true once lifetime Claude spend has reached 95% of the
 * $4.51 balance. Fail-open via getAnthropicSpendUsd (read failure → 0 → false).
 */
async function isAnthropicBudgetExhausted(userId: string): Promise<boolean> {
  return (await getAnthropicSpendUsd(userId)) >= BUDGET_HARD_STOP_USD
}

/** Common api_usage_log fields, bound to whichever provider/model was used. */
function logBase(
  userId: string,
  options: LLMCallOptions,
  target: ResolvedModel,
  failedOver: boolean,
) {
  return {
    userId,
    provider: target.provider,
    model: target.modelId,
    priority: options.priority ?? 'standard',
    operation: options.operation ?? null,
    failedOver,
  }
}

/**
 * Non-streaming call — returns a complete response. Use for the parsing and
 * structured-output jobs that need the whole result before proceeding.
 *
 * Failover: on a TRANSIENT initial failure (and only for userId-bearing
 * requests), tries the other provider once. The success log + returned response
 * reflect whichever provider actually succeeded.
 */
export async function llmCall(options: LLMCallOptions): Promise<LLMResponse> {
  let primary = resolveModel(options.priority)
  const userId = options.userId

  // Budget hard-stop: downgrade a high-stakes PRIMARY to free Gemini rather than
  // spend more on Claude. (Only reads the budget when the primary is Claude.)
  if (
    userId &&
    primary.provider === 'anthropic' &&
    (await isAnthropicBudgetExhausted(userId))
  ) {
    console.warn('budget hard-stop: routing high_stakes primary to Gemini')
    primary = resolveByProvider('gemini')
  }

  const attempt = (target: ResolvedModel) =>
    generateText({
      model: target.model,
      messages: toCoreMessages(options.messages),
      system: options.system,
      temperature: options.temperature,
      maxTokens: effectiveMaxTokens(target.provider, options.maxTokens),
      maxRetries: 2, // SDK built-in exponential-backoff retry for transient errors
      // Agentic tool-calling (undefined when not requested → unchanged behavior).
      tools: options.tools,
      toolChoice: options.toolChoice,
      maxSteps: options.maxSteps,
    })

  const logFailure = async (
    target: ResolvedModel,
    errorType: LlmErrorType,
    failedOver: boolean,
  ) => {
    if (!userId) return
    await logApiUsage({
      ...logBase(userId, options, target, failedOver),
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      finishReason: null,
      success: false,
      errorType,
    })
  }

  let target = primary
  let result: Awaited<ReturnType<typeof attempt>>
  try {
    result = await attempt(primary)
  } catch (err) {
    const { errorType, transient } = classifyLlmError(err)
    await logFailure(primary, errorType, false)
    // Failover: real (userId) requests only, transient only, exactly once.
    if (!userId || !transient) throw err
    const alt = resolveFailoverModel(primary.provider)
    // Budget hard-stop: skip a Claude failover; degrade instead of spending.
    if (alt.provider === 'anthropic' && (await isAnthropicBudgetExhausted(userId))) {
      console.warn('budget hard-stop: skipping Claude failover')
      throw err
    }
    try {
      result = await attempt(alt)
      target = alt
    } catch (err2) {
      const { errorType: errorType2 } = classifyLlmError(err2)
      await logFailure(alt, errorType2, true)
      throw err2 // both failed — re-throw (graceful degradation is 4b-iv)
    }
  }

  const failedOver = target !== primary
  if (userId) {
    await logApiUsage({
      ...logBase(userId, options, target, failedOver),
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens,
      finishReason: result.finishReason,
      success: true,
    })
  }

  // Surface any tool calls from the final result (mapped to our shape). Undefined
  // when there were none — keeps tool-free responses identical.
  const toolCalls =
    result.toolCalls && result.toolCalls.length > 0
      ? result.toolCalls.map((tc) => ({
          id: tc.toolCallId,
          name: tc.toolName,
          arguments: tc.args as Record<string, unknown>,
        }))
      : undefined

  return {
    text: result.text,
    provider: target.provider,
    model: target.modelId,
    finishReason: result.finishReason,
    usage: {
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens,
    },
    toolCalls,
  }
}

/**
 * Streaming call — returns the AI SDK stream result. The API route pipes it to
 * the client. Same provider routing + failover as llmCall: on a TRANSIENT
 * initial failure (userId-bearing requests only), tries the other provider once.
 * The success log + caller onFinish reflect whichever provider produced the stream.
 */
export async function llmStream(options: LLMCallOptions & LLMStreamCallbacks) {
  let primary = resolveModel(options.priority)
  const userId = options.userId
  const callerOnFinish = options.onFinish

  // Budget hard-stop: downgrade a high-stakes PRIMARY to free Gemini rather than
  // spend more on Claude. (Only reads the budget when the primary is Claude.)
  if (
    userId &&
    primary.provider === 'anthropic' &&
    (await isAnthropicBudgetExhausted(userId))
  ) {
    console.warn('budget hard-stop: routing high_stakes primary to Gemini')
    primary = resolveByProvider('gemini')
  }

  // Bound to whichever provider/model actually produced the stream. Logs success
  // FIRST (guarded on userId), then runs the caller's onFinish unchanged — both
  // run post-stream, so the streamed tokens are unaffected.
  const handleFinish = async (
    event: {
      text: string
      finishReason: LLMFinishReason
      usage: {
        promptTokens: number
        completionTokens: number
        totalTokens: number
      }
    },
    target: ResolvedModel,
    failedOver: boolean,
  ) => {
    if (userId) {
      await logApiUsage({
        ...logBase(userId, options, target, failedOver),
        promptTokens: event.usage.promptTokens,
        completionTokens: event.usage.completionTokens,
        totalTokens: event.usage.totalTokens,
        finishReason: event.finishReason,
        success: true,
      })
    }
    if (callerOnFinish) {
      await callerOnFinish({
        text: event.text,
        finishReason: event.finishReason,
        usage: {
          promptTokens: event.usage.promptTokens,
          completionTokens: event.usage.completionTokens,
          totalTokens: event.usage.totalTokens,
        },
        provider: target.provider,
        model: target.modelId,
      })
    }
  }

  const attempt = (target: ResolvedModel, failedOver: boolean) =>
    streamText({
      model: target.model,
      messages: toCoreMessages(options.messages),
      system: options.system,
      temperature: options.temperature,
      maxTokens: effectiveMaxTokens(target.provider, options.maxTokens),
      maxRetries: 2,
      // Agentic tool-calling (undefined when not requested → unchanged behavior).
      tools: options.tools,
      toolChoice: options.toolChoice,
      maxSteps: options.maxSteps,
      onFinish: (event) => handleFinish(event, target, failedOver),
    })

  const logFailure = async (
    target: ResolvedModel,
    errorType: LlmErrorType,
    failedOver: boolean,
  ) => {
    if (!userId) return
    await logApiUsage({
      ...logBase(userId, options, target, failedOver),
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      finishReason: null,
      success: false,
      errorType,
    })
  }

  try {
    return await attempt(primary, false)
  } catch (err) {
    // Initial-request failures only (mid-stream surfaces via the stream — 4b-iv).
    const { errorType, transient } = classifyLlmError(err)
    await logFailure(primary, errorType, false)
    if (!userId || !transient) throw err
    const alt = resolveFailoverModel(primary.provider)
    // Budget hard-stop: skip a Claude failover; degrade instead of spending.
    if (alt.provider === 'anthropic' && (await isAnthropicBudgetExhausted(userId))) {
      console.warn('budget hard-stop: skipping Claude failover')
      throw err
    }
    try {
      return await attempt(alt, true)
    } catch (err2) {
      const { errorType: errorType2 } = classifyLlmError(err2)
      await logFailure(alt, errorType2, true)
      throw err2 // both failed — re-throw
    }
  }
}

export { DEFAULT_MAX_TOKENS }
