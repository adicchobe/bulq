-- Migration 0006 — Sprint 2.5: meals + meal_items (logged meals)
--
-- USER DATA → STANDARD per-user RLS (auth.uid() = user_id), like profiles/
-- messages/api_usage_log — NOT the foods shared-reference model.
--
-- Conventions follow 0001/0002/0005 (TEXT+CHECK enums; FOR ALL per-user policy;
-- idempotent; reuses set_updated_at() from migration 0001).
--
-- Totals are stored on `meals` (sum of items) for fast daily reads; per-item
-- values live on `meal_items`. All macro/kcal values are nullable until the meal
-- pipeline resolves them. kcal carries a min/typical/max band (pillars #2/#3).

-- =====================================================================
-- meals — one logged eating event.
-- =====================================================================
create table if not exists public.meals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,

  logged_at    timestamptz not null default now(),  -- when the user ate / logged
  raw_text     text,                                -- original NL input, for audit/corrections
  meal_type    text check (
                 meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'unknown')
               ),                                    -- nullable, best-effort
  note         text,

  -- Per-meal computed totals (sum of items); nullable until items resolved.
  kcal_min     numeric,
  kcal_typical numeric,
  kcal_max     numeric,
  protein_g    numeric,
  fat_g        numeric,
  carb_g       numeric,
  fiber_g      numeric,

  confidence   text check (confidence in ('high', 'medium', 'low')),  -- worst-item rule
  status       text not null default 'pending'
                 check (status in ('pending', 'confirmed', 'rejected')),  -- pending = awaiting user confirmation

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- =====================================================================
-- meal_items — one food within a meal.
-- user_id is denormalized from meals for simple, fast RLS (like messages).
-- =====================================================================
create table if not exists public.meal_items (
  id                uuid primary key default gen_random_uuid(),
  meal_id           uuid not null references public.meals (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,

  -- food_id: nullable (null when unmatched/estimated). ON DELETE SET NULL — NOT
  -- cascade — so a foods re-seed (migration 0004 deletes+reinserts system rows)
  -- never destroys a user's logged meal history; matched_food_name preserves the
  -- display name even if the link is later nulled.
  food_id           uuid references public.foods (id) on delete set null,
  food_name_raw     text not null,   -- what the user said for this item ("roti")
  matched_food_name text,            -- the resolved foods.name, for display/audit

  quantity          numeric not null,  -- e.g. 3
  unit_key          text,              -- e.g. 'chapati','katori_dal' (units table, conceptual)
  grams_used        numeric,           -- resolved portion in grams
  match_method      text check (
                      match_method in ('exact', 'alias', 'fuzzy', 'llm_inferred', 'unknown')
                    ),                  -- provenance of the match

  -- Per-item computed macros; nullable until resolved.
  kcal_min          numeric,
  kcal_typical      numeric,
  kcal_max          numeric,
  protein_g         numeric,
  fat_g             numeric,
  carb_g            numeric,
  fiber_g           numeric,

  created_at        timestamptz not null default now()
);

-- =====================================================================
-- Indexes.
-- =====================================================================
create index if not exists idx_meals_user_logged
  on public.meals (user_id, logged_at desc);            -- daily reads, recent-first
create index if not exists idx_meal_items_meal
  on public.meal_items (meal_id);                       -- load a meal's items
create index if not exists idx_meal_items_user
  on public.meal_items (user_id);                       -- RLS / per-user queries

-- =====================================================================
-- updated_at auto-touch on meals (reuses set_updated_at() from migration 0001).
-- =====================================================================
drop trigger if exists trg_meals_set_updated_at on public.meals;
create trigger trg_meals_set_updated_at
  before update on public.meals
  for each row
  execute function public.set_updated_at();

-- =====================================================================
-- Row-Level Security — pillar #8. Standard per-user: own rows only.
-- =====================================================================
alter table public.meals      enable row level security;
alter table public.meal_items enable row level security;

drop policy if exists "meals_owner_all" on public.meals;
create policy "meals_owner_all"
  on public.meals
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "meal_items_owner_all" on public.meal_items;
create policy "meal_items_owner_all"
  on public.meal_items
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
