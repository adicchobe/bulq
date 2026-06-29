import { type NextRequest } from 'next/server'
import { z } from 'zod'
import type { JSONValue } from 'ai'
import { createClient } from '@/lib/db/server'
import { llmStream, checkResponse, logChatStreamError, type Message } from '@/lib/ai'
import { logResponseFlags } from '@/lib/db/response-flags'
import { dataStreamTextResponse, dataStreamMessageResponse } from '@/lib/ai/data-stream'
import { buildAgentSystemPrompt } from '@/lib/ai/system-prompt'
import { createAgentTools } from '@/lib/ai/agent-tools'
import { getProfile, profileToNutritionProfile } from '@/lib/db/profiles'
import { computeNutritionTargets } from '@/lib/nutrition'
import {
  bumpConversationTimestamp,
  getRecentMessages,
  insertMessage,
} from '@/lib/db/chat'
import { insertMeal } from '@/lib/db/meals'
import {
  classifyAndParse,
  isObviousQuestion,
  assembleParsedMeal,
  estimateUnknownFoods,
  buildProposal,
  istNowLabel,
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
  // through to the agentic Q&A flow.
  //
  // Sprint 6: ONE merged Gemini call (classifyAndParse) now returns BOTH the
  // intent AND the parsed meal — replacing the old sequential intent_detect +
  // meal_parse (2 calls → 1, the meal-turn latency win). It retries internally on
  // a transient/truncated failure and is fail-safe → { intent: 'question' }.
  //
  // Fast-path: an OBVIOUS question skips the LLM call entirely. SAFE BY
  // CONSTRUCTION — it can ONLY route to question, never meal_log, so no phantom
  // card. Food statements, bare lists ("rice dal sabzi"), and ambiguous text still
  // go through classifyAndParse, whose meal_log result requires valid JSON + real
  // items (deriveClassifyParse) — otherwise it too resolves to question.
  const classified = isObviousQuestion(message)
    ? ({ intent: 'question' } as const)
    : await classifyAndParse(user.id, message)

  if (classified.intent === 'meal_log') {
    // classifyAndParse already parsed the items (with its own retry); do ONLY the
    // pure match/portion/confidence assembly — no second LLM call.
    const assembled = await assembleParsedMeal(user.id, classified.meal, message)
    if (!assembled.ok) {
      // The pure assembly doesn't make an LLM call, so this is unexpected (a DB
      // read issue) rather than a parse miss — calm, honest reply either way.
      return dataStreamTextResponse(
        "I caught that you ate something, but couldn't quite read the foods — mind rephrasing what you had?",
      )
    }

    // Auto-estimate any unmatched foods so the card isn't blank for them. MUST run
    // BEFORE insertMeal so the stored totals + the proposal reflect the estimates.
    // Fail-safe: on error the items stay 'unknown' (no card numbers for them).
    assembled.mealInput.items = await estimateUnknownFoods(assembled.mealInput.items, user.id)

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

  // ---- Q&A path — AGENTIC (Phase 1) ----------------------------------------
  // The model now fetches day-state, the sourced library, and foods on demand via
  // tools (createAgentTools), instead of us pre-stuffing them into the prompt. We
  // still pass STATIC context (profile + targets) the agent always needs.
  // Server is the source of truth for history — don't trust the client.
  const recent = await getRecentMessages(conversationId, 15)
  const history: Message[] = recent
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as Message['role'], content: m.content }))

  const profile = await getProfile(user.id)
  const targets = profile
    ? computeNutritionTargets(profileToNutritionProfile(profile))
    : null

  const nowIst = istNowLabel(new Date())
  const system = buildAgentSystemPrompt(profile, targets, nowIst)

  // WATCH (2.7) can only pre-know the STATIC target numbers now — day-state, food,
  // and suggested numbers are fetched inside tool calls the route never sees, so
  // they'll show as ungrounded in the log. WATCH is log-only, so this is acceptable
  // noise, not a user-facing regression. (A future onStepFinish hook could capture
  // tool-result numbers + cited sources to tighten this.)
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

  try {
    const result = await llmStream({
      system,
      messages: history,
      userId: user.id,
      operation: 'chat',
      // R11: 4096 leaves a normal reply ample room to finish past Gemini's hidden
      // thinking tokens (finishReason 'stop', not 'length').
      maxTokens: 4096,
      // Agentic: bind the tools to this user; cap the loop at 3 steps (tool-call →
      // result → answer) so it can't run away.
      tools: createAgentTools(user.id),
      maxSteps: 3,
      onFinish: async ({ text, finishReason, usage, model, toolResultNumbers }) => {
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
            // Static targets PLUS the numbers tools actually returned this turn
            // (#41) — so a tool-sourced figure the agent repeats is grounded, while
            // a genuinely invented number is still flagged.
            allowedNutritionNumbers: [...allowedNutritionNumbers, ...toolResultNumbers],
            nowIst,
            path: 'question' as const,
            // Sources are now retrieved inside search_knowledge (not in route scope),
            // so we skip the fabricated-source check rather than false-flag every cite.
            retrievedSourceTitles: [],
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

    // getErrorMessage fires ONLY on a mid-stream error (onFinish never ran). It
    // logs the otherwise-invisible failure (best-effort) and returns the calm
    // fallback so the client shows that text instead of going blank. We do NOT
    // persist a fallback assistant turn here — can't guarantee onFinish and
    // getErrorMessage are mutually exclusive on one turn, so we avoid a possible
    // duplicate and accept that this turn vanishes on reload.
    return result.toDataStreamResponse({
      getErrorMessage: (error) => {
        void logChatStreamError(user.id, 'chat', error)
        return FALLBACK_MESSAGE
      },
    })
  } catch (err) {
    // Both providers failed (or a permanent error). llmStream already logged the
    // failure(s) to api_usage_log. Return a calm reply instead of a 500 / silent
    // no-reply. We do NOT persist this fallback (no fake assistant turn).
    console.error('chat: llmStream failed after retries + failover', err)
    return dataStreamTextResponse(FALLBACK_MESSAGE)
  }
}
