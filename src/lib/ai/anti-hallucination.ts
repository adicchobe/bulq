/**
 * Anti-hallucination post-processor (WATCH mode — pure, log-only; never blocks or
 * edits a reply). Scans an assistant reply for likely pillar-#1/#7 violations:
 * nutrition numbers not grounded in the provided facts, invented clock times,
 * false "I logged that" claims on the question path, and diet-shaming language.
 * Tuned to avoid false positives on legitimate clean replies.
 */

export type ViolationType =
  | 'ungrounded_number'
  | 'invented_time'
  | 'false_logged'
  | 'shaming'
  | 'fabricated_source'

export interface Violation {
  type: ViolationType
  detail: string
}

export interface CheckFacts {
  /** Nutrition numbers the reply is allowed to state (targets, today's totals, …). */
  allowedNutritionNumbers: number[]
  /** Current time label (e.g. "2026-05-31 11:34 pm IST"), or null if unknown. */
  nowIst: string | null
  path: 'question' | 'meal_log'
  /**
   * Source titles of the RAG chunks retrieved for THIS turn (3.5). When non-empty,
   * the reply may only cite these; a named source absent from this list is flagged
   * as fabricated_source. Empty/undefined → check skipped (non-RAG reply).
   */
  retrievedSourceTitles?: string[]
}

// ---- ungrounded nutrition numbers ----------------------------------------
const NUM = String.raw`\d[\d,]*(?:\.\d+)?`
const NUTRITION_UNIT = String.raw`(?:kcal|calories?|cals?\b|g\s*(?:of\s+)?protein|grams?\s+(?:of\s+)?protein)`
// A number (or dash-range of numbers) IMMEDIATELY followed by a nutrition unit.
const NUTRITION_NUMBER_RE = new RegExp(
  String.raw`(${NUM})(?:\s*[–-]\s*(${NUM}))?\s*(${NUTRITION_UNIT})`,
  'gi',
)

function parseNum(s: string): number {
  return parseFloat(s.replace(/,/g, '')) // normalize "2,936" → 2936
}

// Allowed if within ±5 units OR ±5% of any provided number (absorbs rounding).
function isGrounded(n: number, allowed: number[]): boolean {
  return allowed.some((a) => Math.abs(n - a) <= Math.max(5, 0.05 * Math.abs(a)))
}

function checkUngroundedNumbers(
  text: string,
  allowed: number[],
  out: Violation[],
): void {
  for (const m of Array.from(text.matchAll(NUTRITION_NUMBER_RE))) {
    const found = [parseNum(m[1])]
    if (m[2]) found.push(parseNum(m[2]))
    for (const n of found) {
      if (!isGrounded(n, allowed)) {
        out.push({ type: 'ungrounded_number', detail: `${n} in "${m[0].trim()}"` })
      }
    }
  }
}

// ---- invented clock time --------------------------------------------------
const CLOCK_RE = /\b(?:\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/gi

function to24(h: number, min: number, ampm: string | null): number {
  let hh = h
  if (ampm === 'pm' && hh < 12) hh += 12
  if (ampm === 'am' && hh === 12) hh = 0
  return hh * 60 + min
}

function parseClock(s: string): { minutes: number; hasMinutes: boolean } | null {
  const withMin = s.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i)
  if (withMin) {
    return {
      minutes: to24(+withMin[1], +withMin[2], withMin[3]?.toLowerCase() ?? null),
      hasMinutes: true,
    }
  }
  const hourOnly = s.match(/(\d{1,2})\s*(am|pm)/i)
  if (hourOnly) {
    return { minutes: to24(+hourOnly[1], 0, hourOnly[2].toLowerCase()), hasMinutes: false }
  }
  return null
}

function checkInventedTime(
  text: string,
  nowIst: string | null,
  out: Violation[],
): void {
  if (!nowIst) return // no ground truth → can't validate
  const now = parseClock(nowIst)
  if (!now) return
  for (const m of Array.from(text.matchAll(CLOCK_RE))) {
    const found = parseClock(m[0])
    if (!found) continue
    const mismatch = found.hasMinutes
      ? found.minutes !== now.minutes
      : Math.floor(found.minutes / 60) !== Math.floor(now.minutes / 60)
    if (mismatch) {
      out.push({ type: 'invented_time', detail: `"${m[0].trim()}" vs now ${nowIst}` })
    }
  }
}

