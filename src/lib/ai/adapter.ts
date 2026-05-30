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
import { logApiUsage } from '@/lib/db/usage'
import { classifyLlmError, type LlmErrorType } from './errors'

const GEMINI_MODEL = 'gemini-2.5-flash'

// High-stakes PRIMARY: Haiku 4.5 for now. Picked over Sonnet 4.6 because the
// $4.51 Anthropic balance is the binding constraint during dev. Swap to
// 'claude-sonnet-4-6' here once we've seen real per-call cost in api_usage_log.
const CLAUDE_HIGH_STAKES_MODEL = 'claude-haiku-4-5-20251001'

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
  const primary = resolveModel(options.priority)
  const userId = options.userId

  const attempt = (target: ResolvedModel) =>
    generateText({
      model: target.model,
      messages: toCoreMessages(options.messages),
      system: options.system,
      temperature: options.temperature,
      maxTokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      maxRetries: 2, // SDK built-in exponential-backoff retry for transient errors
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
  }
}

/**
 * Streaming call — returns the AI SDK stream result. The API route pipes it to
 * the client. Same provider routing + failover as llmCall: on a TRANSIENT
 * initial failure (userId-bearing requests only), tries the other provider once.
 * The success log + caller onFinish reflect whichever provider produced the stream.
 */
export async function llmStream(options: LLMCallOptions & LLMStreamCallbacks) {
  const primary = resolveModel(options.priority)
  const userId = options.userId
  const callerOnFinish = options.onFinish

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
      maxTokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      maxRetries: 2,
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
