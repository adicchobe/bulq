-- Migration 0004 — Sprint 2.4: SEED data for foods + units (system reference rows)
--
-- Every row carries source_type + source_ref (pillars #1/#4: never invent numbers).
-- Per-100g macros from IFCT 2017 / USDA FoodData Central / Indian Nutrient Databank (INDB).
-- kcal_min/kcal_typical/kcal_max = conservative per-100g band (source + preparation variance);
-- portion variance is applied separately in the meal pipeline (Sprint 2.5).
--
-- Run in the Supabase SQL editor (privileged role bypasses RLS, so user_id = NULL system
-- rows are allowed). Re-runnable: it clears ONLY system rows (user_id IS NULL) first.
-- Safe now because no meals/custom-foods reference these yet.

delete from public.foods where user_id is null;
delete from public.units where user_id is null;

insert into public.foods
  (user_id, name, aliases, category, state, variance_class,
   kcal_typical, kcal_min, kcal_max, protein_g, fat_g, carb_g, fiber_g,
   source_type, source_ref, notes)
values
  (NULL, 'Whole wheat flour (atta)', ARRAY['atta', 'wheat flour', 'gehu atta']::text[], 'grain', 'raw', 'raw_ingredient', 341, 307, 375, 12.1, 1.7, 69.4, 11.2, 'IFCT2017', 'A019 (wheat flour, whole)', NULL),
  (NULL, 'Chapati / roti (whole wheat)', ARRAY['roti', 'phulka', 'chapatti', 'chapathi']::text[], 'grain', 'cooked', 'cooked_single', 297, 252, 356, 7.9, 7.5, 46.0, 4.9, 'USDA', '174075 (bread, chapati/roti, whole wheat)', 'Commercial value; a plain home phulka with no ghee is ~10-15% lower in kcal & fat. Band covers this.'),
  (NULL, 'Plain paratha', ARRAY['parantha', 'paratha plain']::text[], 'grain', 'cooked', 'composite', 320, 240, 432, 6.4, 13.2, 45.4, 9.6, 'USDA', '171307 (paratha)', 'Pan-fried in ~1 tsp oil.'),
  (NULL, 'Raw white rice', ARRAY['chawal', 'raw rice', 'uncooked rice']::text[], 'grain', 'raw', 'raw_ingredient', 360, 324, 396, 6.8, 0.5, 78.2, 0.2, 'IFCT2017', 'rice, raw, milled', NULL),
  (NULL, 'Cooked white rice', ARRAY['cooked rice', 'steamed rice', 'bhaat', 'chawal cooked']::text[], 'grain', 'cooked', 'cooked_single', 130, 110, 156, 2.7, 0.3, 28.2, 0.4, 'USDA', '168878 (rice, white, long-grain, cooked)', NULL),
  (NULL, 'Vegetable biryani', ARRAY['veg biryani', 'biryani']::text[], 'grain', 'cooked', 'composite', 170, 150, 230, 4.5, 7.5, 26.0, 2.0, 'INDB', 'INDB recipe (vegetable biryani)', 'Home-style ~1 tsp ghee/katori; restaurant versions run higher (toward the max).'),
  (NULL, 'Vegetable pulao', ARRAY['pulav', 'veg pulao', 'pulao']::text[], 'grain', 'cooked', 'composite', 155, 140, 200, 4.0, 6.0, 24.5, 2.0, 'INDB', 'INDB recipe (vegetable pulao)', NULL),
  (NULL, 'Poha', ARRAY['kanda poha', 'pohe', 'poha']::text[], 'grain', 'cooked', 'composite', 170, 150, 205, 3.0, 5.0, 28.5, 1.2, 'derived', 'INDB / Indian recipe DBs (cooked kanda poha)', 'With ~1 tsp oil + peanuts.'),
  (NULL, 'Upma', ARRAY['uppma', 'rava upma', 'upma']::text[], 'grain', 'cooked', 'composite', 145, 125, 175, 3.5, 5.0, 22.0, 1.2, 'derived', 'INDB / SnapCalorie (rava upma)', 'With ~1 tsp oil.'),
  (NULL, 'Toor dal (dry)', ARRAY['arhar dal', 'tur dal', 'red gram dal', 'toor dal dry']::text[], 'dal_legume', 'raw', 'raw_ingredient', 343, 309, 377, 21.7, 1.5, 62.8, 15.0, 'IFCT2017', 'B019 (red gram dal)', NULL),
  (NULL, 'Toor dal (cooked)', ARRAY['dal', 'tur dal cooked', 'arhar dal cooked', 'toor dal cooked']::text[], 'dal_legume', 'cooked', 'cooked_single', 115, 100, 145, 7.5, 3.5, 15.0, 4.5, 'INDB', 'INDB recipe (toor dal tadka)', 'Typical home dal with ~1 tsp oil tadka.'),
  (NULL, 'Moong dal (dry)', ARRAY['green gram dal', 'moong dal dry']::text[], 'dal_legume', 'raw', 'raw_ingredient', 347, 312, 382, 24.0, 1.2, 63.0, 16.3, 'IFCT2017', 'B015 (green gram dal)', NULL),
  (NULL, 'Moong dal (cooked)', ARRAY['moong dal cooked', 'moong']::text[], 'dal_legume', 'cooked', 'cooked_single', 110, 95, 135, 7.5, 3.0, 15.0, 4.5, 'INDB', 'INDB recipe (moong dal)', NULL),
  (NULL, 'Masoor dal (dry)', ARRAY['red lentil', 'masoor dal dry']::text[], 'dal_legume', 'raw', 'raw_ingredient', 352, 317, 387, 24.6, 1.1, 63.4, 10.7, 'IFCT2017', 'B018 (red lentil/masoor)', NULL),
  (NULL, 'Masoor dal (cooked)', ARRAY['masoor dal cooked', 'masoor']::text[], 'dal_legume', 'cooked', 'cooked_single', 112, 95, 140, 8.5, 3.0, 16.0, 3.5, 'INDB', 'INDB recipe (masoor dal)', NULL),
  (NULL, 'Chana dal (dry)', ARRAY['bengal gram dal', 'split chickpea', 'chana dal dry']::text[], 'dal_legume', 'raw', 'raw_ingredient', 360, 324, 396, 20.5, 6.0, 63.0, 12.2, 'IFCT2017', 'B009 (bengal gram dal)', NULL),
  (NULL, 'Chana dal (cooked)', ARRAY['chana dal cooked']::text[], 'dal_legume', 'cooked', 'cooked_single', 145, 120, 175, 8.0, 4.0, 20.0, 5.0, 'INDB', 'INDB recipe (chana dal)', 'Higher kcal than other dals (chana dal has more fat).'),
  (NULL, 'Urad dal (dry)', ARRAY['black gram dal', 'urad dal dry']::text[], 'dal_legume', 'raw', 'raw_ingredient', 341, 307, 375, 25.2, 1.6, 59.0, 18.3, 'IFCT2017', 'B005 (black gram dal)', NULL),
  (NULL, 'Urad dal (cooked)', ARRAY['urad dal cooked', 'urad']::text[], 'dal_legume', 'cooked', 'cooked_single', 110, 95, 135, 8.5, 3.0, 15.0, 5.5, 'INDB', 'INDB recipe (urad dal)', 'Dal makhani with cream/butter is much higher in fat.'),
  (NULL, 'Rajma (dry)', ARRAY['kidney beans', 'rajma dry', 'red kidney beans']::text[], 'dal_legume', 'raw', 'raw_ingredient', 337, 303, 371, 22.5, 1.1, 61.3, 15.2, 'USDA', '175192 (kidney beans, raw)', NULL),
  (NULL, 'Rajma curry (cooked)', ARRAY['rajma', 'rajma masala']::text[], 'dal_legume', 'cooked', 'composite', 130, 105, 175, 8.0, 5.0, 15.5, 6.0, 'INDB', 'INDB recipe (rajma curry)', 'Punjabi-style, onion-tomato masala + ~1 tbsp oil/portion.'),
  (NULL, 'Kabuli chana (dry)', ARRAY['chickpea', 'kabuli chana', 'safed chana', 'white chana']::text[], 'dal_legume', 'raw', 'raw_ingredient', 378, 340, 416, 20.5, 6.0, 63.0, 12.2, 'USDA', '173756 (chickpeas, raw)', NULL),
  (NULL, 'Chole (chickpea curry)', ARRAY['chole', 'chana masala', 'chhole']::text[], 'dal_legume', 'cooked', 'composite', 145, 110, 195, 8.0, 6.0, 18.0, 6.0, 'INDB', 'INDB recipe (chole)', 'Home-style.'),
  (NULL, 'Kala chana (dry)', ARRAY['black chickpea', 'kala chana dry']::text[], 'dal_legume', 'raw', 'raw_ingredient', 359, 323, 395, 18.0, 5.3, 60.0, 13.0, 'IFCT2017', 'B008 (black chickpea)', 'Verify exact value in IFCT PDF.'),
  (NULL, 'Boiled kala chana (snack)', ARRAY['boiled chana', 'kala chana boiled', 'boiled black chana']::text[], 'dal_legume', 'cooked', 'cooked_single', 164, 139, 197, 8.9, 2.6, 27.4, 7.6, 'USDA', '173757 (chickpeas, boiled)', 'Salt/lemon only. NOTE: this is COOKED weight (~9g protein/100g), not dry.'),
  (NULL, 'Soybean (dry)', ARRAY['soybean', 'soya bean']::text[], 'dal_legume', 'raw', 'raw_ingredient', 446, 401, 491, 36.5, 19.9, 30.2, 9.3, 'USDA', '174270 (soybeans, raw)', NULL),
  (NULL, 'Soya chunks (dry)', ARRAY['soya chunks', 'nutrela', 'meal maker', 'soy nuggets', 'soya nuggets']::text[], 'supplement', 'raw', 'raw_ingredient', 347, 312, 382, 53.0, 0.5, 33.0, 13.0, 'brand_label', 'Nutrela label (dry TVP)', 'Very high protein per 100g dry.'),
  (NULL, 'Soya chunk curry (cooked)', ARRAY['soya curry', 'soya chunk sabzi', 'soya sabzi']::text[], 'dal_legume', 'cooked', 'composite', 155, 120, 210, 16.0, 6.0, 10.0, 4.0, 'derived', 'INDB + soya chunk composition', 'Cooked; very high protein per 100g.'),
  (NULL, 'Paneer (full-fat)', ARRAY['paneer', 'cottage cheese', 'full fat paneer']::text[], 'dairy_paneer', 'raw', 'raw_ingredient', 280, 250, 320, 18.0, 23.0, 3.0, 0.0, 'derived', 'IFCT2017 (~265) + USDA FDC (321), full-fat', 'Full-fat. Low-fat paneer is ~150-170 kcal/100g with ~8-10g fat.'),
  (NULL, 'Paneer bhurji', ARRAY['paneer bhurji']::text[], 'dairy_paneer', 'cooked', 'composite', 260, 200, 350, 17.0, 20.0, 5.0, 1.5, 'INDB', 'INDB recipe (paneer bhurji)', 'With ~1 tsp oil, onion, tomato.'),
  (NULL, 'Whole milk', ARRAY['milk', 'doodh', 'cow milk', 'whole milk', 'full cream milk']::text[], 'dairy_paneer', 'raw', 'raw_ingredient', 67, 60, 74, 3.2, 4.4, 4.4, 0.0, 'IFCT2017', 'L002 (cow milk); cross-checked USDA', 'Indian whole/full-cream ~4.4% fat. Toned milk ~3% (~58 kcal); double-toned lower.'),
  (NULL, 'Curd / dahi', ARRAY['curd', 'dahi', 'yogurt', 'yoghurt']::text[], 'dairy_paneer', 'raw', 'raw_ingredient', 62, 56, 68, 3.5, 3.3, 4.7, 0.0, 'USDA', '171284 (yogurt, plain, whole); IFCT L004', 'Plain whole-milk curd.'),
  (NULL, 'Green peas (raw)', ARRAY['matar', 'green peas', 'peas raw']::text[], 'vegetable', 'raw', 'raw_ingredient', 81, 73, 89, 5.4, 0.4, 14.5, 5.7, 'USDA', '170419 (peas, green, raw)', NULL),
  (NULL, 'Matar sabzi', ARRAY['matar sabzi', 'peas sabzi']::text[], 'vegetable', 'cooked', 'composite', 125, 100, 165, 5.0, 6.0, 13.5, 4.5, 'derived', 'INDB / recipe reconstruction', 'Peas + ~1 tsp oil.'),
  (NULL, 'Cauliflower (raw)', ARRAY['gobi', 'cauliflower', 'phool gobi']::text[], 'vegetable', 'raw', 'raw_ingredient', 25, 22, 28, 1.9, 0.3, 5.0, 2.0, 'USDA', '169986 (cauliflower, raw)', NULL),
  (NULL, 'Gobi sabzi', ARRAY['gobi sabzi', 'aloo gobi']::text[], 'vegetable', 'cooked', 'composite', 85, 70, 95, 2.5, 5.0, 8.0, 3.0, 'INDB', 'INDB recipe (gobi sabzi)', 'With ~1 tsp oil/100g.'),
  (NULL, 'Brinjal (raw)', ARRAY['baingan', 'brinjal', 'eggplant', 'aubergine']::text[], 'vegetable', 'raw', 'raw_ingredient', 25, 22, 28, 1.0, 0.2, 5.9, 3.0, 'USDA', '169228 (eggplant, raw)', NULL),
  (NULL, 'Baingan sabzi / bharta', ARRAY['baingan bharta', 'baingan sabzi', 'bharta']::text[], 'vegetable', 'cooked', 'composite', 95, 80, 110, 2.0, 6.5, 7.5, 3.5, 'INDB', 'INDB recipe (baingan)', 'With ~1 tsp oil.'),
  (NULL, 'Bottle gourd (raw)', ARRAY['lauki', 'dudhi', 'bottle gourd', 'ghiya']::text[], 'vegetable', 'raw', 'raw_ingredient', 14, 13, 16, 0.6, 0.02, 3.4, 0.5, 'USDA', '168448 (gourd, white-flowered, raw)', NULL),
  (NULL, 'Lauki sabzi', ARRAY['lauki sabzi', 'dudhi sabzi']::text[], 'vegetable', 'cooked', 'composite', 68, 55, 80, 1.2, 5.0, 5.0, 2.0, 'INDB', 'INDB recipe (lauki)', 'With ~1 tsp oil/100g.'),
  (NULL, 'Green beans (raw)', ARRAY['french beans', 'green beans', 'beans', 'fansi']::text[], 'vegetable', 'raw', 'raw_ingredient', 31, 28, 34, 1.8, 0.2, 7.0, 2.7, 'USDA', '169961 (beans, snap, green, raw)', NULL),
  (NULL, 'Green beans sabzi', ARRAY['beans sabzi', 'french beans sabzi']::text[], 'vegetable', 'cooked', 'composite', 82, 70, 95, 2.5, 5.0, 8.5, 3.5, 'INDB', 'INDB recipe (beans sabzi)', NULL),
  (NULL, 'Potato (raw)', ARRAY['aloo', 'potato', 'batata']::text[], 'vegetable', 'raw', 'raw_ingredient', 73, 66, 80, 1.9, 0.1, 16.5, 2.4, 'USDA', '170093 (potato, raw)', NULL),
  (NULL, 'Aloo sabzi', ARRAY['aloo sabzi', 'aloo ki sabzi']::text[], 'vegetable', 'cooked', 'composite', 120, 100, 150, 2.5, 5.0, 19.5, 2.5, 'INDB', 'INDB / NutriScan (aloo sabzi)', 'Home-style with ~1 tsp oil.'),
  (NULL, 'Spinach (raw)', ARRAY['palak', 'spinach']::text[], 'vegetable', 'raw', 'raw_ingredient', 23, 21, 25, 2.9, 0.4, 3.6, 2.2, 'USDA', '168462 (spinach, raw)', NULL),
  (NULL, 'Palak sabzi', ARRAY['palak sabzi', 'sauteed spinach', 'palak']::text[], 'vegetable', 'cooked', 'composite', 80, 65, 90, 3.5, 5.0, 5.0, 3.0, 'INDB', 'INDB recipe (palak)', 'With garlic + ~1 tsp oil.'),
  (NULL, 'Palak paneer', ARRAY['palak paneer', 'saag paneer']::text[], 'vegetable', 'cooked', 'composite', 175, 150, 200, 9.0, 13.0, 6.5, 3.0, 'INDB', 'INDB recipe (palak paneer)', 'With ~50g paneer/portion.'),
  (NULL, 'Okra (raw)', ARRAY['bhindi', 'okra', 'ladyfinger', 'lady finger']::text[], 'vegetable', 'raw', 'raw_ingredient', 33, 30, 36, 1.9, 0.2, 7.4, 3.2, 'USDA', '169260 (okra, raw)', NULL),
  (NULL, 'Bhindi sabzi', ARRAY['bhindi sabzi', 'bhindi masala']::text[], 'vegetable', 'cooked', 'composite', 85, 65, 95, 2.5, 5.0, 8.0, 3.5, 'INDB', 'INDB / NutriScan (bhindi sabzi)', 'Sauteed, ~1 tsp oil.'),
  (NULL, 'Chicken breast (raw)', ARRAY['chicken breast raw', 'raw chicken']::text[], 'non_veg', 'raw', 'raw_ingredient', 120, 108, 132, 22.5, 2.6, 0.0, 0.0, 'USDA', '171477 (chicken breast, raw, skinless)', NULL),
  (NULL, 'Chicken breast (cooked)', ARRAY['chicken breast', 'cooked chicken', 'grilled chicken', 'chicken', 'roasted chicken']::text[], 'non_veg', 'cooked', 'cooked_single', 165, 148, 198, 31.0, 3.6, 0.0, 0.0, 'USDA', '171534 (chicken breast, roasted, skinless)', 'COOKED weight. ~150g raw cooks down to ~110g. Gold-standard lean protein.'),
  (NULL, 'Egg, whole (raw)', ARRAY['egg raw', 'anda', 'raw egg']::text[], 'non_veg', 'raw', 'raw_ingredient', 143, 129, 157, 12.6, 9.5, 0.7, 0.0, 'USDA', '171287 (egg, whole, raw)', NULL),
  (NULL, 'Boiled egg (whole)', ARRAY['boiled egg', 'uble ande', 'hard boiled egg', 'ubla anda']::text[], 'non_veg', 'cooked', 'cooked_single', 155, 139, 186, 12.6, 10.6, 1.1, 0.0, 'USDA', '173424 (egg, whole, hard-boiled)', 'Per 100g. One large egg (~50g) is about 78 kcal / 6.3g protein.'),
  (NULL, 'Whey protein (concentrate)', ARRAY['whey', 'whey protein', 'protein powder', 'whey concentrate']::text[], 'supplement', 'raw', 'raw_ingredient', 400, 360, 440, 80.0, 5.0, 10.0, 0.0, 'brand_label', 'Aggregate of major Indian brands', 'Per 100g. One ~30g scoop is roughly 120 kcal / 24g protein. Read your tub''s label.'),
  (NULL, 'Chia seeds (dry)', ARRAY['chia', 'chia seeds']::text[], 'supplement', 'raw', 'raw_ingredient', 486, 437, 535, 16.5, 30.7, 42.1, 34.4, 'USDA', '170554 (chia seeds, dried)', 'Not in IFCT 2017; USDA is the source.'),
  (NULL, 'Mixed raw salad', ARRAY['salad', 'mixed salad', 'kachumber', 'green salad']::text[], 'vegetable', 'raw', 'raw_ingredient', 30, 27, 33, 1.2, 0.3, 6.0, 2.0, 'derived', 'USDA raw-veg average (cucumber/tomato/onion/carrot)', 'No dressing.'),
  (NULL, 'Banana (ripe)', ARRAY['banana', 'kela']::text[], 'fruit', 'raw', 'raw_ingredient', 90, 81, 99, 1.1, 0.3, 22.8, 2.6, 'USDA', '173944 (banana, raw)', 'One medium banana (~100-120g) is about 90-110 kcal.'),
  (NULL, 'Black coffee (no sugar)', ARRAY['black coffee', 'coffee no sugar', 'kala coffee']::text[], 'beverage', 'cooked', 'cooked_single', 2, 1, 3, 0.3, 0.0, 0.0, 0.0, 'USDA', 'coffee, brewed, plain', '''cooked'' = prepared. Negligible calories.'),
  (NULL, 'Coffee with milk & sugar', ARRAY['coffee with milk', 'milk coffee', 'doodh coffee']::text[], 'beverage', 'cooked', 'composite', 60, 45, 80, 1.7, 2.0, 8.0, 0.0, 'derived', 'Computed from milk + 1 tsp sugar', '~50ml milk + 1 tsp sugar; varies with milk/sugar.'),
  (NULL, 'Masala chai', ARRAY['chai', 'tea', 'masala chai', 'cutting chai', 'doodh chai']::text[], 'beverage', 'cooked', 'composite', 70, 55, 95, 1.7, 2.2, 10.0, 0.0, 'derived', 'Computed from milk + sugar', '~150ml: 50ml milk + 1.5 tsp sugar; restaurant/cutting chai higher.');

insert into public.units
  (user_id, unit_key, label, grams_typical, grams_min, grams_max, source_ref, notes)
values
  (NULL, 'chapati', '1 medium chapati / phulka (palm-size)', 40, 30, 50, 'ICMR My Plate 2024 + Indian refs', NULL),
  (NULL, 'paratha', '1 medium plain paratha', 65, 50, 90, 'Indian refs', 'Heavier than roti (layered oil/ghee, larger).'),
  (NULL, 'katori_rice', '1 katori cooked rice', 150, 120, 180, 'Standard katori ~150ml', NULL),
  (NULL, 'katori_dal', '1 katori cooked dal (medium consistency)', 150, 120, 180, 'Standard katori ~150ml', 'Thin dal ~120g, thick ~180g.'),
  (NULL, 'katori_sabzi', '1 katori dry/semi-dry sabzi', 100, 80, 130, 'Standard katori', NULL),
  (NULL, 'katori_gravy', '1 katori gravy sabzi (palak paneer, rajma)', 150, 130, 200, 'Standard katori', 'Includes gravy volume.'),
  (NULL, 'katori_poha_upma', '1 katori poha / upma', 120, 100, 160, 'Standard katori', 'Cooked weight.'),
  (NULL, 'plate_biryani', '1 plate biryani / pulao', 275, 200, 400, 'Indian refs', 'Home serving 200-250g; restaurant 300-400g.'),
  (NULL, 'paneer_serving', '1 paneer serving (5-6 cubes)', 50, 30, 80, 'ICMR My Plate (substitute)', NULL),
  (NULL, 'egg_large', '1 boiled egg (large)', 50, 45, 60, 'USDA standard large egg', 'Small Indian eggs ~40-45g.'),
  (NULL, 'scoop_whey', '1 whey protein scoop', 30, 28, 35, 'Manufacturer-defined', 'Most Indian brands print 30g or 33g.'),
  (NULL, 'tbsp_chia', '1 tbsp chia seeds (level)', 12, 10, 14, 'USDA standard tbsp', NULL),
  (NULL, 'banana_medium', '1 medium banana', 110, 80, 150, 'ICMR My Plate (100g fruit)', NULL),
  (NULL, 'glass_milk', '1 glass milk', 200, 150, 250, 'ICMR My Plate (300ml/day)', NULL),
  (NULL, 'cup_curd', '1 cup curd', 150, 100, 200, 'Standard katori', NULL),
  (NULL, 'cup_chai', '1 cup chai', 150, 100, 200, 'Indian refs', 'Cutting chai 100ml; mug 200ml.');
