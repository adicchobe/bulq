# Bulq — Project Brief

> Living document. Canonical context for Claude Code, future Claude.ai sessions, and any AI assistant working on this project. Updated at the end of each major decision point.
>
> **Last updated:** Mid Phase 3 — Sprint 2.4b COMPLETE + Sprint 2.5 meal-pipeline ENGINE COMPLETE, un-wired (v7). LLM hardening fully done (logging, retries, error classification, failover, graceful degradation, budget guard, usage tracker page). High-stakes model SWAPPED to Claude Sonnet 4.6 (verified live). Meal-understanding pipeline built + unit-tested end-to-end: NL text → parse → match → portion → conservative calorie band → worst-item confidence → proposed MealInput. NOT yet wired into chat (next = step 6: intent detection + confirm UX + persist). 66 tests passing.

---

## 1. Identity

- **Name:** Bulq (working name, changeable)
- **Type:** AI-assisted nutritional reasoning partner for naturally skinny individuals
- **Primary user (POC):** Self-build by user (Aditya), age 26, Mumbai, India
- **GitHub:** github.com/adicchobe/bulq (private)
- **Live URL:** bulq-10bm5cu13-adityas-projects-939dfc25.vercel.app (auto-generated; rename later). Production URL on Vercel dashboard is the stable one to use.
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

### Computed defaults (stored in DB profile; recalibrate from real weight trend)
- **BMR (Mifflin-St Jeor):** 1540 kcal/day
- **TDEE (1.6× via 'moderate_plus' multiplier):** ~2464 kcal/day
- **Ectomorph-adjusted maintenance (+7%):** ~2636 kcal/day
- **Daily target (+300 kcal lean-gain surplus):** ~2936 kcal/day (range ~2736–3136, ±200 band)
- **Protein target (1.8 g/kg):** ~97 g/day
- **Realistic timeline 54 → 62 kg:** ~9–14 months at sustainable rates

## 4. Behavioral pillars (non-negotiable)

1. **Never invent nutritional numbers.** Use database lookups or cite sources. If unknown, say "I don't know precisely" and show a range. (LIVE: 60 foods carry source_type + source_ref; meal pipeline NEVER lets the LLM emit calories — numbers come only from the foods DB.)
2. **Always surface uncertainty.** Show ranges, never false precision. *"~280–340 kcal"*, never *"312 kcal"* for an estimate. (LIVE: per-100g kcal band + portion band compounded into every meal item; worst-item confidence on every meal.)
3. **Conservative estimates by default for planning.** Under-estimate calories rather than over, so user doesn't fall short of surplus target. (LIVE: unknown foods contribute 0 to a meal total → conservative lower bound; the band's low end is what a gainer plans against.)
4. **Every scientific claim has a citation or is marked as estimate.** No bare assertions.
5. **Indian-first food knowledge.** Rotis, dals, sabzis, paneer, eggs, common Mumbai foods. Western foods deferred.
6. **Respect the cooking situation.** Maid-prepared vs. self-prepared meals have different effort/timing.
7. **No diet shaming, no compliance shaming.** Never use weight-loss app language ("guilt-free", "cheat day", "treat yourself").
8. **Single-tenant data, multi-tenant ready.** Every user-data table has `user_id` from day one; RLS enforced. (LIVE: profiles, weight_logs, conversations, messages, api_usage_log, meals, meal_items = standard per-user RLS; foods, units = shared-reference RLS — see §16.)
9. **Symmetric caloric engine.** Surplus and deficit are the same math with opposite sign. Pivot-ready.
10. **LLM-provider-agnostic.** All AI calls go through `/lib/ai/adapter`. **Default = Gemini 2.5 Flash (free).** High-stakes = Claude Sonnet 4.6 (SWAP DONE). Failover = Claude Haiku 4.5 (cheap, decoupled from the high-stakes primary).

## 5. MVP scope (v0.1)

