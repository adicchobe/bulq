-- 0010_match_knowledge_chunks.sql
-- Sprint 3 (RAG, 3.4): cosine-similarity search over knowledge_chunks.
--
-- The Supabase anon-key client (PostgREST) cannot run the pgvector `<=>` operator
-- directly, so we expose it as an RPC. SECURITY INVOKER (default) means the
-- caller's RLS still applies: knowledge_chunks_select lets any authenticated user
-- read system rows (user_id IS NULL) + their own. Called from src/lib/rag/search.ts.

create or replace function public.match_knowledge_chunks(
  query_embedding vector(768),
  match_count     int default 5
)
returns table (
  id            uuid,
  content       text,
  source_title  text,
  source_ref    text,
  source_tier   smallint,
  similarity    float
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    kc.id,
    kc.content,
    kc.source_title,
    kc.source_ref,
    kc.source_tier,
    1 - (kc.embedding <=> query_embedding) as similarity  -- cosine distance -> similarity
  from public.knowledge_chunks kc
  order by kc.embedding <=> query_embedding                -- nearest first
  limit match_count;
$$;

-- Authenticated users call this from the app (anon key); RLS inside still applies.
grant execute on function public.match_knowledge_chunks(vector, int) to authenticated;
