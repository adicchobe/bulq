# Bulq — Project Brief

> Living document. Canonical context for Claude Code, future Claude.ai sessions, and any AI assistant working on this project. Updated at the end of each major decision point.
>
> **Last updated:** END of Sprint 5 — **ALL SPRINTS COMPLETE (v10).** v0.1 MVP is LIVE. Teach-your-foods, weight logging, trend analysis, TDEE recalibration, meal suggestions, RAG citations, anti-hallucination (5 checks), prod cache strategy, question fast-path, mic icon, chicken unit — all deployed. **130 tests passing. Now in daily-use / live-testing mode. NEXT = v0.2 (productization prep).**

---

## 1. Identity

- **Name:** Bulq (working name, changeable)
- **Type:** AI-assisted nutritional reasoning partner for naturally skinny individuals
- **Primary user (POC):** Self-build by user (Aditya), age 26, Mumbai, India
- **GitHub:** github.com/adicchobe/bulq (private)
- **Live URL:** Vercel auto-generated (rename later — Vercel dashboard setting, not code). Production URL on the Vercel dashboard is the stable one to use. Project = `bulq-dev` (Supabase, single project behind both localhost and prod).
- **Productization path:** Single-tenant POC → public multi-tenant SaaS for skinny-individual demographic, India-first
- **Pivot possibility:** Architecture is caloric-balance-direction-agnostic; can also serve weight-loss users without rewrite

## 2. Mission

A credibility-anchored nutritional reasoning partner. **Not** a meal-plan generator. It sits beside the user all day, knows their body and goal, listens to what they've actually eaten, and tells them what to do next — with sources, with uncertainty, and with respect for what's in their kitchen and budget.

## 3. Primary user profile (POC)

| Attribute | Value |
|---|---|
| Age | 26 |
| Sex | Male |
| Location | Mumbai, India |
| Height | 180 cm |
| Current weight | **54 kg (CONFIRMED current, May 2026)** — BMI 16.7, underweight per WHO |
| Target weight | 62–65 kg (form default stored as 63) |
| Diet | Vegetarian primary; egg daily acceptable; chicken 1–2× per week max |
| Training | 5×/week consistent baseline; partial-equipment gym now, fully equipped gym soon; ~45 min sessions |
| Cooking situation | Maid cooks main meals; user self-preps supplements (boiled eggs, milk, chana, chia) |
| Sleep | 8 hours average — excellent foundation |
| Digestion | No general issues; mild discomfort with night-time whey protein shakes (suspected lactose sensitivity in concentrate) |
| Health checkup | DONE & REVIEWED (see §3a). No flags affecting nutrition targets. |
| Cultural context | Indian home cooking + Mumbai food access |
| Goal direction | Sustainable lean weight gain at 0.25–0.4% body weight per week |
| Tech comfort | Minimal coding — guided step-by-step; builds via Claude Code |
| Hosting budget | Strictly free tiers only for POC |

### 3a. Lab report review (Apollo ProHealth, Aug 2025 — 3 PDFs, reviewed by Claude as informed layperson, NOT a diagnosis)
- All clean: Hb 16.3 (no anemia), fasting glucose 91, lipids healthy (HDL 57), kidney/liver/urine/ECG/chest-Xray normal, AICVD cardiac risk low. Physician said "nothing significant."
- **No flags affecting nutrition targets; higher-protein lean-gain surplus eating is appropriate.**
- ⚠️ Report weight was 58.55 kg (Aug 2025); user is **54 kg now** → he has LOST weight since Aug → the surplus matters even more.
- ⚠️ B12 & Vitamin D were NOT tested (common vegetarian gaps) — suggested as a future basic check, non-urgent.

### Computed defaults (stored in DB profile; recalibrated from real weight trend via 4.3)
- **BMR (Mifflin-St Jeor):** 1540 kcal/day
- **TDEE (1.6× via 'moderate_plus' multiplier):** ~2464 kcal/day
- **Ectomorph-adjusted maintenance (+7%):** ~2636 kcal/day
- **Daily target (+300 kcal lean-gain surplus):** ~2936 kcal/day (range ~2736–3136, ±200 band)
- **Protein target (1.8 g/kg):** ~97 g/day
- **Realistic timeline 54 → 62 kg:** ~9–14 months at sustainable rates
- **Recalibration (4.3):** ±200 kcal per 2-week cycle based on actual vs expected weight trend. Capped at ±600, 14-day cooldown. Stored in `profiles.recalibration_adjustment_kcal`, applied in `computeNutritionTargets` → all consumers (dashboard, chat, system prompt) inherit automatically.

## 4. Behavioral pillars (non-negotiable)

1. **Never invent nutritional numbers.** Use database lookups or cite sources. If unknown, say "I don't know precisely" and show a range. (LIVE: 60 system foods + user-taught foods carry sourced/user-provided macros; the meal pipeline NEVER lets the LLM emit calories; chat numbers come ONLY from the foods DB / day-state / available-foods list; the system prompt says "use only the values provided in this prompt"; the anti-hallucination post-processor watches for slips.)
2. **Always surface uncertainty.** Show ranges, never false precision. (LIVE: per-100g kcal band + portion band compounded into every meal item; worst-item confidence on every meal; consumed/remaining shown as ranges in chat.)
3. **Conservative estimates by default for planning.** Under-estimate calories rather than over. (LIVE: unknown foods contribute 0 to a meal total → conservative lower bound; bare "egg/eggs" maps to boiled (lower-cal) not fried.)
4. **Every scientific claim has a citation or is marked as estimate.** No bare assertions. ✅ **LIVE (Sprint 3):** RAG retrieval injects sourced chunks into the question path; the model cites by source name (e.g. "According to ICMR-NIN Dietary Guidelines (2024)..."); the `fabricated_source` anti-hallucination check guards against invented citations. The prompt instructs the model to say "I don't have a sourced answer" rather than use training knowledge for nutrition claims.
5. **Indian-first food knowledge.** Rotis, dals, sabzis, paneer, eggs, common Mumbai foods. User can teach any food via the teach-your-foods feature.
6. **Respect the cooking situation.** Maid-prepared vs. self-prepared meals have different effort/timing.
7. **No diet shaming, no compliance shaming.** Never use weight-loss app language. (LIVE: the anti-hallucination 'shaming' check flags cheat-day/guilt-free/treat-yourself/etc.)
8. **Single-tenant data, multi-tenant ready.** Every user-data table has `user_id` from day one; RLS enforced. (LIVE: profiles, weight_logs, conversations, messages, api_usage_log, meals, meal_items, response_flags = per-user RLS; foods, units, knowledge_chunks = shared-reference RLS — see §16.)
9. **Symmetric caloric engine.** Surplus and deficit are the same math with opposite sign. Pivot-ready.
10. **LLM-provider-agnostic.** All AI calls go through `/lib/ai/adapter`. **Default = Gemini 2.5 Flash (free).** High-stakes = Claude Sonnet 4.6. Failover = Claude Haiku 4.5.