### In MVP
1. Onboarding chat — (Sprint 1 shipped a pre-filled FORM; conversational chat onboarding deferred to v0.2. Form doubles as edit-profile/settings.) ✅ FORM BUILT
2. TDEE / calorie-target calculator — Mifflin-St Jeor + activity + ectomorph adj + surplus, with uncertainty band ✅ BUILT
3. Chat as primary surface — stateful, intra-day aware ✅ BASIC CHAT LIVE (streaming, personalized, honest; intra-day awareness comes with meal pipeline 2.5/2.6)
4. Real-time meal logging via natural language → parsed, confirmed, stored — 🚧 ENGINE BUILT & TESTED (Sprint 2.5 steps 1–5: NL → proposed MealInput with honest band + confidence; store fns ready). NOT yet wired into chat (step 6 = intent detection + confirm UX + persist).
5. Conservative food estimates — each food has min/typical/max kcal ✅ DATA LIVE (60 foods) + applied in the meal pipeline (compounded with portion band)
6. Intra-day running state — consumed today + remaining vs target ⏳ Sprint 2.6
7. Real-time recommendations — "what should I do now" ⏳ Sprint 2.6
8. Weekly meal plan generator ⏳ Sprint 4
9. Manual weight logging ⏳ Sprint 4
10. Weekly trend interpretation + 2-week TDEE recalibration ⏳ Sprint 4
11. Indian-first food database — ✅ 60 foods curated & sourced (covers the user's actual diet for POC; expand via INDB later)
12. RAG knowledge base — ICMR-NIN + curated PubMed/Examine ⏳ Sprint 3
13. Source citations on every claim ⏳ Sprint 3 (foods already carry provenance in DB)
14. Uncertainty disclosure on every estimate ✅ (dashboard + chat + meal pipeline all show ranges)

### NOT in MVP
Photo logging, training/exercise programming, native apps (PWA covers it), wearables, push notifications, recipe generation, bilingual, multi-user/social, payments, weight-loss-mode UI

## 6. Long-term vision
- v0.2 — Photo logging, wearable sync, notifications, weight-loss mode, Hindi/Marathi, conversational onboarding upgrade, magic-link/Google OAuth, re-enable email confirmation, **migrate off free Gemini to paid privacy-safe providers (HARD blocker, see §18/§23)**, **multi-model 2-proposer/1-judge consensus for high-stakes (see §12a)**, per-user portion calibration (R5)
- v0.5 — Public beta, multi-user, subscription, doctor/RD read-only portal
- v1.0 — Multi-region (Indian diaspora first), verified-creator content layer
- v2.0+ — Biomarker integration, CGM reasoning, micronutrient targeting

## 7. Tech stack (all installed/working)

| Layer | Choice | Status / Free-tier |
|---|---|---|
| Framework | Next.js 14.2.35 (App Router) | ✅ |
| Language | TypeScript strict mode | ✅ tsc clean throughout (no `any`) |
| UI | Tailwind 3.4 (shadcn not yet added); react-markdown for chat bubbles | ✅ |
| Mobile | PWA via next-pwa | ⏳ Sprint 5 |
| Hosting | Vercel (env vars set in dashboard) | ✅ deployed live, auto-deploy on push |
| DB + Auth + Storage + Vector | Supabase (project: bulq-dev, Mumbai region) | ✅ 9 tables + RLS + auth live |
| Auth | Supabase email/password, email confirmation OFF for POC | ✅ working |
| Vector store | pgvector inside Supabase | ⏳ Sprint 3 |
| LLM default | Gemini 2.5 Flash (`gemini-2.5-flash`), free tier | ✅ verified working |
| LLM high-stakes | Claude Sonnet 4.6 (`claude-sonnet-4-6`) — SWAP DONE (verified live, smoke TEST 2). Reasoning tier. Inert in the running app today (chat = Gemini); Sonnet billing starts when 2.5 wiring / trends make real high_stakes calls. | ✅ |
| LLM failover | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) — CLAUDE_FAILOVER_MODEL, decoupled from high-stakes primary so the Sonnet swap didn't make failover expensive | ✅ live |
| Embeddings | Gemini text-embedding-004 (768 dim) | ⏳ Sprint 3 |
| Vercel AI SDK | `ai` 3.4.33 + `@ai-sdk/google` 0.0.55 + `@ai-sdk/anthropic` 0.0.50 | ✅ |
| Testing | Vitest — **66 tests, 10 files** (tdee 16, pricing 6, errors 5, adapter failover+budget 6, data-stream 1, meal-totals 3, parse 6, match 5, portion 10, assemble 8) | ✅ all passing |
| Source control | GitHub (adicchobe/bulq), gh CLI authed | ✅ |
| Dev tooling | Claude Code CLI 2.1.x via Enterprise Claude.ai sub | ✅ |

## 8. Authentication & credentials — strict separation

| Credential | What it's for | Cost |
|---|---|---|
| **Enterprise Claude.ai subscription** (work account) | Authenticates Claude Code during dev | Already paid |
| **Anthropic API key** (PERSONAL account, ~$4.51 balance) | Running Bulq app → Claude failover/high-stakes calls | Burns $4.51 |
| **Gemini API key** (AI Studio, free tier) | Running Bulq app → default LLM | Free within quota |
| **Supabase anon key** | App DB access (RLS-gated) | Free tier |

**Hard rules:**
- Claude Code authenticated via Enterprise subscription, never API key.
- API keys live ONLY in `.env.local` (gitignored, verified) and Vercel encrypted env vars.
- Bulq app prefers Gemini; uses Claude only on failover or high-stakes.
- Personal $4.51 account confirmed. Org policy on Enterprise-Claude-for-personal-Claude-Code is user's responsibility (R7).

**Model decisions (May 2026):**
- **High-stakes model = Claude Sonnet 4.6** ($3/$15 per M tokens) — SWAP DONE (CLAUDE_HIGH_STAKES_MODEL = 'claude-sonnet-4-6'; verified live, smoke TEST 2 returns anthropic/claude-sonnet-4-6). Reasoning tier for hard moments (trend interpretation, contradiction resolution, recalibration). ⚠️ high_stakes now bills at Sonnet rates, but NO running-app caller uses high_stakes yet (chat = Gemini); Sonnet money starts when 2.5 wiring / trends add real high_stakes calls; budget guard caps it.
- **Failover model = Claude Haiku 4.5** ($1/$5) — CLAUDE_FAILOVER_MODEL, deliberately a SEPARATE constant from the high-stakes primary, so the Sonnet swap didn't silently make failover 3× costlier.
- **Pricing verified May 2026:** Haiku $1/$5, Sonnet $3/$15, Gemini $0 (free). Stored in `src/lib/ai/pricing.ts`.
- **Budget guard thresholds:** amber 70%, red 90%, hard-stop-Claude 95% of $4.51. Guard ACTS only at hard-stop; amber/red are display-only (usage tracker).

**Privacy decision (POC vs productization):**
- **POC: free Gemini is acceptable** — builder's OWN data, single-user, wellness-not-clinical. Mitigation: minimize PII in prompts; wellness positioning.
- ⚠️ **Productization: HARD blocker.** Google's free Gemini tier TRAINS on submissions, has human reviewers, bans clinical use. Before a 2nd user's data flows, MUST migrate to a privacy-safe provider with a data-protection agreement: **paid Gemini via Vertex AI (Cloud BAA), Claude API (BAA), or OpenAI API (BAA + ZDR).** See §23 R12.

**App auth model:** Supabase email/password, confirmation OFF for POC. RLS scoped to `authenticated`. Redirect URLs: localhost set; Vercel production URL still to be added for phone login (non-blocking).

