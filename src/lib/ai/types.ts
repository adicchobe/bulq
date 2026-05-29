export type LLMPriority = 'standard' | 'high_stakes'

export type LLMProvider = 'gemini' | 'anthropic'

export type MessageRole = 'user' | 'assistant'

export interface Message {
  role: MessageRole
  content: string
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface LLMCallOptions {
  messages: Message[]
  priority?: LLMPriority
  system?: string
  temperature?: number
  maxTokens?: number
}

export interface LLMUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/**
 * Mirrors the Vercel AI SDK's FinishReason union exactly so the adapter can pass
 * it through without translation. 'length' is the signal that output was cut off
 * by the token cap — central to detecting the Gemini truncation issue (R11).
 */
export type LLMFinishReason =
  | 'stop'
  | 'length'
  | 'content-filter'
  | 'tool-calls'
  | 'error'
  | 'other'
  | 'unknown'

export interface LLMResponse {
  text: string
  provider: LLMProvider
  model: string
  finishReason: LLMFinishReason
  usage: LLMUsage
  toolCalls?: ToolCall[]
}
