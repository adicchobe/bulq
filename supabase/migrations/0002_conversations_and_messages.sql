-- Migration 0002 — Sprint 2: conversations + messages (chat history)
--
-- Same conventions as 0001:
--   * Enumerated columns use TEXT + CHECK (not Postgres ENUM).
--   * user_id-scoped with RLS enabled; policies restrict access to
--     auth.uid() = user_id (pillar #8, non-negotiable).
--   * Idempotent: safe to re-run (IF NOT EXISTS; DROP POLICY IF EXISTS first).
--
-- MVP uses one long thread per user, but the model allows many conversations.

-- =====================================================================
-- conversations — a chat thread.
-- =====================================================================
create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,

  title           text,                                  -- nullable; can be auto-set later
  started_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now(),    -- bumped as messages arrive

  created_at      timestamptz not null default now()
);

-- =====================================================================
-- messages — individual chat messages within a conversation.
-- user_id is denormalized from conversations for simpler, faster RLS.
-- =====================================================================
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,

  role            text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content         text not null,

  tool_calls      jsonb,     -- nullable; tool-using turns (Sprint 2 orchestrator)
  cited_sources   jsonb,     -- nullable; RAG citations (Sprint 3)
  model_used      text,      -- nullable; which model produced an assistant message
  tokens_used     integer,   -- nullable; cost tracking
  finish_reason   text,      -- nullable; matches the adapter's finishReason ('stop'/'length'/etc)

  created_at      timestamptz not null default now()
);

-- =====================================================================
-- Indexes.
-- =====================================================================
-- Load a thread's messages in order.
create index if not exists idx_messages_conversation_created
  on public.messages (conversation_id, created_at);

-- List a user's threads, most-recently-active first.
create index if not exists idx_conversations_user_last_message
  on public.conversations (user_id, last_message_at desc);

-- =====================================================================
-- Row-Level Security — pillar #8. A user sees and touches ONLY their rows.
-- =====================================================================
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

-- conversations: full access to own rows only.
drop policy if exists "conversations_owner_all" on public.conversations;
create policy "conversations_owner_all"
  on public.conversations
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- messages: full access to own rows only (via denormalized user_id).
drop policy if exists "messages_owner_all" on public.messages;
create policy "messages_owner_all"
  on public.messages
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