## 9. System architecture (four layers)

1. **Client (PWA):** Chat | Dashboard | Onboarding/Login | Usage tracker
2. **Application & API (Next.js routes):** API endpoints | Meal pipeline (`/lib/meals`, built) | Orchestrator/chat-wiring (step 6, next) | Domain services
3. **AI reasoning:** LLM adapter (Gemini default, Claude high-stakes/failover; FULLY hardened — retries + failover + usage logging + budget guard + graceful degradation) | RAG layer (Sprint 3) | meal pipeline tools
4. **Data & knowledge:** PostgreSQL (9 tables live) | pgvector (Sprint 3)

### Request flow (one chat message — current)
User → PWA → POST /api/chat → auth → load 15-msg history from DB → build system prompt w/ profile → llmStream (via adapter; retries + failover + budget guard + usage logging) → toDataStreamResponse() (or graceful fallback on total failure) → onFinish persists assistant msg + logs usage. Meal parsing pipeline EXISTS (`/lib/meals`) but is NOT yet called from the chat route — that wiring is step 6.

## 10. Files built so far (through Sprint 2.5 step 4c)

```
src/
  app/
    page.tsx                    ✅ protected dashboard (target card from profile) + "Usage" link
    layout.tsx                  ✅
    login/page.tsx              ✅ email/password sign-in + sign-up
    auth/signout/route.ts       ✅
    usage/page.tsx              ✅ protected usage tracker: Anthropic $ vs $4.51 (green/amber/red bar) + Gemini calls last 24h (approx ref) + lifetime calls/failures/failovers (Sprint 2.4b)
    onboarding/                 ✅ server guard + pre-filled client form + Zod server action (page/onboarding-form/actions/schema)
    chat/
      page.tsx                  ✅ server guard wrapping the chat thread (Sprint 2.3)
      chat-thread.tsx           ✅ useChat client UI; react-markdown rendering on assistant bubbles
    api/chat/route.ts           ✅ POST streaming: auth → Zod → save user msg → 15-msg history → system prompt → llmStream(userId, operation:'chat') → toDataStreamResponse(); onFinish persists + bumps; try/catch → dataStreamTextResponse(FALLBACK) on total failure (graceful degradation, NOT persisted) (Sprint 2.4b 4b-iv)
  middleware.ts                 ✅ session refresh
  lib/
    db/
      client.ts / server.ts / middleware.ts / index.ts  ✅ Supabase clients (barrel exports clients only — server-only query modules imported directly)
      profiles.ts               ✅ ProfileRow, getProfile, upsertProfile, profileToNutritionProfile
      chat.ts                   ✅ getOrCreateConversation, getMessages, getRecentMessages, insertMessage, bumpConversationTimestamp (Sprint 2.3)
      usage.ts                  ✅ logApiUsage() FAIL-SAFE; getAnthropicSpendUsd() fail-OPEN sum; getUsageSummary() fail-safe {anthropicSpendUsd, geminiCalls24h, totalCalls, failures, failovers} (Sprint 2.4b)
      foods.ts                  ✅ FoodRow (all cols, Number()-coerced) + getMatchableFoods(userId) (visible foods via .or; one query, matched in-memory; pg_trgm+GIN = scale path) (Sprint 2.5 4a)
      units.ts                  ✅ UnitRow + getUnits(userId) (visible units; mirrors foods.ts) (Sprint 2.5 4b)
      meals.ts                  ✅ MealInput/MealItemInput/MealRow/MealItemRow/MealWithItems; computeMealTotals (pure, null→0 conservative); insertMeal (pending + items batch, orphan rollback, THROWS), getMealById, setMealStatus. Core data → throws on failure (NOT fail-safe). (Sprint 2.5 step 2)
    ai/
      adapter.ts                ✅ llmCall() + llmStream() — Gemini default, Claude high_stakes (Sonnet); DEFAULT_MAX_TOKENS=2048; finishReason. HARDENED: maxRetries:2; guarded usage logging (success+failure, awaited); classifyLlmError; provider FAILOVER (transient initial-connect only, userId-gated, decoupled Haiku failover model); BUDGET GUARD (isAnthropicBudgetExhausted gates both Claude points → high-stakes downgrades to Gemini / Claude-failover skipped, at hard-stop only). Helpers: resolveByProvider/resolveModel/resolveFailoverModel/logBase
      adapter.test.ts           ✅ 6 tests (failover 3 + budget guard 3; mocks generateText/streamText + usage, keeps real APICallError) (Sprint 2.4b)
      types.ts                  ✅ Message, ToolCall, LLMCallOptions (userId?, operation?), LLMResponse, LLMPriority, LLMFinishReason, LLMStreamCallbacks
      pricing.ts                ✅ MODEL_RATES (Haiku/Sonnet/Gemini), computeCostUsd() (rateKnown, never guesses), ANTHROPIC_BUDGET_USD=4.51 + amber/red/hard-stop, GEMINI_FREE_RPD_APPROX=250 (display-only)
      pricing.test.ts           ✅ 6 tests
      errors.ts                 ✅ classifyLlmError() → {errorType, transient}; unwraps RetryError; 429→rate_limit, 5xx/529→server_error, 408→timeout, 401/403→auth, 400/404→other
      errors.test.ts            ✅ 5 tests
      data-stream.ts            ✅ dataStreamTextResponse(text) → 200 data-stream Response via formatStreamPart('text',…) so a fallback renders as a NORMAL assistant reply (Sprint 2.4b)
      data-stream.test.ts       ✅ 1 test (status/header/Content-Type/body)
      system-prompt.ts          ✅ buildChatSystemPrompt(profile) (Sprint 2.3)
      index.ts                  ✅ barrel
    meals/                      🚧 MEAL PIPELINE ENGINE (Sprint 2.5; un-wired — see §14)
      types.ts                  ✅ ParsedItem, ParsedMeal, ParseResult; Zod ParsedMealSchema (quantity coerce+default 1, meal_type .catch('unknown')) (step 3)
      parse.ts                  ✅ extractParsedMeal (PURE: strip fences/prose, JSON.parse, safeParse → ParsedMeal|null); parseMealText(userId,text) → ParseResult (llmCall standard, operation:'meal_parse', temp 0, strict numbers-FREE prompt + Indian few-shots; never throws) (step 3)
      match.ts                  ✅ normalizeFoodName (lowercase/trim/collapse/plural-s); matchFood(raw, foods) PURE → exact→alias→fuzzy(Levenshtein ≥0.82)→unknown (prefers unknown over shaky match) (step 4a)
      portion.ts                ✅ pickUnitKey(food,unit_raw) mapping; resolveGrams → per-unit grams range (Design A; fallback {null,50/100/200}); computeItemMacros (kcal band × portion band × qty/100, compounded; macros at typical grams; round at end); buildMealItem → MealItemInput (unknown → all-null macros) (step 4b)
      assemble.ts               ✅ minConfidence/computeItemConfidence (match+variance_class+portion → min)/worstConfidence; assembleMealItems (PURE) → {items, itemConfidences, confidence}; assembleMeal(userId,text) → MealAssembly (parse→fetch foods+units→assemble→MealInput; does NOT persist) (step 4c)
      parse.test.ts             ✅ 6 (extractParsedMeal)
      match.test.ts             ✅ 5 (matchFood/normalize)
      portion.test.ts           ✅ 10 (resolveGrams/computeItemMacros/buildMealItem + qty-once guard)
      assemble.test.ts          ✅ 8 (confidence + assembleMealItems)
      index.ts                  ✅ barrel (public pipeline API)
    nutrition/
      tdee.ts / types.ts / tdee.test.ts / index.ts  ✅ TDEE engine, 16 tests
    rag/index.ts                (empty — Sprint 3)
    utils/index.ts              (empty)
supabase/
  migrations/
    0001_profiles_and_weight_logs.sql       ✅ profiles + weight_logs, RLS, set_updated_at trigger
    0002_conversations_and_messages.sql     ✅ chat history tables, per-user RLS (Sprint 2.2)
    0003_foods_and_units.sql                ✅ foods + units SHARED-REFERENCE tables, split-per-operation RLS, GIN on aliases (Sprint 2.4)
    0004_seed_foods_and_units.sql           ✅ SEED 60 foods + 16 portions, all sourced (run in SQL editor; re-runnable) (Sprint 2.4)
    0005_api_usage_log.sql                  ✅ api_usage_log, per-user RLS, CHECK provider gemini/anthropic + priority standard/high_stakes (Sprint 2.4b)
    0006_meals_and_meal_items.sql           ✅ meals + meal_items, per-user RLS, meal_items.food_id ON DELETE SET NULL, meals.status DEFAULT 'pending', set_updated_at on meals. RUN in Supabase + committed. (Sprint 2.5 step 1)
scripts/
  smoke-test-llm.ts             ✅ npm run smoke:llm (Gemini + Claude independently; TEST 2 = high_stakes → Sonnet 4.6; no userId → no logging/failover/guard)
.env.local                      ✅ 4 keys, gitignored
.env.local.example              ✅ committed template
vitest.config.ts                ✅ alias @→src (needed for adapter/meals tests)
project_brief.md                ✅ THIS FILE (v7)
```

