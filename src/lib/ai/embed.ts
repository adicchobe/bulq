import { embed as aiEmbed } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

// Use OUR key (GEMINI_API_KEY), same as adapter.ts — NOT the default `google`
// instance (which reads GOOGLE_GENERATIVE_AI_API_KEY, which we don't set).
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })

/**
 * Embedding model + dimensions are pinned here so the rest of the app never
 * hardcodes them. gemini-embedding-001 returns 768 dims via outputDimensionality;
 * note that sub-3072 outputs are NOT auto-normalized by the API, so we normalize
 * manually below. If we re-embed on a different model/size, change it here (and the
 * DB vector(768) column must match).
 */
export const EMBED_MODEL = 'gemini-embedding-001'
export const EMBED_DIMS = 768

/** RETRIEVAL_DOCUMENT for stored chunks, RETRIEVAL_QUERY for user questions. */
export type EmbedTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'

/**
 * PURE. Scale a vector to unit length (L2 norm = 1) so cosine similarity is
 * accurate. Exported separately for unit testing without any network. A zero
 * vector is returned unchanged (cannot divide by zero).
 */
export function normalizeVector(vec: number[]): number[] {
  let sumSquares = 0
  for (const v of vec) sumSquares += v * v
  const magnitude = Math.sqrt(sumSquares)
  if (magnitude === 0) return vec
  return vec.map((v) => v / magnitude)
}

/**
 * Turn one piece of text into a normalized 768-dim embedding via the adapter
 * (callers never import @ai-sdk/google directly — pillar §4 #10). Throws on an
 * unexpected vector length so a bad-size vector never reaches the DB.
 *
 * ⚠️ Makes a real Gemini API call (FREE tier, but networked — caller handles throw).
 *
 * ⚠️ @ai-sdk/google 0.0.55's embedding settings support ONLY outputDimensionality:
 *    taskType / title are accepted here for forward-compat but are NOT sent to this
 *    SDK version (no field exists). Wire them through on an SDK upgrade.
 */
export async function embed(
  text: string,
  taskType: EmbedTaskType,
  title?: string,
): Promise<number[]> {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('embed(): empty text')

  void taskType // not supported on @ai-sdk/google 0.0.55 (see note above)
  void title

  const model = google.textEmbeddingModel(EMBED_MODEL, {
    outputDimensionality: EMBED_DIMS,
  })
  const { embedding } = await aiEmbed({ model, value: trimmed })

  if (!Array.isArray(embedding) || embedding.length !== EMBED_DIMS) {
    throw new Error(
      `embed(): expected ${EMBED_DIMS} dims, got ${
        Array.isArray(embedding) ? embedding.length : typeof embedding
      }`,
    )
  }
  return normalizeVector(embedding)
}

/** Format a JS number[] as a pgvector literal: "[0.1,0.2,...]". */
export function toPgVector(vec: number[]): string {
  return `[${vec.join(',')}]`
}
