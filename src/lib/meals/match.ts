import type { FoodRow } from '@/lib/db/foods'

export type FoodMatch =
  | { food: FoodRow; method: 'exact' | 'alias' | 'fuzzy' }
  | { food: null; method: 'unknown' }

// Deliberately HIGH. A wrong fuzzy match fabricates wrong calories — worse than
// admitting unknown (pillars #1/#2). Below this, prefer 'unknown'. Tune only with
// real-usage evidence, upward if anything.
const FUZZY_THRESHOLD = 0.82

/**
 * Lowercase, trim, collapse internal whitespace, and drop a single trailing
 * plural 's'. Applied identically to the query AND to food names/aliases, so the
 * (linguistically rough) singularization stays consistent on both sides.
 */
export function normalizeFoodName(s: string): string {
  const base = s.toLowerCase().trim().replace(/\s+/g, ' ')
  if (base.length > 3 && base.endsWith('s') && !base.endsWith('ss')) {
    return base.slice(0, -1)
  }
  return base
}

/** Levenshtein edit distance (iterative two-row). Pure. */
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  let curr = new Array<number>(n + 1)
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    const tmp = prev
    prev = curr
    curr = tmp
  }
  return prev[n]
}

/** Normalized similarity in [0,1]: 1 = identical, 0 = nothing in common. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(a, b) / maxLen
}

/**
 * Resolve a raw food name to a foods row via the ladder: exact name → alias
 * membership → fuzzy (HIGH threshold) → unknown. 'llm_inferred' is intentionally
 * NOT implemented here (the enum allows it; deferred). Pure — no DB.
 */
export function matchFood(foodNameRaw: string, foods: FoodRow[]): FoodMatch {
  const q = normalizeFoodName(foodNameRaw)
  if (!q) return { food: null, method: 'unknown' }

  // 1. Exact normalized name.
  for (const f of foods) {
    if (normalizeFoodName(f.name) === q) return { food: f, method: 'exact' }
  }

  // 2. Alias membership (normalized).
  for (const f of foods) {
    if (f.aliases.some((a) => normalizeFoodName(a) === q)) {
      return { food: f, method: 'alias' }
    }
  }

  // 3. Fuzzy — best similarity across name + aliases; only above the high
  //    threshold, else unknown (never force a shaky match).
  let best: { food: FoodRow; score: number } | null = null
  for (const f of foods) {
    for (const candidate of [f.name, ...f.aliases]) {
      const score = similarity(q, normalizeFoodName(candidate))
      if (!best || score > best.score) best = { food: f, score }
    }
  }
  if (best && best.score >= FUZZY_THRESHOLD) {
    return { food: best.food, method: 'fuzzy' }
  }

  return { food: null, method: 'unknown' }
}