## 11. Coding principles for Claude Code

- TypeScript strict mode; **no `any` types**
- Server components by default; client components only when interactivity demands
- API routes / server actions use **Zod** for input validation
- Every DB query is a typed function in `/lib/db/` (server-only modules imported directly, NOT via the barrel)
- Every LLM call goes through `/lib/ai/adapter` — **never** import provider SDKs in business logic
- Tailwind only; no CSS-in-JS
- Tests (Vitest) on critical paths; PURE logic gets unit tests, DB/LLM functions are exercised live (proven pattern). Meal pipeline: every pure step is unit-tested.
- Row-Level Security on every Supabase table from day one (per-user for user data; shared-reference for foods/units)
- Numeric columns from Supabase: coerce with Number() in mappers
- Migration workflow (done 6×): Claude Code writes SQL → Claude.ai REVIEWS (esp. RLS) → user pastes into Supabase SQL Editor + Run → verify in Table Editor (⚠️ Table Editor CACHES — refresh or `select count(*)`) → commit. Seeds run in SQL Editor (privileged role bypasses RLS).
- Build rhythm for changes to working code: investigate → propose → show diff → Claude.ai reviews → apply. New additive modules: build → show → review. One inspectable change at a time. Prove behavior live where possible.

## 12. AI architecture key points

