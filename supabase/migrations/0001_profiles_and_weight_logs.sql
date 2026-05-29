-- Migration 0001 — Sprint 1: profiles + weight_logs
--
-- Scope: only the two tables Sprint 1 needs (not all 11 from the data model).
-- Conventions:
--   * Enumerated columns use TEXT + CHECK (not Postgres ENUM) so allowed values
--     are easy to extend later without ALTER TYPE migrations.
--   * Every table is user_id-scoped with Row-Level Security enabled and policies
--     restricting access to auth.uid() = user_id (pillar #8, non-negotiable).
--   * Idempotent: safe to re-run (IF NOT EXISTS; DROP POLICY IF EXISTS first).

-- =====================================================================
-- profiles — one row per user; their body data, goal, and context.
-- =====================================================================
create table if not exists public.profiles (
  user_id                  uuid primary key references auth.users (id) on delete cascade,

  sex                      text    not null check (sex in ('male', 'female')),
  age_years                integer not null check (age_years between 1 and 120),
  height_cm                numeric not null check (height_cm > 0),
  current_weight_kg        numeric not null check (current_weight_kg > 0),
  goal_weight_kg           numeric          check (goal_weight_kg > 0),

  goal_direction           text    not null check (goal_direction in ('gain', 'lose', 'maintain')),
  goal_rate_pct_per_week   numeric          check (goal_rate_pct_per_week >= 0),

  activity_level           text    not null check (
                             activity_level in (
                               'sedentary', 'light', 'moderate',
                               'moderate_plus', 'active', 'very_active'
                             )
                           ),
  training_days_per_week   integer          check (training_days_per_week between 0 and 7),

  ectomorph_adjustment_pct numeric not null default 0 check (ectomorph_adjustment_pct >= 0),
  dietary_pattern          text,
  chicken_max_per_week     integer          check (chicken_max_per_week >= 0),

  medical_flags            jsonb   not null default '{}'::jsonb,
  sleep_avg_hours          numeric          check (sleep_avg_hours >= 0 and sleep_avg_hours <= 24),
  kitchen_context          jsonb   not null default '{}'::jsonb,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- =====================================================================
-- weight_logs — longitudinal weight record; one row per measurement.
-- =====================================================================
create table if not exists public.weight_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,

  weight_kg   numeric not null check (weight_kg > 0),
  logged_at   timestamptz not null default now(),  -- when the entry was recorded
  measured_at date,                                -- the day the weight applies to

  notes       text,
  source      text not null default 'manual',

  created_at  timestamptz not null default now()
);

-- Index for weekly-trend / recalibration queries (per-user, ordered by date).
create index if not exists idx_weight_logs_user_measured
  on public.weight_logs (user_id, measured_at);

-- =====================================================================
-- updated_at auto-touch (addition: keeps profiles.updated_at honest).
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- =====================================================================
-- Row-Level Security — pillar #8. A user sees and touches ONLY their rows.
-- =====================================================================
alter table public.profiles    enable row level security;
alter table public.weight_logs enable row level security;

-- profiles: full access to own row only.
drop policy if exists "profiles_owner_all" on public.profiles;
create policy "profiles_owner_all"
  on public.profiles
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- weight_logs: full access to own rows only.
drop policy if exists "weight_logs_owner_all" on public.weight_logs;
create policy "weight_logs_owner_all"
  on public.weight_logs
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
