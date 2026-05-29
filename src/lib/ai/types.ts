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

export interface LLMResponse {
  text: string
  provider: LLMProvider
  model: string
  usage: LLMUsage
  toolCalls?: ToolCall[]
}
