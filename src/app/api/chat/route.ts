import { type NextRequest } from 'next/server'
import { z } from 'zod'
import type { JSONValue } from 'ai'
import { createClient } from '@/lib/db/server'
import { llmStream, type Message } from '@/lib/ai'
import { dataStreamTextResponse, dataStreamMessageResponse } from '@/lib/ai/data-stream'
import { buildChatSystemPrompt } from '@/lib/ai/system-prompt'
import { getProfile, profileToNutritionProfile } from '@/lib/db/profiles'
import { computeNutritionTargets } from '@/lib/nutrition'
import {
  bumpConversationTimestamp,
  getRecentMessages,
  insertMessage,
} from '@/lib/db/chat'
import { insertMeal } from '@/lib/db/meals'
import {
  classifyMealIntent,
  assembleMeal,
  buildProposal,
  getTodaySummary,
  istNowLabel,
  type TodaySummary,
} from '@/lib/meals'

const BodySchema = z.object({
  conversationId: z.string().uuid(),
  message: z.string().min(1).max(4000),
})

// Shown as a NORMAL assistant reply when the model is unreachable (both providers
// failed, or a permanent error). Calm, no raw error, no fabricated nutrition content.
const FALLBACK_MESSAGE =
  "I'm having trouble reaching my brain right now — please try again in a moment."

const MEAL_ACK = "Here's what I picked up — does this look right?"

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

  // Intent gate: a meal log gets the propose-a-meal path; everything else falls
  // through to the existing Q&A streaming flow (unchanged). classifyMealIntent is
  // fail-safe → 'question' on any error.
  const intent = await classifyMealIntent(user.id, message)
  if (intent === 'meal_log') {
    const assembled = await assembleMeal(user.id, message)
    if (!assembled.ok) {
      // Classifier said "meal" but we couldn't structure it — calm, honest reply.
      return dataStreamTextResponse(
        "I caught that you ate something, but couldn't quite read the foods — mind rephrasing what you had?",
      )
    }

    let mealRow
    try {
      mealRow = await insertMeal(user.id, assembled.mealInput) // status 'pending'
    } catch (err) {
      console.error('chat: insertMeal failed', err)
      return dataStreamTextResponse(
        "I couldn't save that meal just now — please try again in a moment.",
      )
    }

    const proposal = buildProposal(mealRow.id, assembled.mealInput, assembled.itemConfidences)

    // Persist the ack as an assistant turn; stash the meal id in tool_calls so a
    // reload can later rehydrate the card (rendering is optional 6b polish).
    await insertMessage({
      conversationId,
      userId: user.id,
      role: 'assistant',
      content: MEAL_ACK,
      toolCalls: { meal_proposal_id: mealRow.id },
    })
    await bumpConversationTimestamp(conversationId)

    // Carry the proposal as a message annotation → the client renders the card.
    return dataStreamMessageResponse(MEAL_ACK, proposal as unknown as JSONValue)
  }

  // ---- Q&A path (unchanged) ------------------------------------------------
  // Server is the source of truth for history — don't trust the client.
  const recent = await getRecentMessages(conversationId, 15)
  const history: Message[] = recent
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as Message['role'], content: m.content }))

  const profile = await getProfile(user.id)
  const targets = profile
    ? computeNutritionTargets(profileToNutritionProfile(profile))
    : null

  // Day-state (today, IST) — fail-safe: a summary read failure must not break Q&A,
  // so on error we omit the day section rather than 500.
  let today: TodaySummary | null = null
  try {
    today = await getTodaySummary(user.id)
  } catch (err) {
    console.error('chat: getTodaySummary failed (day-state omitted)', err)
  }

  const system = buildChatSystemPrompt(profile, targets, today, istNowLabel(new Date()))

  try {
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
  } catch (err) {
    // Both providers failed (or a permanent error). llmStream already logged the
    // failure(s) to api_usage_log. Return a calm reply instead of a 500 / silent
    // no-reply. We do NOT persist this fallback (no fake assistant turn).
    console.error('chat: llmStream failed after retries + failover', err)
    return dataStreamTextResponse(FALLBACK_MESSAGE)
  }
}
