import { createClient } from '../db/server'
import { embed, toPgVector } from '../ai/embed'

/**
 * One retrieved knowledge chunk + its closeness to the query.
 * `similarity` is cosine similarity in [0, 1] (1 = identical direction);
 * computed in Postgres as 1 - (embedding <=> query) since vectors are normalized.
 */
export interface ChunkResult {
  id: string
  content: string
  source_title: string
  source_ref: string
  source_tier: number
  similarity: number
}

/** Default number of chunks returned — small, since we feed these to the model. */
const DEFAULT_TOP_K = 5

/**
 * Find the knowledge_chunks closest to `queryText` by cosine similarity.
 *
 * Flow: embed the query (RETRIEVAL_QUERY task) → call the match_knowledge_chunks
 * RPC, which runs the pgvector `<=>` (cosine distance) search server-side and
 * returns the nearest rows. We use the anon-key server client, so RLS applies:
 * system rows (user_id IS NULL) are readable by all authenticated users.
 *
 * ⚠️ Requires the match_knowledge_chunks DB function (migration 0010) to exist;
 *    without it the RPC errors. Makes one real Gemini embed call (FREE tier).
 *
 * @param queryText the user's question / search text
 * @param topK how many chunks to return (default 5)
 */
export async function searchKnowledge(
  queryText: string,
  topK: number = DEFAULT_TOP_K,
): Promise<ChunkResult[]> {
  const trimmed = queryText.trim()
  if (!trimmed) throw new Error('searchKnowledge(): empty query')

  const queryVector = await embed(trimmed, 'RETRIEVAL_QUERY')

  const supabase = createClient()
  const { data, error } = await supabase.rpc('match_knowledge_chunks', {
    query_embedding: toPgVector(queryVector),
    match_count: topK,
  })
  if (error) throw new Error(`searchKnowledge failed: ${error.message}`)

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    content: r.content as string,
    source_title: r.source_title as string,
    source_ref: r.source_ref as string,
    source_tier: Number(r.source_tier),
    similarity: Number(r.similarity),
  }))
}
