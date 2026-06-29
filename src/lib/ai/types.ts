import type { CoreTool, CoreToolChoice } from 'ai'

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
  /** When present, the call is logged to api_usage_log (skipped otherwise). */
  userId?: string
  /** Log label for the call: 'chat' | 'parse' | 'reason' | 'compose'. */
  operation?: string
  /**
   * Agentic tool-calling. When `tools` is set, the SDK runs an automatic
   * tool-execution loop (up to `maxSteps`). Omit all three for unchanged,
   * tool-free behavior. Shared by llmCall (generateText) and llmStream (streamText).
   */
  tools?: Record<string, CoreTool>
  toolChoice?: CoreToolChoice<Record<string, CoreTool>>
  maxSteps?: number
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

/** Payload handed to a stream's onFinish once the full response has streamed. */
export interface LLMStreamFinish {
  text: string
  finishReason: LLMFinishReason
  usage: LLMUsage
  provider: LLMProvider
  model: string
  /**
   * Every finite numeric value returned by the tools the agent called this turn
   * (harvested via onStepFinish). Lets the WATCH check treat tool-sourced numbers
   * as grounded instead of false-positive ungrounded_number flags (#41). Empty for
   * tool-free streams. Callers that don't tool-call can ignore it.
   */
  toolResultNumbers: number[]
}

export interface LLMStreamCallbacks {
  /** Fires once the stream completes — use to persist the full assistant message. */
  onFinish?: (result: LLMStreamFinish) => void | Promise<void>
}