// ---- false "I logged that" claims (question path only) --------------------
const FALSE_LOGGED_RES: RegExp[] = [
  /\b(?:i['’]?ve|i have|i just|just|now)\s+(?:logged|saved|recorded|tracked|added|noted)\b/i,
  /\b(?:logged|saved|recorded|tracked|added|noted)\s+(?:that|it|this|your meal|the meal|your food)\b/i,
  /\b(?:that|this|it|your meal)(?:['’]?s| is| has been| have been)\s+(?:logged|saved|recorded|tracked|added|noted)\b/i,
]

function checkFalseLogged(text: string, out: Violation[]): void {
  for (const re of FALSE_LOGGED_RES) {
    const m = text.match(re)
    if (m) out.push({ type: 'false_logged', detail: `"${m[0].trim()}"` })
  }
}

// ---- diet-shaming language ------------------------------------------------
const SHAMING_RES: { re: RegExp; label: string }[] = [
  { re: /\bcheat\s+(?:day|meal)s?\b/i, label: 'cheat day/meal' },
  { re: /\bguilt[\s-]?free\b/i, label: 'guilt-free' },
  { re: /\bguilty\b/i, label: 'guilty' },
  { re: /\btreat yourself\b/i, label: 'treat yourself' },
  { re: /\bearned it\b/i, label: 'earned it' },
  { re: /\bburn(?:ed|ing)?\s+(?:it\s+)?off\b/i, label: 'burn it off' },
  { re: /\bmake up for it\b/i, label: 'make up for it' },
  { re: /\bindulge\b/i, label: 'indulge' },
  { re: /\bsinful\b/i, label: 'sinful' },
  // NOTE: "good/bad food" intentionally NOT flagged — too many legit uses
  // ("a good source of protein") would flood the WATCH log.
]

function checkShaming(text: string, out: Violation[]): void {
  for (const { re, label } of SHAMING_RES) {
    const m = text.match(re)
    if (m) out.push({ type: 'shaming', detail: `${label}: "${m[0].trim()}"` })
  }
}

// ---- fabricated source (RAG citations, 3.5) -------------------------------
// Citation lead-ins the model uses to name a source. Group 1 = the claimed source
// phrase, captured up to the first sentence/clause delimiter. Deliberately narrow
// (avoids "per day"/"per kg") to keep false positives low — WATCH philosophy.
const CITATION_RE =
  /\b(?:according to|as per|per the|source:|summarized from:|citing|as (?:stated|noted) in)\s+([^.,;:\n]+)/gi

// Generic words that don't identify a source. A claimed citation must overlap a
// retrieved title on something MORE specific than these (e.g. "ICMR-NIN", "Examine").
const SOURCE_STOPWORDS = new Set([
  'the', 'and', 'for', 'from', 'with', 'summarized', 'guidelines', 'guide',
  'dietary', 'nutrition', 'nutritional', 'study', 'studies', 'review', 'reviews',
  'recommendations', 'recommendation', 'indians', 'indian', 'adults', 'adult',
  'intake', 'status', 'diet', 'diets', 'health', 'report', 'data', 'database',
  'edition', 'guideline', 'national', 'official', 'research',
])

/** Identifying tokens of a source string (drops the "Summarized from:" prefix,
 *  stopwords, and bare numbers like years). */
function sourceTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/summarized from:/g, ' ')
    .split(/[^a-z0-9-]+/)
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t) && !SOURCE_STOPWORDS.has(t))
}

function checkFabricatedSource(
  text: string,
  retrievedTitles: string[],
  out: Violation[],
): void {
  // Union of identifying tokens across every retrieved source title.
  const known = new Set<string>()
  for (const title of retrievedTitles) {
    for (const t of sourceTokens(title)) known.add(t)
  }

  for (const m of Array.from(text.matchAll(CITATION_RE))) {
    const claimed = m[1].trim()
    const claimedTokens = sourceTokens(claimed)
    // No identifying token (e.g. "according to the guidelines") → can't judge; skip.
    if (claimedTokens.length === 0) continue
    if (!claimedTokens.some((t) => known.has(t))) {
      out.push({ type: 'fabricated_source', detail: `"${claimed}" not in retrieved sources` })
    }
  }
}

export function checkResponse(
  text: string,
  facts: CheckFacts,
): { violations: Violation[] } {
  const violations: Violation[] = []
  checkUngroundedNumbers(text, facts.allowedNutritionNumbers, violations)
  checkInventedTime(text, facts.nowIst, violations)
  if (facts.path === 'question') checkFalseLogged(text, violations)
  checkShaming(text, violations)
  // Only when chunks were actually retrieved this turn (else skip → no false positives).
  if (facts.retrievedSourceTitles && facts.retrievedSourceTitles.length > 0) {
    checkFabricatedSource(text, facts.retrievedSourceTitles, violations)
  }
  return { violations }
}
