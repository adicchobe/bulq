import { generateText, type CoreMessage } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'
import type { LLMCallOptions, LLMResponse, LLMProvider } from './types'

const GEMINI_MODEL = 'gemini-2.5-flash'

// High-stakes default: Haiku 4.5. Picked over Sonnet 4.6 because the $4.51
// Anthropic balance is the binding constraint during dev — Haiku is cheap
// enough that we can afford to actually exercise the high-stakes path.
// Swap to 'claude-sonnet-4-6' for trust-critical reasoning once we've seen
// real per-call cost numbers in api_usage_log.
const CLAUDE_HIGH_STAKES_MODEL = 'claude-haiku-4-5-20251001'

const gemini = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
})

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

function selectProvider(priority: LLMCallOptions['priority']): LLMProvider {
  return priority === 'high_stakes' ? 'anthropic' : 'gemini'
}

export async function llmCall(options: LLMCallOptions): Promise<LLMResponse> {
  const provider = selectProvider(options.priority)
  const modelId =
    provider === 'anthropic' ? CLAUDE_HIGH_STAKES_MODEL : GEMINI_MODEL
  const model = provider === 'anthropic' ? anthropic(modelId) : gemini(modelId)

  const messages: CoreMessage[] = options.messages.map((m): CoreMessage => ({
    role: m.role,
    content: m.content,
  }))

  const result = await generateText({
    model,
    messages,
    system: options.system,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  })

  return {
    text: result.text,
    provider,
    model: modelId,
    usage: {
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens,
    },
  }
}