## 5. MVP scope (v0.1) — ALL LIVE

### In MVP (all LIVE)
1. ✅ Onboarding form (conversational deferred to v0.2; form doubles as edit-profile/settings)
2. ✅ TDEE / calorie-target calculator — Mifflin-St Jeor + activity + ectomorph adj + surplus, with uncertainty band
3. ✅ Chat as primary surface — stateful, intra-day aware, streaming, personalized, honest
4. ✅ Real-time meal logging via natural language → parsed, confirmed, stored (NL → proposed meal card with honest band + confidence → Confirm/Dismiss)
5. ✅ Conservative food estimates — 60 system foods with min/typical/max kcal + user-taught foods
6. ✅ Intra-day running state — consumed today + remaining vs target (compute-on-the-fly via `getTodaySummary`, IST-windowed, confirmed meals only)
7. ✅ Real-time recommendations — "what should I do now" (qualitative, grounded in remaining range)
8. ✅ Meal suggestions from foods DB (Sprint 4.4) — chat suggests specific foods with real per-100g values from the database
9. ✅ Manual weight logging (Sprint 4.1) — dashboard widget with form + history
10. ✅ Weekly trend interpretation + 2-week TDEE recalibration (Sprint 4.2, 4.3)
11. ✅ Indian-first food database — 60 foods curated & sourced + alias coverage + chicken unit
12. ✅ RAG knowledge base — 11 chunks, 5 topics, 3 tiers, pgvector cosine retrieval
13. ✅ Source citations on every claim — model cites by source name; fabricated_source WATCH guard
14. ✅ Uncertainty disclosure on every estimate (dashboard + chat + meal pipeline all show ranges)
15. ✅ Teach-your-foods — teach unknown foods + edit known ones; alias dedup (≥0.82); user foods prioritized in matching; edits update current meal + recompute totals

### NOT in MVP
Photo logging, training/exercise programming, native apps (PWA covers it), wearables, push notifications, recipe generation, bilingual, multi-user/social, payments, weight-loss-mode UI

## 6. Long-term vision
- v0.2 — Photo logging, wearable sync, notifications, weight-loss mode, Hindi/Marathi, conversational onboarding upgrade, magic-link/Google OAuth, re-enable email confirmation, **migrate off free Gemini to paid privacy-safe providers (HARD blocker, §18/§23)**, **multi-model 2-proposer/1-judge consensus for high-stakes (§12a)**, per-user portion calibration (R5), **PWA (installable + offline)**, **anti-hallucination ENFORCE mode where the WATCH log shows real slips**, expand RAG corpus, **Next.js 14→16 + AI SDK 3→6 upgrade (addresses npm audit vulns)**
- v0.5 — Public beta, multi-user, subscription, doctor/RD read-only portal
- v1.0 — Multi-region (Indian diaspora first), verified-creator content layer
- v2.0+ — Biomarker integration, CGM reasoning, micronutrient targeting

## 7. Tech stack (all installed/working)

| Layer | Choice | Status |
|---|---|---|
| Framework | Next.js 14.2.35 (App Router) | ✅ |
| Language | TypeScript strict mode (no `any`) | ✅ tsc clean throughout |
| UI | Tailwind 3.4; react-markdown for chat bubbles | ✅ |
| Mobile | PWA via next-pwa | ⏳ v0.2 |
| Hosting | Vercel (env vars set in dashboard, auto-deploy on push) | ✅ deployed live |
| DB + Auth + Storage + Vector | Supabase (project: bulq-dev, Mumbai region) | ✅ 12 tables + RLS + auth live |
| Auth | Supabase email/password, email confirmation OFF for POC | ✅ working |
| Vector store | pgvector inside Supabase | ✅ LIVE — knowledge_chunks + HNSW index + match RPC |
| LLM default | Gemini 2.5 Flash (`gemini-2.5-flash`), free tier | ✅ verified working |
| LLM high-stakes | Claude Sonnet 4.6 (`claude-sonnet-4-6`) | ✅ (inert until a real high_stakes caller exists — chat = Gemini) |
| LLM failover | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) — CLAUDE_FAILOVER_MODEL | ✅ live |
| Embeddings | Gemini `gemini-embedding-001` (768d via outputDimensionality, manually L2-normalized) | ✅ LIVE |
| Vercel AI SDK | `ai` 3.4.33 + `@ai-sdk/google` 0.0.55 + `@ai-sdk/anthropic` 0.0.50 (+ `@ai-sdk/react` / ui-utils for useChat) | ✅ |
| Testing | Vitest — **130 tests passing** (17 files) | ✅ all passing |
| Source control | GitHub (adicchobe/bulq), gh CLI authed | ✅ |
| Dev tooling | Claude Code CLI 2.1.x via Enterprise Claude.ai sub | ✅ |

⚠️ **SDK version pinning:** `@ai-sdk/google` 0.0.55 is old. ALWAYS check installed types/exports before writing code that uses SDK methods. Never assume newer API surfaces exist. Key lessons: `text-embedding-004` is deprecated → use `gemini-embedding-001`; `providerOptions` doesn't exist on `ai@3.4.33`'s `embed()` → use model settings instead; `taskType`/`title` are inert on 0.0.55 embedding calls.

