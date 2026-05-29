-- Migration 0005 — Sprint 2.4b: api_usage_log (LLM cost + reliability tracking)
--
-- Foundation for cost tracking (R3: $4.51 Anthropic balance) and the usage
-- dashboard, and for observing the Gemini thinking-token cost gap (R11).
--
-- STANDARD per-user RLS model (auth.uid() = user_id), like profiles/weight_logs/
-- messages — this is the user's own usage data, NOT shared reference.
--
-- Conventions follow 0001-0004 (TEXT+CHECK enums; idempotent).

-- =====================================================================
-- api_usage_log — one row per LLM API call.
-- =====================================================================
create table if not exists public.api_usage_log (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  created_at         timestamptz not null default now(),

  provider           text not null check (provider in ('gemini', 'anthropic')),
  model              text not null,  -- e.g. 'gemini-2.5-flash', 'claude-haiku-4-5-20251001'
  priority           text check (priority in ('standard', 'high_stakes')),  -- routing tier (LLMPriority)
  operation          text,           -- nullable; e.g. 'chat','parse','reason','compose'

  prompt_tokens      integer,
  completion_tokens  integer,
  total_tokens       integer,
  estimated_cost_usd numeric not null default 0,  -- 0 for free-tier Gemini; computed for Claude

  finish_reason      text,           -- mirrors the adapter's finishReason
  success            boolean not null default true,
  error_type         text,           -- nullable; 'rate_limit','timeout','server_error','auth','other'
  failed_over        boolean not null default false,  -- true if this call was a failover from the other provider
  latency_ms         integer         -- nullable
);

-- =====================================================================
-- Index — recent-usage queries (per user, newest first).
-- =====================================================================
create index if not exists idx_api_usage_log_user_created
  on public.api_usage_log (user_id, created_at desc);

-- =====================================================================
-- Row-Level Security — pillar #8. A user sees and touches ONLY their rows.
-- =====================================================================
alter table public.api_usage_log enable row level security;

drop policy if exists "api_usage_log_owner_all" on public.api_usage_log;
create policy "api_usage_log_owner_all"
  on public.api_usage_log
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
