import { llmCall } from '@/lib/ai'

export type MealIntent = 'meal_log' | 'question'

const INTENT_SYSTEM_PROMPT = `Classify the user's message as exactly one word.
- "meal_log" — the message describes food the user ate, is eating, or just had. This includes bare food lists ("rice dal sabzi") and any cuisine (Indian or not). If food is being reported as consumed, it is meal_log.
- "question" — a pure question, a request for advice/plans, or a status check — NOT a report of food consumed.

Output ONLY the single word: meal_log OR question. No punctuation, no explanation.

Examples:
had 3 rotis and a katori of dal → meal_log
ate paneer bhurji for lunch → meal_log
I just had a burger and fries → meal_log
burger and coke → meal_log
2 eggs and a glass of milk → meal_log
rice dal and sabzi → meal_log
chicken biryani for dinner → meal_log
just had a bowl of poha → meal_log
is dal healthy? → question
should I have rotis for dinner? → question
what should I eat to gain weight? → question
how much protein is in paneer? → question
how am I doing today? → question
i'm hungry → question`

/**
 * Parse the classifier's raw output to the intent. Defaults to 'question' on ANY
 * ambiguity — we never spuriously propose a meal (a missed log just gets a normal
 * reply, which is recoverable; a phantom meal card is jarring). Pure.
 */
export function extractIntent(raw: string): MealIntent {
  const first = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z_]/g, ' ')
    .trim()
    .split(/\s+/)[0]
  return first === 'meal_log' ? 'meal_log' : 'question'
}

/**
 * Classify whether a chat message is a meal log vs a question, via the adapter
 * (cheap Gemini, constrained). FAIL-SAFE: never throws — any error → 'question'.
 */
export async function classifyMealIntent(
  userId: string,
  text: string,
): Promise<MealIntent> {
  try {
    const res = await llmCall({
      system: INTENT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
      priority: 'standard',
      userId,
      operation: 'intent_detect',
      // R11: Gemini 2.5 Flash spends hidden "thinking" tokens against maxTokens.
      // A tiny cap (was 8) left ZERO output tokens → the SDK threw on the empty
      // response → every classify silently fell back to 'question'. 1024 leaves
      // ample room for thinking + the single word.
      maxTokens: 1024,
      temperature: 0,
    })
    return extractIntent(res.text)
  } catch (err) {
    // Fail-safe → 'question' (never spuriously propose a meal), but log it so a
    // classify failure is visible in Vercel logs instead of silently misrouting.
    console.error('classifyMealIntent failed (defaulting to question):', err)
    return 'question'
  }
}
