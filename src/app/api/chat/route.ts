import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/db/server'
import { llmStream, type Message } from '@/lib/ai'
import { buildChatSystemPrompt } from '@/lib/ai/system-prompt'
import { getProfile, profileToNutritionProfile } from '@/lib/db/profiles'
import { computeNutritionTargets } from '@/lib/nutrition'
import {
  bumpConversationTimestamp,
  getRecentMessages,
  insertMessage,
} from '@/lib/db/chat'

const BodySchema = z.object({
  conversationId: z.string().uuid(),
  message: z.string().min(1).max(4000),
})

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const json: unknown = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) return new Response('Invalid request body', { status: 400 })
  const { conversationId, message } = parsed.data

  // Persist the user's turn first (user_id stamped from the session, RLS-safe).
  await insertMessage({
    conversationId,
    userId: user.id,
    role: 'user',
    content: message,
  })

  // Server is the source of truth for history — don't trust the client.
  const recent = await getRecentMessages(conversationId, 15)
  const history: Message[] = recent
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as Message['role'], content: m.content }))

  const profile = await getProfile(user.id)
  const targets = profile
    ? computeNutritionTargets(profileToNutritionProfile(profile))
    : null
  const system = buildChatSystemPrompt(profile, targets)

  const result = await llmStream({
    system,
    messages: history,
    userId: user.id,
    operation: 'chat',
    // R11: 2048 still truncated chat replies once Gemini's hidden thinking
    // tokens were subtracted. 4096 gives a normal conversational reply ample
    // room to finish (finishReason 'stop', not 'length').
    maxTokens: 4096,
    onFinish: async ({ text, finishReason, usage, model }) => {
      await insertMessage({
        conversationId,
        userId: user.id,
        role: 'assistant',
        content: text,
        modelUsed: model,
        tokensUsed: usage.totalTokens,
        finishReason,
      })
      await bumpConversationTimestamp(conversationId)
    },
  })

  return result.toDataStreamResponse()
}
