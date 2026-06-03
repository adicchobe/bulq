import { type NextRequest } from 'next/server'
import { z } from 'zod'
import type { JSONValue } from 'ai'
import { createClient } from '@/lib/db/server'
import { llmStream, checkResponse, type Message } from '@/lib/ai'
import { logResponseFlags } from '@/lib/db/response-flags'
import { dataStreamTextResponse, dataStreamMessageResponse } from '@/lib/ai/data-stream'
import { buildChatSystemPrompt } from '@/lib/ai/system-prompt'
import { searchKnowledge, type ChunkResult } from '@/lib/rag/search'
import { getMatchableFoods } from '@/lib/db/foods'
import type { AvailableFood } from '@/lib/ai/system-prompt'
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

  // Sourced retrieval (RAG, 3.5). Fail-safe: a retrieval failure must NEVER break
  // Q&A, so on error we fall back to an empty list → the prompt behaves exactly as
  // before (no citations, no crash). Embeds the user's latest message.
  let chunks: ChunkResult[] = []
  try {
    chunks = await searchKnowledge(message)
  } catch (err) {
    console.error('chat: searchKnowledge failed (RAG context omitted)', err)
  }

  // Available foods (4.4) — real per-100g numbers the model may suggest from.
  // Fail-safe like the RAG fetch: a read error just omits the section, never 500s.
  let availableFoods: AvailableFood[] = []
  try {
    const foods = await getMatchableFoods(user.id)
    availableFoods = foods.map((f) => ({
      name: f.name,
      kcal_typical: f.kcal_typical,
      protein_g: f.protein_g,
      category: f.category,
    }))
  } catch (err) {
    console.error('chat: getMatchableFoods failed (food suggestions omitted)', err)
  }

  const nowIst = istNowLabel(new Date())
  const system = buildChatSystemPrompt(profile, targets, today, nowIst, chunks, availableFoods)

  // The nutrition numbers this reply is ALLOWED to state — exactly what the prompt
  // exposed for this turn (targets incl. range/maintenance/BMR + today's consumed
  // band + remaining range). Anything else in a nutrition context is "ungrounded".
  const allowedNutritionNumbers: number[] = []
  if (targets) {
    allowedNutritionNumbers.push(
      targets.dailyTargetKcal,
      targets.dailyTargetRangeKcal.low,
      targets.dailyTargetRangeKcal.high,
      targets.proteinTargetG,
      targets.maintenanceTDEE,
      targets.bmr,
    )
  }
  if (today) {
    const c = today.consumed
    allowedNutritionNumbers.push(
      c.kcal_min,
      c.kcal_typical,
      c.kcal_max,
      c.protein_g,
      today.target.kcal - c.kcal_max, // remaining low
      today.target.kcal - c.kcal_min, // remaining high
      today.remaining.protein_g,
    )
  }
  // 4.4: the real per-100g food numbers the prompt exposed — so a meal suggestion
  // that quotes them isn't flagged as ungrounded by the WATCH checker.
  for (const f of availableFoods) {
    allowedNutritionNumbers.push(f.kcal_typical, f.protein_g)
  }

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

        // Anti-hallucination WATCH (2.7): log-only, fail-safe — wrapped so it can
        // NEVER affect the stream, the reply, or persistence above.
        try {
          const facts = {
            allowedNutritionNumbers,
            nowIst,
            path: 'question' as const,
            // 3.5c: the sources this reply was allowed to cite (empty → check skipped).
            retrievedSourceTitles: chunks.map((c) => c.source_title),
          }
          const { violations } = checkResponse(text, facts)
          if (violations.length > 0) {
            await logResponseFlags({
              userId: user.id,
              conversationId,
              path: 'question',
              responseExcerpt: text.slice(0, 500),
              violations,
              allowedFacts: facts,
            })
          }
        } catch (checkErr) {
          console.error('anti-hallucination check failed (ignored)', checkErr)
        }
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
