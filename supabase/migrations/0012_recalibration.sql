-- 0012_recalibration.sql
-- Sprint 4.3: TDEE recalibration from real weight trend (brief §15).
-- A running kcal adjustment to the user's effective TDEE, accumulated from
-- recalibration runs. Applied inside computeNutritionTargets, so every target
-- consumer (dashboard, chat system prompt, chat allowed-numbers) inherits it.
-- 0 = no recalibration yet (the formula's opening guess stands).
-- recalibrated_at gates a 14-day cooldown between adjustments (null = never).
alter table public.profiles
  add column if not exists recalibration_adjustment_kcal numeric not null default 0;
alter table public.profiles
  add column if not exists recalibrated_at timestamptz;