- **Three LLM jobs** prompted separately: parsing (NL→structured), reasoning (state→decision), composition (draft).
- **Tool-using orchestrator (step 6 / Sprint 2.6):** the meal pipeline (`/lib/meals`) is the parse/match/compute engine; wiring it into chat (intent detection → assembleMeal → confirm UX → insertMeal) is next.
- **Adapter pattern** via Vercel AI SDK — FULLY HARDENED:
  - **Retries:** SDK `maxRetries: 2` (exponential backoff) on transient errors.
  - **Error classification:** classifyLlmError (errors.ts) → {errorType, transient}; unwraps RetryError → APICallError.
  - **Failover:** transient INITIAL-connect failure → one attempt on the other provider (Gemini→Haiku, Claude→Gemini). userId-gated. Permanent errors never fail over. Logs two rows.
  - **Graceful degradation:** route try/catch → dataStreamTextResponse(FALLBACK = "I'm having trouble reaching my brain right now — please try again in a moment.") — calm reply, NOT persisted, never fabricated. (Sprint 2.4b 4b-iv, unit-proven via the failing-provider test + the data-stream test.)
  - **Budget guard:** isAnthropicBudgetExhausted (sums Anthropic spend from api_usage_log, option A; fail-open) gates BOTH Claude points → high-stakes primary downgrades to Gemini; Claude failover skipped + degrades. Acts ONLY at hard-stop (95% of $4.51). console.warn on fire. (Sprint 2.4b 4b-iii, unit-proven.)
  - **Usage logging:** every call (success or initial-failure) logs to api_usage_log via fail-safe logApiUsage; AWAITED; userId-gated.
  - **Cost computation:** pricing.ts computeCostUsd; Gemini $0; unpriced model → rateKnown:false (never a guessed rate).
  - ⚠️ KNOWN GAP (R13, deferred): MID-stream failures (drop after first chunk) not caught/logged — surface via the stream; needs route getErrorMessage later.
- **High-stakes → Claude Sonnet 4.6 (swap done):** weight-trend interpretation, contradictory-evidence resolution, onboarding TDEE explanation, 2-week recalibration, user-flagged confusion.
- ⚠️ **Gemini thinking-token issue (R11):** Gemini 2.5 Flash spends hidden "thinking" tokens. DEFAULT_MAX_TOKENS=2048 floor (fixes truncation). api_usage_log undercounts Gemini TOKEN volume — but Gemini = $0 so the $ figure (which guards $4.51 + tracks Claude whose tokens ARE surfaced) is accurate. Full fix needs an AI SDK upgrade (deferred).

## 12a. Multi-model consensus (DEFERRED to productization — research done)
- NARROW 2-proposer + 1-judge ensemble (Gemini 2.5 Pro + Claude Sonnet proposers, Claude Haiku judge) for HIGH-STAKES steps only (~5–15% of turns) — NOT full Mixture-of-Agents.
- Key findings: DB-grounding (the foods DB) is a BIGGER accuracy lever than ensembling; correlated errors mean models often agree on the same WRONG answer (consensus ≠ verification); judge must compare NUMBERS + be allowed to ABSTAIN/return a range.
- **Privacy-DISQUALIFYING for health data:** DeepSeek hosted API, Alibaba-hosted Qwen, free Gemini AI Studio tier. Privacy-safe set = paid Gemini via Vertex (BAA), Claude (BAA), OpenAI (BAA+ZDR).
- **DECISION:** defer to productization; a privacy-safe ensemble needs PAID providers anyway, tied to the same migration as §18.

## 13. RAG architecture key points (Sprint 3)
- Tiers: Tier 1 ICMR-NIN primary; Tier 2 curated PubMed/Examine; Tier 3 Bulq-authored opinion docs (cited).
- Chunking ~300–500 tokens, 50 overlap. Embeddings text-embedding-004 (768d).
- Retrieval: cosine similarity in pgvector, top-5, optional topic pre-filter, rerank by recency + evidence_grade.
- Citation enforcement: LLM emits [CITE:chunk_id] placeholders; orchestrator resolves to real source titles + links.

## 14. Meal-understanding pipeline (Sprint 2.5)
**ENGINE BUILT & UNIT-TESTED (steps 1–5). Step 6 (wire into chat) is NEXT.**
1. ✅ Tokenize input into food units — `parseMealText` (Gemini Flash, strict numbers-FREE prompt, Zod-validated; never throws). Output = ParsedItem[] + meal_type. NO nutrition numbers from the LLM.
2. ✅ Resolve to known foods — `matchFood` (exact → alias → fuzzy Levenshtein ≥0.82 → unknown). Conservative: prefers unknown over a shaky match. ('llm_inferred' deferred.)
3. ✅ Resolve units to grams — `resolveGrams` + `pickUnitKey` (food-category → unit_key; per-unit grams from the units table; fallback {null, 100g, 50–200} when unresolved). Design A: quantity applied EXACTLY ONCE.
4. ✅ Compute macros — `computeItemMacros`: kcal band = food per-100g kcal band × portion gram band × qty/100 (compounded composition × portion uncertainty); macros at typical grams. variance_class is NOT re-applied here (composition band already in the stored kcal_min/max).
5. ✅ Confidence — `computeItemConfidence` (min of match + variance_class + portion signals) + `worstConfidence` (meal = its weakest item).
6. ⏳ **Confirm with user (STEP 6, NEXT):** detect a meal-log message in chat → `assembleMeal` → persist as 'pending' (`insertMeal`) → render the proposed meal (items, conservative band, confidence dots) → user confirms (`setMealStatus` pending→confirmed) or rejects. Needs: intent detection in the chat route, the confirm UX, how the proposal renders. Corrections will feed feedback_events (later).

## 15. TDEE engine (Sprint 1 — BUILT)
- BMR: Mifflin-St Jeor (1990) ✅
- Activity multipliers: sedentary 1.2 / light 1.375 / moderate 1.55 / moderate_plus 1.6 / active 1.725 / very_active 1.9 ✅
- Ectomorph adjustment: +5–10% (default 7) for goal=gain only ✅
- Surplus: default 300 (range 250–400) gain; default 400 (300–500) deficit ✅
- deltaKcal & proteinPerKg DERIVED from goal_direction, not stored as columns
- 2-week recalibration (Sprint 4): if actual change < 50% of expected, +200 kcal/day; if > 150%, −200. 7-day rolling average.

## 16. Data model (13 tables planned; 9 LIVE)

