import { createClient } from './server'

export type ChatRole = 'user' | 'assistant' | 'system' | 'tool'

/** A row of the `messages` table. */
export interface MessageRow {
  id: string
  conversation_id: string
  user_id: string
  role: ChatRole
  content: string
  tool_calls: unknown | null
  cited_sources: unknown | null
  model_used: string | null
  tokens_used: number | null
  finish_reason: string | null
  created_at: string
}

export interface InsertMessageInput {
  conversationId: string
  userId: string
  role: ChatRole
  content: string
  modelUsed?: string | null
  tokensUsed?: number | null
  finishReason?: string | null
}

/**
 * Returns the user's most-recent conversation id, creating one if none exists.
 * MVP keeps a single long thread per user; the schema allows many.
 */
export async function getOrCreateConversation(userId: string): Promise<string> {
  const supabase = createClient()

  const { data: existing, error: selectError } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (selectError) {
    throw new Error(`getOrCreateConversation select failed: ${selectError.message}`)
  }
  if (existing) return existing.id as string

  const { data: created, error: insertError } = await supabase
    .from('conversations')
    .insert({ user_id: userId })
    .select('id')
    .single()
  if (insertError) {
    throw new Error(`getOrCreateConversation insert failed: ${insertError.message}`)
  }
  return created.id as string
}

/** All messages in a conversation, oldest first (for rendering the thread). */
export async function getMessages(conversationId: string): Promise<MessageRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`getMessages failed: ${error.message}`)
  return (data ?? []) as MessageRow[]
}

/** Last `limit` messages, returned oldest-first — context window for the model. */
export async function getRecentMessages(
  conversationId: string,
  limit = 15,
): Promise<MessageRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`getRecentMessages failed: ${error.message}`)
  return ((data ?? []) as MessageRow[]).reverse()
}

export async function insertMessage(input: InsertMessageInput): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('messages').insert({
    conversation_id: input.conversationId,
    user_id: input.userId,
    role: input.role,
    content: input.content,
    model_used: input.modelUsed ?? null,
    tokens_used: input.tokensUsed ?? null,
    finish_reason: input.finishReason ?? null,
  })
  if (error) throw new Error(`insertMessage failed: ${error.message}`)
}

export async function bumpConversationTimestamp(conversationId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId)
  if (error) throw new Error(`bumpConversationTimestamp failed: ${error.message}`)
}