⚠️ **npm audit (16 vulns):** all require major-version upgrades (next@16, ai@6, eslint-config-next@16). Deferred to v0.2 as a dedicated upgrade sprint — not safe to --force.

## 8. Authentication & credentials — strict separation

| Credential | What it's for | Cost |
|---|---|---|
| **Enterprise Claude.ai subscription** (work account) | Authenticates Claude Code during dev | Already paid |
| **Anthropic API key** (PERSONAL account, ~$4.51 balance) | Running Bulq app → Claude failover/high-stakes calls | Burns $4.51 |
| **Gemini API key** (AI Studio, free tier) | Running Bulq app → default LLM + embeddings | Free within quota |
| **Supabase anon key** | App DB access (RLS-gated) | Free tier |
| **Supabase service role key** | Server-side seeding scripts only (e.g. ingest-knowledge.ts) — NEVER in app code | Free tier |

**Hard rules:**
- Claude Code authenticated via Enterprise subscription, never API key.
- API keys live ONLY in `.env.local` (gitignored, verified) and Vercel encrypted env vars.
- Bulq app prefers Gemini; uses Claude only on failover or high-stakes.
- **Service role key** is in `.env.local` for server-side scripts; NEVER used in application code (app uses anon key + RLS).

**Model decisions (May 2026):**
- **High-stakes = Claude Sonnet 4.6** ($3/$15 per M tokens). No running-app caller uses high_stakes yet (chat = Gemini); Sonnet money starts when trends add real high_stakes calls; budget guard caps it.
- **Failover = Claude Haiku 4.5** ($1/$5) — a SEPARATE constant from the high-stakes primary.
- **Pricing verified May 2026:** Haiku $1/$5, Sonnet $3/$15, Gemini $0. Stored in `src/lib/ai/pricing.ts`.
- **Budget guard thresholds:** amber 70%, red 90%, hard-stop-Claude 95% of $4.51. Guard ACTS only at hard-stop; amber/red are display-only.

**Privacy decision (POC vs productization):**
- **POC: free Gemini is acceptable** — builder's OWN data, single-user, wellness-not-clinical. Mitigation: minimize PII in prompts.
- ⚠️ **Productization: HARD blocker.** Free Gemini tier TRAINS on submissions, has human reviewers, bans clinical use. Before a 2nd user's data flows, MUST migrate to a privacy-safe provider with a data-protection agreement: paid Gemini via Vertex AI (BAA), Claude API (BAA), or OpenAI API (BAA + ZDR). See §23 R12. ⚠️ This now applies to embeddings too (free-tier embed calls have the same training/privacy terms).

**App auth model:** Supabase email/password, confirmation OFF for POC. RLS scoped to `authenticated`. ⚠️ Vercel production URL still to be added to Supabase redirect URLs for phone login (non-blocking).

## 9. System architecture (four layers)

1. **Client (PWA):** Chat (with meal cards + teach form) | Dashboard (targets + weight log + trend + recalibrate) | Onboarding/Login | Usage tracker
2. **Application & API (Next.js routes):** API endpoints | Meal pipeline (`/lib/meals`) | Orchestrator/chat-wiring (LIVE) | Day-state (`getTodaySummary`) | Weight logging + trends | Recalibration | Domain services
3. **AI reasoning:** LLM adapter (Gemini default, Claude high-stakes/failover; fully hardened) | Anti-hallucination post-processor (WATCH, 5 checks) | **RAG retrieval (LIVE)** | meal pipeline tools | Embeddings (`gemini-embedding-001`)
4. **Data & knowledge:** PostgreSQL (12 tables live) | **pgvector (LIVE)** — knowledge_chunks + HNSW index + match_knowledge_chunks RPC

