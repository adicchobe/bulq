import { createClient } from './server'
import type { Violation } from '@/lib/ai/anti-hallucination'

export interface LogResponseFlagsInput {
  userId: string
  conversationId: string | null
  path: 'question' | 'meal_log'
  responseExcerpt: string
  violations: Violation[]
  allowedFacts: unknown // the CheckFacts passed to the checker (debug)
}

/**
 * Records flagged responses into response_flags. FIRE-AND-FORGET / FAIL-SAFE: any
 * failure is logged and swallowed — WATCH-mode logging must NEVER affect the reply,
 * the stream, or message persistence. Mirrors logApiUsage.
 */
export async function logResponseFlags(input: LogResponseFlagsInput): Promise<void> {
  try {
    const supabase = createClient()
    const { error } = await supabase.from('response_flags').insert({
      user_id: input.userId,
      conversation_id: input.conversationId,
      path: input.path,
      response_excerpt: input.responseExcerpt,
      violations: input.violations,
      allowed_facts: input.allowedFacts ?? null,
    })
    if (error) console.error(`logResponseFlags insert failed: ${error.message}`)
  } catch (err) {
    console.error('logResponseFlags threw (swallowed):', err)
  }
}
