-- Migration 0008 — response_flags (anti-hallucination WATCH-mode log)
--
-- One row per assistant reply that the post-processor flagged (WATCH mode: we log,
-- we never block or edit). Lean + debuggable. STANDARD per-user RLS like meals.
--
-- DRAFT — review before running in the Supabase SQL editor. Idempotent.

create table if not exists public.response_flags (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  conversation_id  uuid references public.conversations (id) on delete set null, -- nullable
  created_at       timestamptz not null default now(),

  path             text not null check (path in ('question', 'meal_log')),
  response_excerpt text,                                  -- truncated reply, for eyeballing
  violations       jsonb not null default '[]'::jsonb,    -- [{ type, detail }]
  allowed_facts    jsonb                                  -- the facts passed to the checker (debug)
);

-- Recent flags per user, newest first.
create index if not exists idx_response_flags_user_created
  on public.response_flags (user_id, created_at desc);

-- Row-Level Security — pillar #8. Own rows only.
alter table public.response_flags enable row level security;

drop policy if exists "response_flags_owner_all" on public.response_flags;
create policy "response_flags_owner_all"
  on public.response_flags
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