### Request flow (one chat message — current, LIVE)
User → PWA → POST /api/chat → auth → **question fast-path** (`isObviousQuestion` — skips LLM classify for obvious questions, saves one Gemini call) → **intent gate** (`classifyMealIntent` → meal_log vs question; fail-safe → question) →
- **meal_log path:** `assembleMeal` (parse→match→portion→confidence) → `insertMeal('pending')` → `buildProposal` → render proposed meal card (items, conservative kcal band, confidence dots, teach/edit buttons) → user Confirms (`setMealStatus` pending→confirmed, returns boolean) or Dismisses. **Teach flow:** user edits an item → `teachFood` creates/updates user food (alias dedup) → re-derives meal item macros → recomputes meal totals.
- **question path:** load 15-msg history + profile + targets + **day-state** (`getTodaySummary`: consumed/remaining as ranges, today's confirmed meal list, real IST time via `istNowLabel`) → **RAG retrieval** (`searchKnowledge(message)` → top-5 cosine-similar chunks, fail-safe empty on error) → **available foods** (`getMatchableFoods` → slim list for meal suggestions) → `buildChatSystemPrompt(profile, targets, today, nowIst, chunks, foods)` → `llmStream` (retries + failover + budget guard + usage logging) → `toDataStreamResponse()` (graceful fallback on total failure) → **onFinish** persists assistant msg + logs usage + **runs `checkResponse` (anti-hallucination, 5 checks incl. `fabricated_source`) → logs to `response_flags` if violations (fail-safe, never affects the reply)**.

## 10. Files (key modules; all sprints complete)

```
src/
  app/
    page.tsx                    ✅ protected dashboard (target card + build stamp) + "Usage" link
    login/page.tsx              ✅ email/password sign-in + sign-up
    usage/page.tsx              ✅ usage tracker (Anthropic $ vs $4.51, Gemini calls, lifetime calls/failures/failovers)
    onboarding/                 ✅ server guard + pre-filled form + Zod server action
    weight-log.tsx              ✅ (Sprint 4.1) client component: weight form + history + trend display + recalibrate button
    actions/weight.ts           ✅ (Sprint 4) logWeight, getRecentWeights, recalibrateTargets server actions
    chat/
      page.tsx                  ✅ server guard
      chat-thread.tsx           ✅ useChat UI; react-markdown; renders meal-card from message annotations; **SVG mic icon (Sprint 5.1)** (Web Speech API, en-IN, continuous=false, interim preview) → appends transcript to input; feature-detected (hidden if unsupported); no auto-send; teach handler wired
  types/
    speech-recognition.d.ts     ✅ ambient typed SpeechRecognition/* (no `any`) for the voice feature
      meal-card.tsx             ✅ PROPOSED MEAL card (per-item name/qty/grams/kcal-band/confidence dot; total band + protein + confidence; honest note; Confirm/Dismiss → "✓ Logged"/"Dismissed"; **teach form: "Teach Bulq this food" on unknowns / "Edit" on known items** → inline form: name + protein (required) + calories (optional) + serving size (optional))
      actions.ts                ✅ confirmMeal/rejectMeal/teachFood server actions (teachFood: create/update user food + alias dedup + re-derive meal item + recompute totals)
    api/chat/route.ts           ✅ **question fast-path (Sprint 5.3)** → intent gate → meal_log path / question path; **RAG retrieval + available foods in question path (Sprint 3 + 4.4)**; onFinish persists + logs usage + runs anti-hallucination checkResponse (5 checks) → response_flags
  middleware.ts                 ✅ session refresh
  lib/
    db/
      profiles.ts               ✅ + recalibration_adjustment_kcal, recalibrated_at columns
      chat.ts / usage.ts        ✅
      foods.ts                  ✅ FoodRow + getMatchableFoods + **createUserFood, updateUserFood, addAliasToUserFood** (teach-your-foods); 'user' source_type
      units.ts                  ✅ UnitRow + getUnits (+ chicken_piece unit in DB)
      meals.ts                  ✅ MealInput/MealItemInput/MealRow/...; computeMealTotals; insertMeal (THROWS); getMealById; setMealStatus (returns boolean); getConfirmedMealsForDay; **updateMealItem, recomputeMealTotals** (teach-your-foods)
      weight-logs.ts            ✅ (Sprint 4.1) WeightLogRow, insertWeightLog, getWeightLogs, getLatestWeight
      response-flags.ts         ✅ logResponseFlags (FAIL-SAFE) — writes anti-hallucination violations
    ai/
      adapter.ts                ✅ llmCall/llmStream — hardened (retries, failover, budget guard, usage logging, graceful degradation)
      embed.ts                  ✅ (Sprint 3) embed(text, taskType, title?) → normalized 768d vector via gemini-embedding-001; normalizeVector (pure); toPgVector
      embed.test.ts             ✅ (Sprint 3) 5 tests (normalizeVector + toPgVector)
      types.ts / pricing.ts / errors.ts / data-stream.ts  ✅
      system-prompt.ts          ✅ buildChatSystemPrompt(profile, targets, today, nowIst, chunks?, availableFoods?) — injects real IST time + today's meal list + **sourced references with citation instructions (Sprint 3)** + **available foods for meal suggestions (Sprint 4.4)**; STRICT anti-fabrication rules
      anti-hallucination.ts     ✅ checkResponse(text, facts) PURE → { violations } — **5 checks**: ungrounded_number / invented_time / false_logged / shaming / **fabricated_source (Sprint 3, WATCH)**
      index.ts                  ✅ barrel
    meals/                      ✅ MEAL PIPELINE — LIVE END-TO-END
      types.ts                  ✅ ParsedItem/ParsedMeal/ParseResult + Zod
      parse.ts                  ✅ parseMealText (Gemini, numbers-FREE, Zod) + pure extractParsedMeal
      match.ts                  ✅ matchFood (exact→alias→fuzzy≥0.82→unknown; **user foods prioritized**; prefers unknown over shaky); **similarity() exported** for alias dedup
      portion.ts                ✅ pickUnitKey/resolveGrams (per-unit grams, qty-once; **chicken→chicken_piece wired**) + computeItemMacros (compounded band) + buildMealItem
      assemble.ts               ✅ computeItemConfidence/worstConfidence + assembleMeal → proposed MealInput (no persist)
      intent.ts                 ✅ classifyMealIntent (Gemini, operation:'intent_detect', **maxTokens:1024 — fixed from 8**) + pure extractIntent (fail-safe → 'question') + **broadened few-shots (Indian + non-Indian + bare lists)** + **isObviousQuestion (Sprint 5.3, exported)**
      proposal.ts               ✅ MealProposal + buildProposal (items + total kcal band + total protein + confidence)
      summary.ts                ✅ istDayRangeUtc + istNowLabel + TodaySummary (consumed/target/remaining/meals[]/mealCount) + computeTodaySummary + getTodaySummary
      index.ts                  ✅ barrel
    nutrition/                  ✅ TDEE engine
      tdee.ts                   ✅ + **recalibration_adjustment_kcal wired into computeNutritionTargets** (Sprint 4.3)
      trends.ts                 ✅ (Sprint 4.2) rollingAverage, weeklyRateOfChange, interpretTrend (pure)
      trends.test.ts            ✅ 13 tests
      recalibrate.ts            ✅ (Sprint 4.3) recalibrateTdee (pure, ±200/±600/14d cooldown)
      recalibrate.test.ts       ✅ 10 tests
    rag/                        ✅ (Sprint 3) RAG retrieval
      search.ts                 ✅ searchKnowledge(queryText, topK=5) → ChunkResult[]; cosine similarity via match_knowledge_chunks RPC
  types/speech-recognition.d.ts ✅
supabase/migrations/
    0001 … 0006                 ✅ profiles/weight_logs, conversations/messages, foods/units (+ seed 60 foods/17 units incl. chicken_piece), api_usage_log, meals/meal_items
    0007_alias_fixes.sql        ✅ **folded into 0004 (Sprint 5.4)** — file kept as no-op comment for migration history
    0008_response_flags.sql     ✅ response_flags table
    0009_knowledge_chunks.sql   ✅ (Sprint 3) knowledge_chunks table + pgvector extension + HNSW index + shared-reference RLS
    0010_match_knowledge_chunks.sql ✅ (Sprint 3) cosine-similarity RPC function + grant to authenticated
    0011_foods_source_type_user.sql ✅ (Sprint 4) 'user' source_type for teach-your-foods
    0012_recalibration.sql      ✅ (Sprint 4.3) recalibration_adjustment_kcal + recalibrated_at on profiles
scripts/
    smoke-test-llm.ts           ✅
    ingest-knowledge.ts         ✅ (Sprint 3) seeds 11 knowledge chunks (idempotent, service-role, ~1.5s paced). Run with: npx tsx --env-file=.env.local scripts/ingest-knowledge.ts
next.config.mjs                 ✅ (Sprint 5.2) generateBuildId (git SHA), NEXT_PUBLIC_BUILD_ID, no-store headers on HTML/RSC
.env.local                      ✅ 5 keys (GEMINI_API_KEY, ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY), gitignored
project_brief.md                ✅ THIS FILE (v10)
```

## 11. Coding principles for Claude Code
- TypeScript strict; **no `any`**. Server components by default. Zod on inputs. Every DB query a typed function in `/lib/db/` (server-only modules imported directly, not via barrel). Every LLM call through `/lib/ai/adapter`. Tailwind only.
- Tests (Vitest) on PURE logic; DB/LLM exercised live. **Code-correct ≠ behavior-correct for LLM prompts — always verify LIVE before committing** (proven repeatedly: a fabrication bug passed tsc + tests but only showed in live chat).
- RLS on every table from day one (per-user for user data; shared-reference for foods/units/knowledge_chunks). Coerce Supabase numerics with Number().
- **Migration workflow:** Claude Code writes SQL → Claude.ai REVIEWS (esp. RLS) → user pastes into Supabase SQL Editor + Run → verify (⚠️ Table Editor CACHES — refresh or `select count(*)`) → commit the migration file AFTER it's run.
- **Build rhythm:** changes to working code → investigate→propose→show diff→review→apply. New additive modules → build→show→review. One inspectable change at a time. Prove behavior live where possible.
- ⚠️ **Dev server must run in the BACKGROUND** (non-blocking) — foreground `npm run dev` makes Claude Code HANG forever (token usage goes flat; press Esc to interrupt, edits persist).
- ⚠️ **Browser cache:** after a deploy/code change the browser may serve STALE JS until a hard refresh (Cmd+Shift+R) or incognito. Sprint 5.2 added no-store headers on HTML/RSC to mitigate this. The build stamp (`v.<sha>` on the dashboard) lets you confirm which build is live.
- ⚠️ **SDK version pinning:** `@ai-sdk/google` 0.0.55 is old. ALWAYS check installed types/exports before writing code that uses SDK methods. Never assume newer API surfaces exist.

## 12. AI architecture key points
- **Three LLM jobs** prompted separately: parsing (NL→structured), reasoning (state→decision), composition (draft).
- **Tool-using orchestrator (LIVE):** meal pipeline (`/lib/meals`) is the parse/match/compute engine; the chat route wires it (intent detect → assembleMeal → proposal card → confirm → persist).
- **RAG retrieval (LIVE, Sprint 3):** question path embeds the user's message → cosine top-5 from knowledge_chunks → injects sourced chunks into the system prompt → model cites by source name → `fabricated_source` check guards validity.
- **Meal suggestions (LIVE, Sprint 4.4):** available foods (system + user-taught) injected into system prompt so model suggests specific foods with real per-100g values.
- **Adapter pattern** via Vercel AI SDK — FULLY HARDENED: retries (maxRetries 2), error classification, provider failover (transient initial-connect only, userId-gated, decoupled Haiku failover), graceful degradation (calm fallback reply, not persisted), budget guard (gates both Claude points at hard-stop), usage logging (fail-safe, awaited), cost computation (Gemini $0; unpriced → rateKnown:false).
- **Question fast-path (Sprint 5.3):** `isObviousQuestion` skips the intent_detect LLM call for messages starting with question words or ending with "?" — saves one Gemini round-trip on most question turns.
- ⚠️ KNOWN GAP (R13): mid-stream failures (drop after first chunk) not caught/logged — deferred.
- ⚠️ **Gemini thinking-token issue (R11):** DEFAULT_MAX_TOKENS=2048 floor fixes truncation; intent classifier now at 1024 (was 8 — the crash that broke all meal logging, fixed during Sprint 3). api_usage_log undercounts Gemini TOKEN volume but Gemini=$0 so the $ figure is accurate.
- ⚠️ **Meal-turn latency 7–10s** (#32): 2 sequential Gemini calls (intent_detect → meal_parse) + Gemini thinking overhead. Sprint 5.3 fast-path helps question turns; meal turns still pay both calls. Long-term fix: merge classify+parse into one LLM call (deferred).

## 12a. Multi-model consensus (DEFERRED to productization — research done)
- NARROW 2-proposer + 1-judge ensemble for HIGH-STAKES steps only. Key findings: DB-grounding > ensembling; correlated errors mean consensus ≠ verification; judge must compare NUMBERS + be allowed to ABSTAIN.
- **Privacy-DISQUALIFYING for health data:** DeepSeek hosted, Alibaba-hosted Qwen, free Gemini AI Studio. Privacy-safe set = paid Gemini via Vertex (BAA), Claude (BAA), OpenAI (BAA+ZDR). **DECISION:** defer to productization (needs PAID providers; tied to the §18 migration).

## 13. RAG architecture (Sprint 3 — COMPLETE & LIVE)
- **Corpus:** 11 chunks across 5 topics: protein (ICMR-NIN RDA + muscle-gain evidence), caloric surplus sizing, B12/vitamin D for Indian vegetarians, whey concentrate vs isolate/lactose. Deliberately small and hand-verified — quality over volume.
- **Source labelling:** "Summarized from: [Source]" — chunks are Bulq's own-words summaries with real attribution (copyright-clean).
- **Tiers:** Tier 1 ICMR-NIN (2 chunks); Tier 2 Examine/PMC studies (7 chunks); Tier 3 neutral health media (2 chunks, whey only).
- **Embeddings:** `gemini-embedding-001`, 768d via `outputDimensionality`, manually L2-normalized (the model does NOT auto-normalize sub-3072 dims). Free tier, $0.
- **Retrieval:** `searchKnowledge(queryText, topK=5)` → embed query as RETRIEVAL_QUERY → cosine similarity via `match_knowledge_chunks` pgvector RPC → top-5 chunks with id, content, source_title, source_ref, source_tier, similarity score.
- **Citation model:** the model cites by source name directly in its response (e.g. "According to ICMR-NIN Dietary Guidelines (2024)...") rather than emitting [CITE:id] placeholders. Simpler, human-readable, and the `fabricated_source` check can verify cited names against retrieved chunks. Source URLs are available in the prompt for the model to share.
- **Fail-safe:** retrieval errors → empty chunks → prompt falls back to pre-RAG behavior (no citations, no crash).
- **Two honesty rules baked into the corpus:** (1) protein answers always carry BOTH the Indian RDA baseline (0.83 g/kg) AND the muscle-gain evidence (1.6–2.2 g/kg) — no selective citation. (2) B12/D answers inform + recommend testing, never prescribe a dose.
- ⚠️ **SDK limitation (known):** `@ai-sdk/google` 0.0.55 does not support `taskType` or `title` on embedding calls. Both params are accepted by `embed()` for forward-compat but inert until an SDK upgrade. For 11 chunks, cosine retrieval works well without asymmetric task types.
- ⚠️ **Corpus growth:** current 11 chunks cover the user's core questions. To expand: add chunks to the `CHUNKS` array in `scripts/ingest-knowledge.ts` and re-run (idempotent — deletes system rows first).
- **Ingestion:** `scripts/ingest-knowledge.ts` — run with `npx tsx --env-file=.env.local scripts/ingest-knowledge.ts`. Uses service-role key (bypasses RLS for seeding), 1.5s pacing, idempotent.

## 14. Meal-understanding pipeline (COMPLETE & LIVE)
1. ✅ Parse — `parseMealText` (Gemini, numbers-FREE prompt + Indian few-shots, Zod-validated; never throws).
2. ✅ Match — `matchFood` (exact → alias → fuzzy Levenshtein ≥0.82 → unknown; **user foods prioritized over system foods**; prefers unknown over shaky). Alias coverage hardened (0007, folded into 0004): bare egg/eggs/anda/ande→boiled egg, rice→cooked rice, chana→boiled kala chana, chapati explicit.
3. ✅ Portion — `resolveGrams`+`pickUnitKey` (per-unit grams, fallback {null,100g,50–200}; **chicken→chicken_piece**). Design A: quantity applied EXACTLY ONCE.
4. ✅ Macros — `computeItemMacros`: kcal band = food per-100g kcal band × portion gram band × qty/100 (compounded). variance_class is confidence-only, never a kcal multiplier.
5. ✅ Confidence — `computeItemConfidence` (min of match+variance+portion) + `worstConfidence` (meal = weakest item).
6. ✅ **Wired into chat (LIVE):** intent gate → `assembleMeal` → `insertMeal('pending')` → proposed meal card (items, conservative band, confidence dots, teach/edit buttons) → Confirm (`setMealStatus` pending→confirmed, returns boolean → "✓ Logged" only on a real write) or Dismiss.
7. ✅ **Teach-your-foods (LIVE):** "Teach Bulq this food" button on unknowns, "Edit" on all items. User provides: food name, protein per serving (required), calories (optional — estimated as range if blank), serving size (optional, default 100g). Server action creates/updates user food with alias dedup (fuzzy ≥0.82 against existing user foods). Edits also re-derive the meal item's macros + recompute meal totals (totals-equals-sum-of-items invariant preserved). User foods prioritized in matching at every resolution step.

## 15. TDEE engine + recalibration (Sprint 1 + 4.3)
- BMR: Mifflin-St Jeor. Activity multipliers sedentary 1.2 … very_active 1.9 (moderate_plus 1.6). Ectomorph +5–10% (default 7) for gain only. Surplus default 300 (250–400) gain; 400 (300–500) deficit. deltaKcal & proteinPerKg DERIVED from goal_direction.
- **Recalibration (Sprint 4.3):** actual weight-change rate < 50% of expected → +200 kcal/day; > 150% → −200 kcal/day; within range → no change. **Guards:** ±600 kcal cap (once at ±600, further adjustments refused); 14-day cooldown between adjustments (keyed on `recalibrated_at`, only stamped on real adjustments — "on track / no change" doesn't burn the cooldown). Stored in `profiles.recalibration_adjustment_kcal`, applied in `computeNutritionTargets` → every consumer (dashboard, chat system prompt, chat allowed-numbers) inherits automatically.
- 2-week trend: `weeklyRateOfChange` computes actual rate from earliest + latest weight-log points in a 14-day window; requires 2+ data points 7+ days apart. `interpretTrend` maps rate + goal direction to on_track / too_slow / too_fast / wrong_direction with a user-facing message.

## 16. Data model (12 tables LIVE)

**LIVE (12):**
- profiles (+ recalibration_adjustment_kcal, recalibrated_at), weight_logs — per-user RLS
- conversations, messages (messages.user_id denormalized) — per-user RLS
- foods (+ 'user' source_type), units (+ chicken_piece) — SHARED-REFERENCE RLS (user_id NULL = system row readable by all authenticated; non-null = user's custom; split SELECT vs INSERT/UPDATE/DELETE policies)
- api_usage_log — per-user RLS
- meals, meal_items (meal_items.user_id denormalized; food_id ON DELETE SET NULL; meals.status DEFAULT 'pending') — per-user RLS
- **response_flags** (Sprint 2.7) — per-user RLS. Columns: id, user_id, conversation_id (nullable, ON DELETE SET NULL), created_at, path, response_excerpt, violations jsonb, allowed_facts jsonb.
- **knowledge_chunks** (Sprint 3) — SHARED-REFERENCE RLS. Columns: id uuid, user_id (NULL=system), content text, embedding vector(768), source_title, source_ref, source_tier smallint (1/2/3), evidence_grade, topic, token_count, created_at. HNSW index on embedding (vector_cosine_ops).

**RPC functions:**
- **match_knowledge_chunks(query_embedding, match_count)** (Sprint 3) — cosine similarity search, SECURITY INVOKER (RLS applies), granted to authenticated.

**NOT created (by decision):** `daily_summaries` — intra-day state uses **compute-on-the-fly** (`getTodaySummary`) instead; a materialized table is a scale optimization deferred.

**Migrations:** 0001–0012 (0007 folded into 0004, kept as no-op). All RUN in Supabase.

### Foods DB provenance (sourced, not invented)
- 60 system foods. Sources: IFCT 2017 (ICMR-NIN) raw ingredients; USDA FoodData Central cooked items + gaps; INDB (Vijayakumar et al. 2024, DOI 10.1016/j.cdnut.2024.103790) composites; ICMR "My Plate" portions.
- Key corrected assumptions: cooked chicken breast 31g protein/100g; boiled kala chana ~9g protein/100g (15–18g is DRY).
- User-taught foods: `source_type = 'user'`, user-provided macros, alias dedup.
- ⚠️ PRE-PRODUCTIZATION: verify a few IFCT values vs the official IFCT 2017 PDF (#18).

### Knowledge chunks provenance (Sprint 3 — sourced, own-words summaries)
- 11 chunks. Sources: ICMR-NIN Nutrient Requirements (2020), ICMR-NIN Dietary Guidelines (2024), Examine.com Protein Intake guide (citing Morton et al. 2018 meta-analysis), Iraki et al. 2019 (Sports), Hannibal et al. 2024 (SAGE), PMC milk/B12 intervention trial, PMC vitamin D overview, WebMD + Academy of Nutrition and Dietetics (whey).
- All chunks are Bulq's own-words summaries, labelled "Summarized from: [Source]" — copyright-clean.

## 17. Trust & verification framework
7 layers: (1) input verification, (2) source grounding (foods DB w/ provenance + user-taught foods), (3) uncertainty surfacing (ranges + worst-item confidence), (4) refusal-when-unsure (matcher prefers unknown; LLM never emits numbers), (5) audit trail (api_usage_log), (6) **anti-hallucination post-processor (WATCH) — `checkResponse` flags ungrounded numbers / invented time / false "logged" claims / shaming / fabricated sources to `response_flags`**, (7) **RAG-grounded citations (Sprint 3) — model answers nutrition questions from retrieved sourced chunks, not training knowledge; instructed to say "I don't have a sourced answer" when chunks don't cover the question.**
- **WATCH vs ENFORCE:** currently WATCH (logs, no blocking — keeps streaming, zero UX cost). Escalate a check to ENFORCE (buffer + replace before the user sees it) IF the log shows real, recurring slips.
- Confidence-card UX primitive (green/amber/gray dot) LIVE on meal cards.

## 18. Privacy & security
- PII + health data in Supabase, encrypted at rest, behind auth ✅. RLS on every table ✅ (12 tables). Data export/deletion first-class (on delete cascade). No biometric data beyond weight. Wellness/lifestyle positioning. API keys in .env.local + Vercel encrypted env only.
- ⚠️ **Free Gemini trains on submissions** (POC-acceptable for builder's own data; HARD productization blocker — migrate to BAA provider before a 2nd user; §8, §23 R12). Now applies to embeddings too.

## 19. Development environment
| Item | Value |
|---|---|
| OS | macOS · Homebrew · Node v20+ |
| Git | gh CLI authed (adicchobe), HTTPS |
| Editor | VS Code |
| AI dev tool | Claude Code CLI 2.1.x via Enterprise sub |
| Repo | ~/projects/bulq |
| Dev server | `npm run dev` — ⚠️ start in BACKGROUND or Claude Code hangs. Editing .env.local auto-restarts it. Supabase timestamps UTC; Mumbai = UTC+5:30 (IST day boundary = 18:30 UTC). |

## 20. Project status — v0.1 MVP COMPLETE
- ✅ Phase 1 — Problem refinement · ✅ Phase 2 — Architecture · ✅ Phase 3 — Execution
  - ✅ Sprint 0 — Foundations
  - ✅ Sprint 1 — Profile + TDEE + Auth + Onboarding
  - ✅ **Sprint 2 — Chat + Meal Logging**
  - ✅ **Sprint 3 — Knowledge + Citations (RAG)**
  - ✅ **Sprint 4 — Trends + Plans + Teach-your-foods**
  - ✅ **Sprint 5 — Polish + Daily Use**
- 🚧 **Phase 4 — Daily Use + Live Testing** (current)
- ⏳ Phase 5 — Productization (v0.2)

## 21. Sprint structure (COMPLETE)
| Sprint | Status | Deliverable |
|---|---|---|
| 0 — Foundations | ✅ DONE | Deployed app, DB, adapter verified |
| 1 — Profile + TDEE | ✅ DONE | Auth + tables + onboarding + TDEE |
| 2 — Chat + Meal Logging | ✅ DONE | Chat + foods DB + hardened adapter + meal pipeline LIVE + day-aware honest chat + real IST time + alias coverage + anti-hallucination WATCH + voice input |
| 3 — Knowledge + Citations | ✅ DONE | pgvector + embeddings + 11-chunk sourced corpus + cosine retrieval + RAG in chat + source citations + fabricated_source guard + intent fix |
| 4 — Trends + Plans | ✅ DONE | Teach-your-foods + weight logging + trends + recalibration + meal suggestions |
| 5 — Polish + Daily Use | ✅ DONE | SVG mic icon + no-store headers + build stamp + question fast-path + npm audit assessment + 0007 fold + chicken unit |

## 22. Open backlog (post-MVP / v0.2)
| # | Item | Status |
|---|---|---|
| 2 | Whey timing/type experiment | Flagged for feedback loop |
| 8 | npm audit — Next 14→16 + AI SDK 3→6 + eslint-config-next@16 | v0.2 (dedicated upgrade sprint) |
| 9 | Vercel AI SDK v3 → v4 (unblocks taskType/title for embeddings, thinking-token control) | Tied to #8 |
| 10 | Conversational chat onboarding | v0.2 (form stays as settings) |
| 11 | Re-enable email confirmation + magic-link/Google OAuth | v0.2 |
| 13 | Add Vercel prod URL to Supabase redirect URLs (phone login) | Pending, non-blocking |
| 17 | Mid-stream streaming failure logging (R13) | Deferred |
| 18 | Verify IFCT food values vs official PDF | Pre-productization |
| 19 | Migrate off free Gemini to BAA provider (incl. embeddings) | **Pre-productization HARD blocker** |
| 20 | Multi-model 2-proposer/1-judge consensus | Productization (§12a) |
| 21 | Verify current Gemini free-tier RPD | When refining tracker |
| 27 | Per-user portion calibration — "your katori is 130g" → narrows bands | v0.2 |
| 30 | Anti-hallucination ENFORCE mode | Tune via response_flags |
| 31 | allowedNutritionNumbers tuning | Tune via response_flags |
| 32 | Meal-turn latency (merge classify+parse into 1 LLM call) | v0.2 optimization |
| 37 | Expand RAG corpus | Ongoing, driven by real usage |
| 38 | SDK upgrade unblocks embedding taskType/title | Tied to #9 |
| 39 | Stale meal-card totals after teach (cosmetic) | Deferred |
| 40 | Item-id plumbing for teach (same-named items edge case) | Deferred |

## 23. Risks register
| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Food DB estimates off >20% → user under-eats surplus | Medium | High | 3-value band + 2-week TDEE recalibration + teach-your-foods |
| R2 | LLM hallucinates a number/time/log-claim/source despite tools | Low | High | LLM never emits meal numbers; numbers only from DB/day-state; strict prompt rules; **anti-hallucination post-processor (WATCH, 5 checks incl. fabricated_source)** |
| R3 | $4.51 Anthropic drained | Medium | Medium | Gemini default; cost tracking + budget guard; cheap Haiku failover |
| R4 | User stops logging after week 2 | High | High | Chat-first logging; intra-day "here's your day" reward; teach-your-foods reduces friction; never shame |
| R5 | Katori size mismatch | High | Medium | Per-user calibration v0.2; band absorbs in MVP |
| R6 | Supabase free tier runs out post-launch | Low for MVP | High at scale | Clear migration path |
| R8 | Gemini Flash quality worse on Indian queries | Medium | Medium | High-stakes routing to Claude; measure on real queries |
| R9 | RAG corpus stale/contradictory | Medium | Medium | Small hand-verified corpus; re-ingest idempotent; expand from real usage |
| R10 | Undiagnosed health condition → wrong recommendations | Low | Very High | Red-flag screen; wellness disclaimer; full checkup reviewed (§3a) |
| R11 | Gemini thinking tokens silently truncate responses | Medium (mitigated) | High | maxTokens floor (2048 chat, 1024 intent); $ tracking unaffected |
| R12 | Free Gemini trains on health data (incl. embeddings) | N/A POC; CERTAIN at productization | High | POC: own data + minimize PII. Productization: HARD blocker — migrate to BAA provider before 2nd user |
| R13 | Mid-stream LLM failures not caught | Low | Low-Med | Deferred; graceful degradation covers initial/both-fail |
| R14 | Wrong fuzzy food match → wrong calories | Low-Med | High | Conservative threshold 0.82; prefers 'unknown'; confirm card + teach-your-foods lets user correct |
| R16 | Stale browser cache → users see old build after deploy | Low (mitigated) | Medium | Sprint 5.2 no-store headers + build stamp; hard-refresh/incognito as backup |
| R17 | RAG retrieval returns irrelevant chunks → bad citation | Low | Medium | Small, focused corpus; top-5 cosine; fabricated_source WATCH check; model instructed to say "no sourced answer" when chunks don't fit |

## 24. How the user works with Claude (PM mode)
- User (Aditya) is a **non-coder**, guided step-by-step. Define unfamiliar terms briefly and simply.
- **CONCISE answers — do not overcomplicate.** Focus on a bug-free best solution aligned with the goal; don't forget backlog.
- Claude acts as **program manager** + architect + engineer + thinking partner.
- **USER PROCESS REQUEST:** surface decisions needing his input (anything affecting goal, cost, data integrity, hard-to-undo) with stakes spelled out (🎯); decide low-stakes/reversible/technical things and just mention them. Markers: ⚠️ RISK, 🎯 DECISION NEEDED, 🧠 ASSUMPTION/plain-English.
- Claude summarizes at session ends (changed/next/blocking). Flags real-money actions BEFORE proceeding. Reviews ALL Claude-Code SQL/code before it touches DB/prod, esp. RLS.
- **Verify behavior LIVE before committing** (prompt changes especially). Build rhythm: one inspectable change at a time.
- Claude Code prompts: pick "Yes" (option 1), never "don't ask again"; stop on git commits/pushes, .env changes, anything outside ~/projects/bulq, or real spend.
- **Brief update workflow:** Claude produces the brief file → user downloads → drag-replaces in repo + VS Code → Claude Code commits + pushes → user re-uploads to the Claude.ai Project knowledge (delete old, upload new).

## 25. Where we are RIGHT NOW (for a fresh session)
- **v0.1 MVP is COMPLETE. All 6 sprints done (0–5). Everything deployed to prod.**
- **130 tests passing. tsc clean. All commits pushed. Vercel deployed.** Migrations 0001–0012 all RUN in Supabase.
- **What's live:** onboarding → TDEE targets → chat (streaming, day-aware, honest numbers, real IST time) → meal logging (NL → meal card → confirm → intra-day state) → teach-your-foods (teach unknowns, edit knowns, alias dedup, user-food priority) → RAG citations (11 chunks, 5 topics, source citations, fabricated_source guard) → weight logging → trend analysis → TDEE recalibration (±200/14d/±600) → meal suggestions (specific foods with real DB numbers) → question fast-path (skip classify on obvious questions) → SVG mic icon → no-store cache headers + build stamp → chicken serving unit.
- **Now in daily-use / live-testing mode.** Use the app, find bugs, build the backlog for v0.2.
- **v0.2 (productization):** migrate off free Gemini (HARD blocker), OAuth, PWA, Next/AI SDK upgrade, multi-user, anti-hallucination ENFORCE, expand RAG corpus, per-user portion calibration.
