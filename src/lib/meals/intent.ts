import { llmCall } from '@/lib/ai'

export type MealIntent = 'meal_log' | 'question'

const INTENT_SYSTEM_PROMPT = `Classify the user's message as exactly one word.
- "meal_log" — the user is REPORTING food they have eaten or are eating right now (a log of consumption).
- "question" — anything else: questions, requests for advice/plans, or statements not reporting consumption. When in doubt, choose "question".

Output ONLY the single word: meal_log OR question. No punctuation, no explanation.

Examples:
had 3 rotis and a katori of dal → meal_log
2 boiled eggs and a glass of milk this morning → meal_log
just had a bowl of poha → meal_log
ate paneer bhurji for lunch → meal_log
is dal healthy? → question
should I have rotis for dinner? → question
what should I eat to gain weight? → question
how much protein is in paneer? → question
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
      maxTokens: 8,
      temperature: 0,
    })
    return extractIntent(res.text)
  } catch {
    return 'question'
  }
}
