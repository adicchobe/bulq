-- Migration 0007 — alias coverage fixes (bare-token gaps found in the matchFood audit)
--
-- Bare tokens "egg/eggs/ande", "rice", "chana", "chapati" failed to match (or only
-- fuzzy-matched). These UPDATEs add the missing aliases on the right system rows.
--
-- Idempotent / re-runnable: each UPDATE rebuilds aliases as a deduplicated set
-- (array(select distinct unnest(...))), so re-running adds no duplicates. System
-- rows only (user_id IS NULL). Run in the Supabase SQL editor.
--
-- NOTE: 0004 (seed) deletes + re-inserts system rows on re-run, which would wipe
-- these aliases — re-apply 0007 after any 0004 re-run (or fold these into 0004 later).

-- Boiled egg (whole): bare egg terms → boiled (the eaten form, not raw).
update public.foods
set aliases = array(
  select distinct unnest(aliases || array['egg', 'eggs', 'boiled eggs', 'ande', 'anda']::text[])
)
where user_id is null and name = 'Boiled egg (whole)';

-- Egg, whole (raw): REMOVE 'anda' so bare egg terms resolve to boiled, not raw.
-- (Keep 'egg raw' and 'raw egg'.)
update public.foods
set aliases = array(
  select distinct unnest(aliases)
  except
  select unnest(array['anda']::text[])
)
where user_id is null and name = 'Egg, whole (raw)';

-- Cooked white rice: bare 'rice' → cooked.
update public.foods
set aliases = array(
  select distinct unnest(aliases || array['rice']::text[])
)
where user_id is null and name = 'Cooked white rice';

-- Boiled kala chana (snack): bare 'chana' → his actual snack (§3).
update public.foods
set aliases = array(
  select distinct unnest(aliases || array['chana']::text[])
)
where user_id is null and name = 'Boiled kala chana (snack)';

-- Chapati / roti: explicit 'chapati' alias (was only matching via fuzzy ~0.875).
update public.foods
set aliases = array(
  select distinct unnest(aliases || array['chapati']::text[])
)
where user_id is null and name = 'Chapati / roti (whole wheat)';
