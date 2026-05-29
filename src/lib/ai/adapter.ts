import { generateText, streamText, type CoreMessage } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'
import type {
  LLMCallOptions,
  LLMResponse,
  LLMProvider,
  LLMStreamCallbacks,
} from './types'

const GEMINI_MODEL = 'gemini-2.5-flash'

// High-stakes default: Haiku 4.5. Picked over Sonnet 4.6 because the $4.51
// Anthropic balance is the binding constraint during dev — Haiku is cheap
// enough that we can afford to actually exercise the high-stakes path.
// Swap to 'claude-sonnet-4-6' for trust-critical reasoning once we've seen
// real per-call cost numbers in api_usage_log.
const CLAUDE_HIGH_STAKES_MODEL = 'claude-haiku-4-5-20251001'

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

/** Resolve provider + bound model from the request priority (shared routing). */
function resolveModel(priority: LLMCallOptions['priority']) {
  const provider = selectProvider(priority)
  const modelId =
    provider === 'anthropic' ? CLAUDE_HIGH_STAKES_MODEL : GEMINI_MODEL
  const model = provider === 'anthropic' ? anthropic(modelId) : gemini(modelId)
  return { provider, modelId, model }
}

function toCoreMessages(messages: LLMCallOptions['messages']): CoreMessage[] {
  return messages.map((m): CoreMessage => ({ role: m.role, content: m.content }))
}

/**
 * Non-streaming call — returns a complete response. Use for the parsing and
 * structured-output jobs that need the whole result before proceeding.
 */
export async function llmCall(options: LLMCallOptions): Promise<LLMResponse> {
  const { provider, modelId, model } = resolveModel(options.priority)

  const result = await generateText({
    model,
    messages: toCoreMessages(options.messages),
    system: options.system,
    temperature: options.temperature,
    maxTokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
  })

  return {
    text: result.text,
    provider,
    model: modelId,
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
 * the client (e.g. `return llmStream(opts).toDataStreamResponse()`). Same
 * provider routing as llmCall: Gemini default, Claude Haiku for high-stakes.
 */
export function llmStream(options: LLMCallOptions & LLMStreamCallbacks) {
  const { provider, modelId, model } = resolveModel(options.priority)
  const onFinish = options.onFinish

  return streamText({
    model,
    messages: toCoreMessages(options.messages),
    system: options.system,
    temperature: options.temperature,
    maxTokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    // Persistence hook — fires when the stream completes, inside the request
    // lifecycle (reliable on serverless, unlike work-after-return).
    onFinish: onFinish
      ? async (event) => {
          await onFinish({
            text: event.text,
            finishReason: event.finishReason,
            usage: {
              promptTokens: event.usage.promptTokens,
              completionTokens: event.usage.completionTokens,
              totalTokens: event.usage.totalTokens,
            },
            provider,
            model: modelId,
          })
        }
      : undefined,
  })
}

export { DEFAULT_MAX_TOKENS }
