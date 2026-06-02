-- 0011_foods_source_type_user.sql
-- "Teach your foods" feature: allow user-taught food entries.
alter table public.foods drop constraint foods_source_type_check;
alter table public.foods add constraint foods_source_type_check
  check (source_type in ('IFCT2017','USDA','INDB','brand_label','derived','user'));
