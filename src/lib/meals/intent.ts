// Question fast-path (5.3): leading question word OR a trailing "?".
const QUESTION_START_RE = /^(?:what|how|why|should|is|can|do|does|when|where|who)\b/i

/**
 * PURE cheap pre-check: is this message an OBVIOUS question? Used to skip the
 * merged classify+parse LLM call. SAFE BY CONSTRUCTION — callers only ever route
 * a true result to the question path, NEVER to meal_log, so it can't produce a
 * phantom meal card. The reverse (keyword → meal_log) would be unsafe and is
 * intentionally not done.
 */
export function isObviousQuestion(message: string): boolean {
  const t = message.trim()
  return t.endsWith('?') || QUESTION_START_RE.test(t)
}
