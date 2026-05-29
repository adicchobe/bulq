-- Migration 0003 — Sprint 2: foods + units (shared reference data)
--
-- DIFFERENT RLS MODEL from 0001/0002. foods and units are SHARED REFERENCE data:
--   * user_id IS NULL  → system/global row, readable by every authenticated user.
--   * user_id = a uuid → a user's own custom row, visible only to them.
-- So policies are split per-operation: everyone can SELECT system + own rows,
-- but INSERT/UPDATE/DELETE are restricted to the caller's own rows — users can
-- never modify or delete the shared system rows.
--
-- Conventions follow 0001/0002 (TEXT+CHECK enums; idempotent). Reuses the
-- set_updated_at() function defined in migration 0001.
--
-- Schema only — no data. Seed data is provided separately from a sourced dataset
-- (pillars #1/#4: never invent nutritional numbers; provenance is mandatory).

-- =====================================================================
-- foods — Indian-first food composition reference (per-100g macros).
-- =====================================================================
create table if not exists public.foods (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users (id) on delete cascade,  -- NULL = system/global

  name           text not null,
  aliases        text[],  -- alternate names for matching, e.g. {'roti','phulka'} for chapati

  category       text not null check (
                   category in (
                     'grain', 'dal_legume', 'dairy_paneer', 'vegetable',
                     'non_veg', 'supplement', 'fruit', 'beverage', 'composite'
                   )
                 ),
  state          text not null check (state in ('raw', 'cooked')),  -- raw ingredient vs cooked-as-eaten
  variance_class text not null check (
                   variance_class in (
                     'raw_ingredient', 'cooked_single', 'composite', 'restaurant'
                   )
                 ),  -- drives the conservative band applied later in the meal pipeline

  -- Per-100g conservative kcal band (pillar #5).
  kcal_typical   numeric not null,
  kcal_min       numeric not null,
  kcal_max       numeric not null,

  -- Per-100g typical point macros.
  protein_g      numeric not null,
  fat_g          numeric not null,
  carb_g         numeric not null,
  fiber_g        numeric not null,

  -- Provenance is mandatory (pillars #1/#4).
  source_type    text not null check (
                   source_type in ('IFCT2017', 'USDA', 'INDB', 'brand_label', 'derived')
                 ),
  source_ref     text,   -- IFCT code / USDA FDC id / INDB recipe id
  notes          text,   -- e.g. added-fat assumption for a cooked dish

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- =====================================================================
-- units — portion-to-grams conversions (Indian household units).
-- =====================================================================
create table if not exists public.units (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users (id) on delete cascade,  -- NULL = system standard; non-null = per-user calibration (R5)

  unit_key      text not null,  -- e.g. 'chapati','katori_dal','scoop_whey','egg_large'
  label         text not null,  -- human-readable, e.g. '1 medium chapati (palm-size)'

  grams_typical numeric not null,
  grams_min     numeric not null,
  grams_max     numeric not null,

  source_ref    text,   -- e.g. 'ICMR My Plate 2024'
  notes         text,

  created_at    timestamptz not null default now()
);

-- =====================================================================
-- Indexes.
-- =====================================================================
create index if not exists idx_foods_category on public.foods (category);
create index if not exists idx_foods_aliases_gin on public.foods using gin (aliases);
create index if not exists idx_units_unit_key on public.units (unit_key);

-- Support the RLS user_id filter (read on every reference lookup).
create index if not exists idx_foods_user_id on public.foods (user_id);
create index if not exists idx_units_user_id on public.units (user_id);

-- =====================================================================
-- updated_at auto-touch on foods (reuses set_updated_at() from migration 0001).
-- =====================================================================
drop trigger if exists trg_foods_set_updated_at on public.foods;
create trigger trg_foods_set_updated_at
  before update on public.foods
  for each row
  execute function public.set_updated_at();

-- =====================================================================
-- Row-Level Security — shared-reference model (per-operation policies).
-- =====================================================================
alter table public.foods enable row level security;
alter table public.units enable row level security;

-- foods: read system rows + own rows; write only own rows.
drop policy if exists "foods_select_system_or_own" on public.foods;
create policy "foods_select_system_or_own"
  on public.foods
  for select
  to authenticated
  using (user_id is null or auth.uid() = user_id);

drop policy if exists "foods_insert_own" on public.foods;
create policy "foods_insert_own"
  on public.foods
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "foods_update_own" on public.foods;
create policy "foods_update_own"
  on public.foods
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "foods_delete_own" on public.foods;
create policy "foods_delete_own"
  on public.foods
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- units: same shared-reference model.
drop policy if exists "units_select_system_or_own" on public.units;
create policy "units_select_system_or_own"
  on public.units
  for select
  to authenticated
  using (user_id is null or auth.uid() = user_id);

drop policy if exists "units_insert_own" on public.units;
create policy "units_insert_own"
  on public.units
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "units_update_own" on public.units;
create policy "units_update_own"
  on public.units
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "units_delete_own" on public.units;
create policy "units_delete_own"
  on public.units
  for delete
  to authenticated
  using (auth.uid() = user_id);
