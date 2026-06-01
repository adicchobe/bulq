-- 0009_knowledge_chunks.sql
-- Sprint 3 (RAG): the trusted source library Bulq cites from (pillar #4).
-- SHARED-REFERENCE data, mirroring the foods/units pattern (§16):
--   user_id NULL  = system row, readable by ALL authenticated users
--   user_id set   = (future) a user's own custom chunk
-- Vectors: text-embedding-004 @ 768 dims, manually normalized before insert.

-- 1. Enable pgvector (no-op if already enabled).
create extension if not exists vector;

-- 2. The table.
create table if not exists public.knowledge_chunks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users (id) on delete cascade,  -- NULL = system row
  content         text        not null,                 -- the chunk text Bulq reads/quotes from
  embedding       vector(768) not null,                 -- normalized, 768-dim
  source_title    text        not null,                 -- e.g. "ICMR-NIN Dietary Guidelines for Indians (2024)"
  source_ref      text        not null,                 -- URL or citation string shown to the user
  source_tier     smallint    not null,                 -- 1 = ICMR-NIN, 2 = Examine/PMC, 3 = neutral media
  evidence_grade  text,                                 -- optional free-text grade (e.g. "RCT", "meta-analysis", "guideline")
  topic           text,                                 -- optional pre-filter tag (e.g. "protein", "b12", "whey")
  token_count     integer,                              -- chunk size bookkeeping
  created_at      timestamptz not null default now(),
  constraint knowledge_chunks_tier_chk check (source_tier in (1, 2, 3))
);

-- 3. Vector index for fast cosine similarity search.
-- HNSW with cosine ops. Tiny corpus, but costs nothing and is future-proof.
create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks
  using hnsw (embedding vector_cosine_ops);

-- Helpful secondary index for optional topic pre-filtering.
create index if not exists knowledge_chunks_topic_idx
  on public.knowledge_chunks (topic);

-- 4. Row Level Security — mirrors the foods/units shared-reference pattern.
alter table public.knowledge_chunks enable row level security;

-- SELECT: any authenticated user can read system rows (user_id IS NULL) OR their own custom rows.
create policy "knowledge_chunks_select"
  on public.knowledge_chunks
  for select
  to authenticated
  using (user_id is null or user_id = auth.uid());

-- INSERT: a user may only insert rows owned by themselves (system rows are seeded server-side, not by clients).
create policy "knowledge_chunks_insert"
  on public.knowledge_chunks
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- UPDATE: a user may only modify their own rows (never system rows).
create policy "knowledge_chunks_update"
  on public.knowledge_chunks
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- DELETE: a user may only delete their own rows (never system rows).
create policy "knowledge_chunks_delete"
  on public.knowledge_chunks
  for delete
  to authenticated
  using (user_id = auth.uid());