**LIVE (9):**
- users (Supabase auth), profiles ✅, weight_logs ✅ — standard per-user RLS
- conversations ✅, messages ✅ (Sprint 2.2) — standard per-user RLS (messages.user_id denormalized)
- foods ✅, units ✅ (Sprint 2.4) — SHARED-REFERENCE RLS: user_id NULLABLE (NULL=system row readable by all authenticated; non-null=user's custom). Split policies: SELECT = (user_id IS NULL OR auth.uid()=user_id); INSERT/UPDATE/DELETE = auth.uid()=user_id only.
- api_usage_log ✅ (Sprint 2.4b) — standard per-user RLS
- meals ✅, meal_items ✅ (Sprint 2.5) — standard per-user RLS (meal_items.user_id denormalized). meal_items.food_id ON DELETE SET NULL (a foods re-seed nulls the link but the per-item macros + matched_food_name survive → no data loss). meals.status DEFAULT 'pending'.

**REMAINING (Sprint 2.6+):** meal_plans, daily_summaries, knowledge_chunks (pgvector), feedback_events.

**foods columns:** id, user_id (nullable), name, aliases text[], category (CHECK grain/dal_legume/dairy_paneer/vegetable/non_veg/supplement/fruit/beverage/composite), state (raw/cooked), variance_class (raw_ingredient/cooked_single/composite/restaurant), per-100g kcal_typical/min/max + protein_g/fat_g/carb_g/fiber_g, source_type (CHECK IFCT2017/USDA/INDB/brand_label/derived) + source_ref, notes, timestamps. ⚠️ kcal min/max are source+prep-derived (already encode composition band → don't re-apply variance_class %). Macros are single per-100g values (no band).
**units columns:** id, user_id (nullable), unit_key, label, grams_typical/min/max, source_ref, notes. 16 system rows (chapati 40/30–50, paratha 65/50–90, katori_rice & katori_dal 150/120–180, katori_sabzi 100/80–130, katori_gravy 150/130–200, katori_poha_upma 120/100–160, plate_biryani 275/200–400, paneer_serving 50/30–80, egg_large 50/45–60, scoop_whey 30/28–35, tbsp_chia 12/10–14, banana_medium 110/80–150, glass_milk 200/150–250, cup_curd 150/100–200, cup_chai 150/100–200).
**meals columns:** id, user_id, logged_at, raw_text, meal_type (CHECK breakfast/lunch/dinner/snack/unknown, nullable), note, per-meal totals kcal_min/typical/max + protein_g/fat_g/carb_g/fiber_g (nullable), confidence (CHECK high/medium/low), status (CHECK pending/confirmed/rejected, DEFAULT 'pending'), timestamps.
**meal_items columns:** id, meal_id (cascade), user_id (cascade, denormalized), food_id (→foods, ON DELETE SET NULL, nullable), food_name_raw, matched_food_name, quantity, unit_key, grams_used, match_method (CHECK exact/alias/fuzzy/llm_inferred/unknown), per-item kcal_min/typical/max + macros (nullable), created_at.
**api_usage_log columns:** id, user_id, created_at, provider (CHECK gemini/anthropic), model, priority (CHECK standard/high_stakes), operation, prompt/completion/total_tokens, estimated_cost_usd (default 0), finish_reason, success (default true), error_type, failed_over (default false), latency_ms.

### Foods DB provenance (Sprint 2.4 — sourced, not invented)
- 60 foods (the user's actual diet). Sources: IFCT 2017 (ICMR-NIN) for raw ingredients (food codes); USDA FoodData Central (FDC IDs) for cooked single items + gaps; INDB (Vijayakumar et al. 2024, DOI 10.1016/j.cdnut.2024.103790) for composites; ICMR "My Plate" for portions.
- Key corrected assumptions: cooked chicken breast 31g protein/100g (150g cooked ≈ 46g; raw-vs-cooked weight matters); boiled kala chana ~9g protein/100g (15–18g is DRY chana).
- ⚠️ PRE-PRODUCTIZATION: verify a few IFCT values vs the official IFCT 2017 PDF.

## 17. Trust & verification framework
5 layers: input verification, source grounding (foods DB w/ provenance), uncertainty surfacing (ranges everywhere + worst-item confidence), refusal-when-unsure (matcher prefers unknown; LLM never emits numbers), audit trail (api_usage_log). Anti-hallucination post-processor (Sprint 2.7) will enforce numbers-sourced/tone/absolutes. Confidence-card UX primitive (green/amber/gray dot) planned (itemConfidences already returned by assembleMeal for this).

## 18. Privacy & security
- PII + health data in Supabase, encrypted at rest, behind auth ✅
- RLS on every table from day one ✅ (9 tables)
- Data export (full JSON) + data deletion first-class from MVP (on delete cascade in place)
- No biometric data beyond weight in MVP
- No medical claims; wellness/lifestyle positioning
- API keys in .env.local (gitignored) + Vercel encrypted env vars only
- ⚠️ **Free Gemini trains on submissions (POC-acceptable for the builder's own data; HARD productization blocker — migrate to BAA-covered paid provider before a 2nd user). See §8 + §23 R12.**

## 19. Development environment
| Item | Value |
|---|---|
| OS | macOS |
| Package manager | Homebrew |
| Node.js | v20+ via Homebrew |
| Git | gh CLI authenticated (adicchobe), HTTPS, git identity = GitHub noreply |
| Editor | VS Code |
| AI dev tool | Claude Code CLI 2.1.x via Enterprise sub |
| Repo location | ~/projects/bulq |
| Dev server | `npm run dev` (started by Claude Code; long-running; localhost). ⚠️ Editing .env.local auto-restarts it; requests during the restart window fail at connect (no log row). Supabase timestamps are UTC (+00); Mumbai = UTC+5:30. |

## 20. Project status
- ✅ Phase 1 — Problem refinement complete
- ✅ Phase 2 — Architecture complete
- 🚧 Phase 3 — Execution
  - ✅ Sprint 0 — Foundations COMPLETE
  - ✅ Sprint 1 — Profile + TDEE + Auth + Onboarding COMPLETE
  - 🚧 Sprint 2 — Chat + Meal logging IN PROGRESS
    - ✅ 2.1 adapter chat-ready (llmStream, R11 maxTokens fix, finishReason)
    - ✅ 2.2 conversations + messages tables (RLS)
    - ✅ 2.3 basic chat (streaming, personalized, react-markdown, honest, tested live)
    - ✅ 2.4 foods database (schema + 60 sourced foods + 16 portions)
    - ✅ 2.4b LLM hardening COMPLETE — api_usage_log, pricing.ts, logApiUsage, logging wired (4a), retries+classification+failure-logging (4b-i), failover (4b-ii), graceful degradation + failover unit test (4b-iv), budget guard (4b-iii.1), usage tracker page (4b-iii.2). + Sonnet swap done.
    - 🚧 2.5 meal-understanding pipeline — ENGINE COMPLETE (steps 1–5): ✅ step 1 meals+meal_items tables; ✅ step 2 meal store (meals.ts); ✅ step 3 parse; ✅ step 4a match; ✅ step 4b portions+calorie band; ✅ step 4c confidence+assembly. ⏳ step 6 = wire into chat (intent detection + confirm UX + persist).
    - ⏳ 2.6 intra-day state (daily_summaries) + "what should I do now"
    - ⏳ 2.7 anti-hallucination post-processor
  - ⏳ Sprint 3 — Knowledge + Citations (RAG)
  - ⏳ Sprint 4 — Trends + Plans
  - ⏳ Sprint 5 — Polish + Daily use

## 21. Sprint structure
| Sprint | Status | Deliverable |
|---|---|---|
| 0 — Foundations | ✅ DONE | Deployed app, DB, adapter verified |
| 1 — Profile + TDEE | ✅ DONE | Auth + tables + onboarding + TDEE |
| 2 — Chat + Meal Logging | 🚧 IN PROGRESS | Chat ✅ + foods DB ✅ + LLM hardening ✅ + meal-pipeline engine ✅ + chat-wiring (step 6) + intra-day (2.6) + anti-hallucination (2.7) |
| 3 — Knowledge + Citations | ⏳ | RAG pipeline, sources on claims |
| 4 — Trends + Plans | ⏳ | Weight logging, trend interpretation, meal plan generator |
| 5 — Polish + Daily Use | ⏳ | PWA, perf, npm audit, URL rename |

## 22. Open decisions / carried-forward items
| # | Item | Status |
|---|---|---|
| 1 | Lab report flags | ✅ DONE — reviewed, no flags (§3a) |
| 2 | Whey timing/type experiment (isolate vs concentrate, earlier in day) | Flagged for feedback loop |
| 3 | Gemini thinking-budget / api_usage_log token undercount | maxTokens floor done; full fix needs AI SDK upgrade (deferred) |
| 4 | Top up Anthropic balance beyond $4.51 | Defer until real usage data |
| 5 | Sentry adoption | Defer to first 5 users |
| 6 | Vercel URL rename + domain/branding | Defer to v0.2 |
| 7 | Org policy check on Enterprise Claude for personal project | User's responsibility |
| 8 | npm audit | Defer to Sprint 5 |
| 9 | Vercel AI SDK v3 → v4 upgrade | Defer; v3 stable |
| 10 | Conversational chat onboarding | Deferred to v0.2; form stays as settings |
| 11 | Re-enable email confirmation + nicer auth (magic-link/Google OAuth) | Defer to v0.2 |
| 13 | Add Vercel production URL to Supabase redirect URLs (phone login) | Pending, non-blocking |
| 14 | High-stakes model swap Haiku → Sonnet 4.6 | ✅ DONE (verified live) |
| 15 | Budget guard + usage tracker UI | ✅ DONE (2.4b) |
| 16 | Graceful degradation + failover unit test | ✅ DONE (2.4b 4b-iv) |
| 17 | Mid-stream streaming failure logging | Deferred (needs route getErrorMessage) — R13 |
| 18 | Verify IFCT food values vs official PDF | Pre-productization |
| 19 | Migrate off free Gemini to BAA provider | Pre-productization HARD blocker (§18, R12) |
| 20 | Multi-model 2-proposer/1-judge consensus | Productization (§12a) |
| 21 | Verify current Gemini free-tier RPD (uncertain; tracker uses adjustable ~250) | When refining tracker |
| 22 | **Meal band method** — DECIDED: compound stored per-100g kcal band × portion gram band; variance_class is confidence-only, NEVER a kcal multiplier (would double-count). Bands are honestly wide (e.g. 3 rotis ≈ 227–534 kcal) — correct per pillar #2. | ✅ DECIDED |
| 23 | **Quantity applied exactly once** (Design A: per-unit grams in resolveGrams; ×qty in computeItemMacros + grams_used). Guard test locks it. | ✅ DECIDED |
| 24 | **Meal confidence = worst-item rule** (min of per-item match+variance+portion signals). Calorie-weighted confidence = possible future refinement. | ✅ DECIDED |
| 25 | **Add a dedicated chicken serving unit** — chicken logged weekly, currently hits the wide 100g fallback. Add a units row once validated live. | PENDING (fast-follow) |
| 26 | **'llm_inferred' food matching** — for foods outside the 60, infer/estimate via LLM. Deferred; matcher returns 'unknown' for now. | PENDING (fast-follow) |
| 27 | **Per-user portion calibration (R5)** — "your katori is 130g" → narrows bands. | v0.2 |

## 23. Risks register
| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Food DB estimates off >20% → user under-eats surplus | Medium | High | 3-value band + 2-week TDEE calibration |
| R2 | LLM hallucinates calorie number despite tools | Low | High | Meal pipeline: LLM NEVER emits numbers (parse is numbers-free); numbers only from foods DB; anti-hallucination post-processor (2.7) |
| R3 | $4.51 Anthropic drained | Medium | Medium | Gemini default; cost tracking + budget guard (live); failover uses cheap Haiku |
| R4 | User stops logging after week 2 | High | High | Chat-first logging; intra-day rewards; never shame |
| R5 | Katori size mismatch | High | Medium | Per-user calibration v0.2; band absorbs in MVP |
| R6 | Supabase free tier runs out post-launch | Low for MVP | High at scale | Clear migration path |
| R7 | Org policy on personal use of Enterprise Claude | Unknown | Medium | User to verify |
| R8 | Gemini Flash quality worse on Indian queries | Medium | Medium | High-stakes routing to Claude; measure on real queries |
| R9 | RAG corpus stale/contradictory | Medium | Medium | Tier 3 docs; weekly review |
| R10 | Undiagnosed health condition → wrong recommendations | Low | Very High | Red-flag screen; wellness disclaimer; full checkup reviewed (§3a) |
| R11 | Gemini thinking tokens silently truncate responses | Medium (mitigated) | High | maxTokens floor (done); $ tracking unaffected |
| R12 | **Free Gemini trains on health data** | N/A for POC; CERTAIN at productization | High | POC: own data + minimize PII. Productization: HARD blocker — migrate to Vertex/Claude/OpenAI w/ BAA before 2nd user. |
| R13 | Mid-stream LLM failures not caught (drop after first chunk) | Low | Low-Med | Deferred; graceful degradation covers initial/both-fail; route getErrorMessage later |
| R14 | Wrong fuzzy food match → wrong calories | Low-Med | High | Conservative fuzzy threshold (0.82); prefers 'unknown' over a shaky match; confirm UX (step 6) lets user correct |
| R15 | Meal portion fallback (unresolved unit → 100g/50–200) too wide to be useful | Medium | Medium | Honest wide band + low confidence; chicken serving unit (#25) + per-user calibration (R5) tighten common cases |

## 24. How the user works with Claude (PM mode)
- User (Aditya) is a **non-coder**, guided step-by-step. Define unfamiliar terms briefly and simply.
- **CONCISE answers — do not overcomplicate** (for the user or Claude). The project is large; stay to the point. Focus on a bug-free best solution aligned with the goal; don't forget backlog.
- Claude acts as **program manager** + architect + engineer + thinking partner.
- **USER PROCESS REQUEST:** surface decisions that need his input (anything affecting goal, cost, data integrity, or hard-to-undo) clearly with stakes spelled out (🎯). Decide low-stakes/reversible/technical things and just mention them. Markers: ⚠️ RISK, 🎯 DECISION NEEDED, 🧠 ASSUMPTION/plain-English.
- Claude summarizes at end of each session (changed / next / blocking). Flags real-money actions BEFORE proceeding.
- Claude owns step ordering, prerequisite verification, QA, security checks, and proactively re-shares/updates this brief.
- Claude reviews ALL Claude-Code-generated SQL/code before it touches DB/prod, especially RLS.
- Build rhythm: working code → investigate + propose + diff → review → apply; new modules → build → show → review. One inspectable change at a time. Prove behavior live where possible.
- Claude Code prompts: pick "Yes" (option 1), never "don't ask again"; stop on git commits/pushes, .env changes, anything outside ~/projects/bulq, or spending beyond tiny verified calls.
- **Claude Code effort:** subtle/decision-heavy work (architecture, the band math, bug hunts) → max effort earns its keep; implementing settled designs → high effort is enough (review + tests are the safety net regardless). User manages this against Enterprise-sub usage.

## 25. Where we are RIGHT NOW (for a fresh session)
- **2.4b COMPLETE** (full LLM hardening: logging, retries, failover, graceful degradation, budget guard, usage tracker). **Sonnet swap DONE** (high_stakes = claude-sonnet-4-6, verified live).
- **Sprint 2.5 meal-pipeline ENGINE COMPLETE & unit-tested (steps 1–5), committed:** meals+meal_items tables (0006, RUN in Supabase); meal store (meals.ts: insertMeal/getMealById/setMealStatus/computeMealTotals); parse (parse.ts: NL→ParsedMeal, numbers-free, Zod); match (match.ts: exact/alias/fuzzy≥0.82/unknown); portions+calorie band (portion.ts: per-unit grams, qty-once, compounded band); confidence+assembly (assemble.ts: worst-item rule, assembleMeal → proposed MealInput, does NOT persist). 66 tests passing.
- **IMMEDIATE NEXT = Sprint 2.5 step 6: WIRE THE PIPELINE INTO CHAT** (the payoff). Plan it before building. Needs: (a) intent detection in the chat route — is this message a meal to log vs a question? (b) call assembleMeal → persist as 'pending' via insertMeal; (c) render the proposed meal (items, conservative kcal band, confidence — itemConfidences already returned); (d) user confirms (setMealStatus pending→confirmed) or rejects. assembleMeal makes a real Gemini parse call (operation:'meal_parse', logged) + reads foods/units. Migration 0006 is confirmed applied, so live runs will work.
- **THEN:** 2.6 intra-day state (daily_summaries: consumed-today vs target — decide which band number feeds the running total/recommendation; "what should I do now") → 2.7 anti-hallucination post-processor → Sprint 2 done.
- **Pending small items (don't forget):** chicken serving unit (#25); 'llm_inferred' matching (#26); verify Gemini free-tier RPD when refining the tracker (#21); add Vercel prod URL to Supabase redirects (#13); the orphaned-user-message-on-failed-turn hygiene item (minor).
