# Bulq — Project Brief

> Living document. Canonical context for Claude Code, future Claude.ai sessions, and any AI assistant working on this project. Updated at the end of each major decision point.
>
> **Last updated:** Mid Phase 3 — Sprint 2.4 COMPLETE + Sprint 2.4b IN PROGRESS (v6). Foods database live (60 sourced foods + 16 portions). Chat live (streaming, personalized, honest about numbers). LLM adapter HARDENED: usage logging + retries + error classification + provider failover all done & committed; budget guard + graceful degradation still to come.

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

1. **Never invent nutritional numbers.** Use database lookups or cite sources. If unknown, say "I don't know precisely" and show a range. (Now LIVE: 60 foods, every row carries source_type + source_ref.)
2. **Always surface uncertainty.** Show ranges, never false precision. *"~280–340 kcal"*, never *"312 kcal"* for an estimate.
3. **Conservative estimates by default for planning.** Under-estimate calories rather than over, so user doesn't fall short of surplus target. (Now LIVE: per-100g kcal min/typical/max band; portion variance applied in meal pipeline.)
4. **Every scientific claim has a citation or is marked as estimate.** No bare assertions.
5. **Indian-first food knowledge.** Rotis, dals, sabzis, paneer, eggs, common Mumbai foods. Western foods deferred.
6. **Respect the cooking situation.** Maid-prepared vs. self-prepared meals have different effort/timing.
7. **No diet shaming, no compliance shaming.** Never use weight-loss app language ("guilt-free", "cheat day", "treat yourself").
8. **Single-tenant data, multi-tenant ready.** Every user-data table has `user_id` from day one; RLS enforced. (LIVE: profiles, weight_logs, conversations, messages, api_usage_log = standard per-user RLS; foods, units = shared-reference RLS — see §16.)
9. **Symmetric caloric engine.** Surplus and deficit are the same math with opposite sign. Pivot-ready.
10. **LLM-provider-agnostic.** All AI calls go through `/lib/ai/adapter`. **Default = Gemini 2.5 Flash (free).** High-stakes swap-in = Claude (see §8 — DECIDED Sonnet 4.6, swap pending; currently Haiku). Failover model = Claude Haiku (cheap, decoupled from the high-stakes primary).

## 5. MVP scope (v0.1)

### In MVP
1. Onboarding chat — (Sprint 1 shipped a pre-filled FORM; conversational chat onboarding deferred to v0.2. Form doubles as edit-profile/settings.) ✅ FORM BUILT
2. TDEE / calorie-target calculator — Mifflin-St Jeor + activity + ectomorph adj + surplus, with uncertainty band ✅ BUILT
3. Chat as primary surface — stateful, intra-day aware ✅ BASIC CHAT LIVE (streaming, personalized, honest; intra-day awareness comes with meal pipeline 2.5/2.6)
4. Real-time meal logging via natural language → parsed, confirmed, stored ⏳ Sprint 2.5
5. Conservative food estimates — each food has min/typical/max kcal ✅ DATA LIVE (60 foods)
6. Intra-day running state — consumed today + remaining vs target ⏳ Sprint 2.6
7. Real-time recommendations — "what should I do now" ⏳ Sprint 2.6
8. Weekly meal plan generator ⏳ Sprint 4
9. Manual weight logging ⏳ Sprint 4
10. Weekly trend interpretation + 2-week TDEE recalibration ⏳ Sprint 4
11. Indian-first food database — ✅ 60 foods curated & sourced (target was ~300; 60 covers the user's actual diet for POC; expand via INDB later)
12. RAG knowledge base — ICMR-NIN + curated PubMed/Examine ⏳ Sprint 3
13. Source citations on every claim ⏳ Sprint 3 (foods already carry provenance in DB)
14. Uncertainty disclosure on every estimate ✅ (dashboard + chat already show ranges)

### NOT in MVP
Photo logging, training/exercise programming, native apps (PWA covers it), wearables, push notifications, recipe generation, bilingual, multi-user/social, payments, weight-loss-mode UI

## 6. Long-term vision
- v0.2 — Photo logging, wearable sync, notifications, weight-loss mode, Hindi/Marathi, conversational onboarding upgrade, magic-link/Google OAuth, re-enable email confirmation, **migrate off free Gemini to paid privacy-safe providers (HARD blocker, see §18/§23)**, **multi-model 2-proposer/1-judge consensus for high-stakes (see §12a)**
- v0.5 — Public beta, multi-user, subscription, doctor/RD read-only portal
- v1.0 — Multi-region (Indian diaspora first), verified-creator content layer
- v2.0+ — Biomarker integration, CGM reasoning, micronutrient targeting

## 7. Tech stack (all installed/working)

| Layer | Choice | Status / Free-tier |
|---|---|---|
| Framework | Next.js 14.2.35 (App Router) | ✅ |
| Language | TypeScript strict mode | ✅ tsc clean throughout |
| UI | Tailwind 3.4 (shadcn not yet added); react-markdown for chat bubbles | ✅ |
| Mobile | PWA via next-pwa | ⏳ Sprint 5 |
| Hosting | Vercel (env vars set in dashboard) | ✅ deployed live, auto-deploy on push |
| DB + Auth + Storage + Vector | Supabase (project: bulq-dev, Mumbai region) | ✅ 7 tables + RLS + auth live |
| Auth | Supabase email/password, email confirmation OFF for POC | ✅ working |
| Vector store | pgvector inside Supabase | ⏳ Sprint 3 |
| LLM default | Gemini 2.5 Flash (`gemini-2.5-flash`), free tier | ✅ verified working |
| LLM high-stakes | DECIDED Claude Sonnet 4.6 (`claude-sonnet-4-6`); **swap PENDING** — adapter currently still routes high_stakes to Claude Haiku 4.5 (`claude-haiku-4-5-20251001`). Inert today (no high_stakes calls happen yet). | ⏳ swap before first high_stakes use |
| LLM failover | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) — CLAUDE_FAILOVER_MODEL, decoupled from high-stakes primary so the Sonnet swap won't make failover expensive | ✅ live |
| Embeddings | Gemini text-embedding-004 (768 dim) | ⏳ Sprint 3 |
| Vercel AI SDK | `ai` 3.4.33 + `@ai-sdk/google` 0.0.55 + `@ai-sdk/anthropic` 0.0.50 | ✅ |
| Testing | Vitest (TDEE 16, pricing 6, errors 5 = 27 tests) | ✅ all passing |
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
- **High-stakes model = Claude Sonnet 4.6** ($3/$15 per M tokens) — better reasoning for the genuinely hard moments (trend interpretation, contradiction resolution, recalibration explanations). Haiku is the fast/cheap classifier tier; Sonnet is the reasoning tier. **Swap is PENDING** (one-liner on CLAUDE_HIGH_STAKES_MODEL) — do before the first real high_stakes call (meal pipeline / trends). Inert today.
- **Failover model = Claude Haiku 4.5** ($1/$5) — CLAUDE_FAILOVER_MODEL, deliberately a SEPARATE constant from the high-stakes primary, so the Sonnet swap can't silently make failover 3× costlier.
- **Pricing verified May 2026:** Haiku $1/$5, Sonnet $3/$15, Gemini $0 (free). Stored in `src/lib/ai/pricing.ts`.
- **Budget guard thresholds (for the pending guard + tracker):** amber 70%, red 90%, hard-stop-Claude 95% of $4.51.

**Privacy decision (POC vs productization):**
- **POC: free Gemini is acceptable** — it's the builder's OWN data, single-user, wellness-not-clinical positioning. Mitigation: minimize PII in prompts; keep wellness positioning.
- ⚠️ **Productization: HARD blocker.** Google's free Gemini tier explicitly TRAINS on submissions, has human reviewers, says "don't submit personal info," and bans clinical use. Before a 2nd user's data flows, MUST migrate to a privacy-safe provider with a data-protection agreement: **paid Gemini via Vertex AI (Cloud BAA), Claude API (BAA), or OpenAI API (BAA + ZDR).** See §23 R12.

**App auth model:** Supabase email/password, confirmation OFF for POC. RLS scoped to `authenticated`. Redirect URLs: localhost set; Vercel production URL still to be added for phone login (non-blocking).

## 9. System architecture (four layers)

1. **Client (PWA):** Chat | Dashboard | Onboarding/Login
2. **Application & API (Next.js routes):** API endpoints | Orchestrator (Sprint 2.5) | Domain services
3. **AI reasoning:** LLM adapter (Gemini default, Claude high-stakes/failover, hardened with retries + failover + usage logging) | RAG layer (Sprint 3) | Tools (Sprint 2.5)
4. **Data & knowledge:** PostgreSQL (7 tables live) | pgvector (Sprint 3)

### Request flow (one chat message — current)
User → PWA → POST /api/chat → auth → load 15-msg history from DB → build system prompt w/ profile → llmStream (via adapter; retries + failover + usage logging) → toDataStreamResponse() → onFinish persists assistant msg + logs usage. Meal parsing / tools / anti-hallucination = Sprint 2.5–2.7.

## 10. Files built so far (through Sprint 2.4b Pass 4b-ii)

```
src/
  app/
    page.tsx                    ✅ protected dashboard (renders target card from saved profile)
    layout.tsx                  ✅
    login/page.tsx              ✅ email/password sign-in + sign-up
    auth/signout/route.ts       ✅
    onboarding/                 ✅ server guard + pre-filled client form + Zod server action (page/onboarding-form/actions/schema)
    chat/
      page.tsx                  ✅ server guard wrapping the chat thread (Sprint 2.3)
      chat-thread.tsx           ✅ useChat client UI; react-markdown rendering on assistant bubbles
    api/chat/route.ts           ✅ POST streaming: auth → Zod{conversationId,message} → save user msg → 15-msg history → system prompt w/ profile → llmStream(userId, operation:'chat') → toDataStreamResponse(); onFinish persists assistant msg + bumps timestamp (logging happens inside the adapter)
  middleware.ts                 ✅ session refresh
  lib/
    db/
      client.ts / server.ts / middleware.ts / index.ts  ✅ Supabase clients (index barrel exports clients only — server-only query modules imported directly)
      profiles.ts               ✅ ProfileRow, getProfile, upsertProfile, profileToNutritionProfile (Number() coercion)
      chat.ts                   ✅ getOrCreateConversation, getMessages, getRecentMessages, insertMessage, bumpConversationTimestamp (Sprint 2.3)
      usage.ts                  ✅ logApiUsage() — FAIL-SAFE (never throws), computes cost via pricing.ts, flags 'unpriced_model'; called from adapter, guarded on userId. Imported directly (server-only). (Sprint 2.4b)
    ai/
      adapter.ts                ✅ llmCall() + llmStream() — Gemini default, Claude high_stakes; DEFAULT_MAX_TOKENS=2048 (R11 fix); finishReason. HARDENED: maxRetries:2 (SDK exponential backoff); guarded usage logging (success + failure); classifyLlmError; provider FAILOVER (transient + initial-connect only, one attempt, userId-gated); resolveByProvider / resolveModel / resolveFailoverModel / logBase helpers; CLAUDE_HIGH_STAKES_MODEL + CLAUDE_FAILOVER_MODEL constants
      types.ts                  ✅ Message, ToolCall, LLMCallOptions (incl. userId?, operation?), LLMResponse, LLMPriority ('standard'|'high_stakes'), LLMFinishReason, LLMStreamCallbacks
      pricing.ts                ✅ MODEL_RATES (Haiku/Sonnet/Gemini), computeCostUsd() (rateKnown flag, never guesses), ANTHROPIC_BUDGET_USD=4.51 + amber/red/hard-stop thresholds (Sprint 2.4b)
      pricing.test.ts           ✅ 6 tests
      errors.ts                 ✅ classifyLlmError() → {errorType, transient}; LlmErrorType; unwraps RetryError → APICallError; 429→rate_limit, 5xx/529→server_error, 408→timeout (transient), 401/403→auth, 400/404→other (permanent) (Sprint 2.4b)
      errors.test.ts            ✅ 5 tests (incl. RetryError-unwrap proof)
      system-prompt.ts          ✅ buildChatSystemPrompt(profile) — Bulq identity + pillars + personalization (Sprint 2.3)
      index.ts                  ✅ barrel
    nutrition/
      tdee.ts / types.ts / tdee.test.ts / index.ts  ✅ TDEE engine, 16 tests
    rag/index.ts                (empty — Sprint 3)
    utils/index.ts              (empty)
supabase/
  migrations/
    0001_profiles_and_weight_logs.sql       ✅ profiles + weight_logs, RLS (set_updated_at trigger)
    0002_conversations_and_messages.sql     ✅ chat history tables, per-user RLS (Sprint 2.2)
    0003_foods_and_units.sql                ✅ foods + units SHARED-REFERENCE tables, split-per-operation RLS, GIN index on aliases (Sprint 2.4)
    0004_seed_foods_and_units.sql           ✅ SEED: 60 foods + 16 portions, all sourced (run in SQL editor; clears system rows first; re-runnable) (Sprint 2.4)
    0005_api_usage_log.sql                  ✅ api_usage_log, standard per-user RLS, CHECK provider in ('gemini','anthropic') + priority in ('standard','high_stakes') aligned to adapter values (Sprint 2.4b)
scripts/
  smoke-test-llm.ts             ✅ npm run smoke:llm (tests Gemini + Claude independently; no userId → no logging/failover)
.env.local                      ✅ 4 keys, gitignored
.env.local.example              ✅ committed template
project_brief.md                ✅ THIS FILE (v6)
```

## 11. Coding principles for Claude Code

- TypeScript strict mode; **no `any` types**
- Server components by default; client components only when interactivity demands
- API routes / server actions use **Zod** for input validation
- Every DB query is a typed function in `/lib/db/` (server-only modules imported directly, NOT via the barrel, to keep next/headers code out of client bundles)
- Every LLM call goes through `/lib/ai/adapter` — **never** import provider SDKs in business logic
- Tailwind only; no CSS-in-JS
- Tests (Vitest) on critical paths: TDEE ✅, pricing ✅, error classification ✅; meal pipeline + failover-unit-test to come
- Row-Level Security on every Supabase table from day one (per-user for user data; shared-reference model for foods/units)
- Numeric columns from Supabase: coerce with Number() in mappers
- Migration workflow (done 5×): Claude Code writes SQL → Claude.ai REVIEWS (esp. RLS) → user pastes into Supabase SQL Editor + Run → verify in Table Editor (⚠️ Table Editor view CACHES — refresh or `select count(*)` for ground truth) → commit. Seeds/system rows run in SQL Editor (privileged role bypasses RLS).

## 12. AI architecture key points

- **Three LLM jobs** prompted separately: parsing (NL→structured), reasoning (state→decision), composition (draft). (Orchestrator = Sprint 2.5.)
- **Tool-using orchestrator (Sprint 2.5):** lookup_food, estimate_unknown_food, calculate_tdee, get_today_summary, get_weekly_trend, search_knowledge, log_meal, log_weight.
- **Adapter pattern** via Vercel AI SDK. Verified both providers. NOW HARDENED:
  - **Retries:** SDK built-in `maxRetries: 2` (exponential backoff, initial 2s ×2) on transient errors.
  - **Error classification:** `classifyLlmError` (src/lib/ai/errors.ts) → {errorType, transient}; unwraps RetryError to the underlying APICallError.
  - **Failover:** on a TRANSIENT INITIAL-connect failure, one attempt on the other provider (Gemini→Haiku, Claude→Gemini). userId-gated (real requests only; smoke test unaffected, still tests each provider independently). Permanent errors (auth/bad-request) never fail over. Logs two rows: primary (success:false, failed_over:false) + failover (success:true, failed_over:true).
  - ⚠️ KNOWN GAP (deferred): MID-stream failures (drop after first chunk) aren't caught/logged yet — they surface via the stream. Needs toDataStreamResponse({getErrorMessage}) in the route. Defer/decide in a later pass.
  - **Usage logging:** every call (success or initial-failure) logs to api_usage_log via fail-safe logApiUsage; AWAITED (so the row writes before the serverless fn suspends); guarded on userId.
  - **Cost computation:** pricing.ts computeCostUsd; Gemini $0; unpriced model → rateKnown:false + 'unpriced_model' flag (never a guessed rate).
- **Budget guard (PENDING — Sprint 2.4b Pass 4b-iii):** before a Claude call, sum estimated_cost_usd where provider='anthropic' for the user from api_usage_log (DECISION: query the table — option A, always accurate; in-memory cache useless on serverless); at hard-stop (95% of $4.51) stop auto-spending on Claude → route to Gemini or degrade.
- **Graceful degradation (PENDING — Sprint 2.4b Pass 4b-iv):** if everything fails → calm "I'm having trouble — try again in a moment," never a raw error, never a fabricated answer. + a failover UNIT TEST with a mocked failing provider (repeatable proof, no key-juggling).
- **High-stakes → Claude Sonnet 4.6 (after swap):** weight-trend interpretation, contradictory-evidence resolution, onboarding TDEE explanation, 2-week recalibration, user-flagged confusion.
- ⚠️ **Gemini thinking-token issue (R11):** Gemini 2.5 Flash spends hidden "thinking" tokens not surfaced in completionTokens. DEFAULT_MAX_TOKENS=2048 floor set in adapter (fixes truncation). api_usage_log undercounts Gemini TOKEN volume — but Gemini cost is $0, so the $ figure (which guards R3's $4.51, and tracks Claude whose tokens ARE surfaced) is accurate. Full token-count fix needs an AI SDK upgrade (deferred).

## 12a. Multi-model consensus (DEFERRED to productization — research done)
- Research recommended a NARROW 2-proposer + 1-judge ensemble (e.g. Gemini 2.5 Pro + Claude Sonnet as proposers, Claude Haiku as judge) for HIGH-STAKES steps only (~5–15% of turns) — NOT full Mixture-of-Agents.
- Key findings: grounding numbers in a verified DB (= the foods DB) is a BIGGER accuracy lever than ensembling; correlated errors mean models often agree on the same WRONG answer (consensus ≠ verification); judge must compare NUMBERS (structured output) and be allowed to ABSTAIN/return a range.
- **Privacy-DISQUALIFYING for health data:** DeepSeek hosted API, Alibaba-hosted Qwen, free Gemini AI Studio tier (training-on-input / jurisdiction / clinical-use ban). Privacy-safe set = paid Gemini via Vertex (BAA), Claude (BAA), OpenAI (BAA+ZDR).
- **DECISION:** defer to productization; a privacy-safe ensemble needs PAID providers anyway, so it's naturally tied to the same migration as §18. Adopt 2-proposer/1-judge then, at high-stakes steps only.

## 13. RAG architecture key points (Sprint 3)
- Tiers: Tier 1 ICMR-NIN primary; Tier 2 curated PubMed/Examine; Tier 3 Bulq-authored opinion docs (cited).
- Chunking ~300–500 tokens, 50 overlap. Embeddings text-embedding-004 (768d).
- Retrieval: cosine similarity in pgvector, top-5, optional topic pre-filter, rerank by recency + evidence_grade.
- Citation enforcement: LLM emits [CITE:chunk_id] placeholders; orchestrator resolves to real source titles + links.

## 14. Meal-understanding pipeline (6 steps, Sprint 2.5 — NEXT major feature)
1. Tokenize input into food units (Gemini Flash, structured output)
2. Resolve to known foods (exact → alias via foods.aliases GIN index → fuzzy → LLM-inferred → unknown)
3. Resolve units to grams (the units table: chapati 40g, katori_dal 150g, etc.)
4. Compute macros (per-100g × portion; apply conservative band: ±10% raw / ±15-20% cooked-single / ±25-35% composite, biased to under-count for a gainer)
5. Confidence assessment (worst-item rule)
6. Confirm with user; corrections feed feedback_events

## 15. TDEE engine (Sprint 1 — BUILT)
- BMR: Mifflin-St Jeor (1990) ✅
- Activity multipliers: sedentary 1.2 / light 1.375 / moderate 1.55 / moderate_plus 1.6 / active 1.725 / very_active 1.9 ✅
- Ectomorph adjustment: +5–10% (default 7) for goal=gain only ✅
- Surplus: default 300 (range 250–400) gain; default 400 (300–500) deficit ✅
- deltaKcal & proteinPerKg DERIVED from goal_direction, not stored as columns
- 2-week recalibration (Sprint 4): if actual change < 50% of expected, +200 kcal/day; if > 150%, −200. 7-day rolling average.

## 16. Data model (13 tables planned; 7 LIVE)

**LIVE (7):**
- users (Supabase auth), profiles ✅, weight_logs ✅ — standard per-user RLS
- conversations ✅, messages ✅ (Sprint 2.2) — standard per-user RLS (messages.user_id denormalized)
- foods ✅, units ✅ (Sprint 2.4) — SHARED-REFERENCE RLS: user_id NULLABLE (NULL=system row readable by all authenticated; non-null=user's custom row). Split per-operation policies: SELECT = (user_id IS NULL OR auth.uid()=user_id); INSERT/UPDATE/DELETE = auth.uid()=user_id only (users can't touch system rows).
- api_usage_log ✅ (Sprint 2.4b) — standard per-user RLS

**REMAINING (Sprint 2.5+):** meals, meal_items, meal_plans, daily_summaries, knowledge_chunks (pgvector), feedback_events.

**foods columns:** id, user_id (nullable), name, aliases text[], category (CHECK: grain/dal_legume/dairy_paneer/vegetable/non_veg/supplement/fruit/beverage/composite), state (raw/cooked), variance_class (raw_ingredient/cooked_single/composite/restaurant — drives band), per-100g kcal_typical/min/max + protein_g/fat_g/carb_g/fiber_g, source_type (CHECK: IFCT2017/USDA/INDB/brand_label/derived) + source_ref, notes, created_at, updated_at(trigger).
**units columns:** id, user_id (nullable, for future R5 per-user calibration), unit_key, label, grams_typical/min/max, source_ref, notes, created_at.
**api_usage_log columns:** id, user_id, created_at, provider (CHECK gemini/anthropic), model, priority (CHECK standard/high_stakes), operation, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd (default 0), finish_reason, success (default true), error_type, failed_over (default false), latency_ms. Index (user_id, created_at desc).

### Foods DB provenance (Sprint 2.4 — sourced, not invented)
- 60 foods (the user's actual diet): grains/breads, all his dals (raw + cooked variants), paneer/dairy, his sabzis, chicken/egg, whey/chia/soya, banana, coffee/chai. 16 portion units.
- Sources: IFCT 2017 (ICMR-NIN) primary for raw ingredients (with food codes); USDA FoodData Central (with FDC IDs) for cooked single items + gaps (e.g. chia); Indian Nutrient Databank (INDB, Vijayakumar et al. 2024, DOI 10.1016/j.cdnut.2024.103790) for composite dishes; ICMR "My Plate" for portions.
- Key corrected user assumptions: cooked chicken breast 31g protein/100g (so 150g cooked ≈ 46g; raw-vs-cooked weight matters); boiled kala chana ~9g protein/100g (the 15-18g figure is DRY chana).
- ⚠️ PRE-PRODUCTIZATION: verify a few IFCT values against the official IFCT 2017 PDF before going public (well-sourced + USDA-cross-checked for the POC).

## 17. Trust & verification framework
5 layers: input verification, source grounding (foods DB w/ provenance now live), uncertainty surfacing (ranges in dashboard + chat), refusal-when-unsure, audit trail (api_usage_log). Anti-hallucination post-processor (Sprint 2.7) will enforce numbers-sourced/tone/absolutes. Confidence-card UX primitive (green/amber/gray dot) planned.

## 18. Privacy & security
- PII + health data in Supabase, encrypted at rest, behind auth ✅
- RLS on every table from day one ✅ (7 tables)
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
| Dev server | `npm run dev` (started by Claude Code; long-running; serves app at localhost). ⚠️ Editing .env.local auto-restarts it; requests fired during the restart window fail at connect (no log row). Supabase timestamps are UTC (+00); Mumbai = UTC+5:30. |

## 20. Project status
- ✅ Phase 1 — Problem refinement complete
- ✅ Phase 2 — Architecture complete
- 🚧 Phase 3 — Execution
  - ✅ Sprint 0 — Foundations COMPLETE
  - ✅ Sprint 1 — Profile + TDEE + Auth + Onboarding COMPLETE
  - 🚧 Sprint 2 — Chat + Meal logging IN PROGRESS
    - ✅ 2.1 adapter chat-ready (llmStream, R11 maxTokens fix, finishReason)
    - ✅ 2.2 conversations + messages tables (RLS)
    - ✅ 2.3 basic chat (streaming, personalized system prompt, react-markdown, honest about numbers, tested live)
    - ✅ 2.4 foods database (schema + 60 sourced foods + 16 portions)
    - 🚧 2.4b LLM hardening: ✅ api_usage_log table, ✅ pricing.ts, ✅ logApiUsage, ✅ 4a logging wired+proven-live, ✅ 4b-i retries+error-classification+failure-logging, ✅ 4b-ii failover; ⏳ NEXT = graceful degradation + failover unit test (4b-iv, reordered ahead of budget guard), then ⏳ budget guard (4b-iii)
    - ⏳ 2.5 meals tables + meal-understanding pipeline (the core; uses the foods DB)
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
| 2 — Chat + Meal Logging | 🚧 IN PROGRESS | Chat (done) + foods DB (done) + LLM hardening (in progress) + meal pipeline (next) |
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
| 9 | Vercel AI SDK v3 → v4 upgrade | Defer; v3 stable (note: v3 has no thinkingConfig + streamText has no onError) |
| 10 | Conversational chat onboarding | Deferred to v0.2; form stays as settings |
| 11 | Re-enable email confirmation + nicer auth (magic-link/Google OAuth) | Defer to v0.2 |
| 13 | Add Vercel production URL to Supabase redirect URLs (phone login) | Pending, non-blocking |
| 14 | **High-stakes model swap Haiku → Sonnet 4.6** | PENDING — one-liner; do before first high_stakes call |
| 15 | **Budget guard (4b-iii) + usage tracker UI (4b-iv.b)** | PENDING — guard reads api_usage_log (option A); tracker shows Gemini RPD + $ vs $4.51, amber/red |
| 16 | **Graceful degradation + failover unit test (4b-iv)** | NEXT |
| 17 | **Mid-stream streaming failure logging** | Deferred (needs route getErrorMessage) |
| 18 | **Verify IFCT food values vs official PDF** | Pre-productization |
| 19 | **Migrate off free Gemini to BAA provider** | Pre-productization HARD blocker (§18, R12) |
| 20 | **Multi-model 2-proposer/1-judge consensus** | Productization (§12a) |
| 21 | Verify current Gemini free-tier RPD (for the tracker) | When building tracker |

## 23. Risks register
| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Food DB estimates off >20% → user under-eats surplus | Medium | High | 3-value band + 2-week TDEE calibration |
| R2 | LLM hallucinates calorie number despite tools | Low | High | Anti-hallucination post-processor (2.7); tools mandatory; foods DB grounding |
| R3 | $4.51 Anthropic drained | Medium | Medium | Gemini default; cost tracking (live); budget guard (pending); failover uses cheap Haiku |
| R4 | User stops logging after week 2 | High | High | Chat-first logging; intra-day rewards; never shame |
| R5 | Katori size mismatch | High | Medium | Per-user calibration v0.2; band absorbs in MVP |
| R6 | Supabase free tier runs out post-launch | Low for MVP | High at scale | Clear migration path |
| R7 | Org policy on personal use of Enterprise Claude | Unknown | Medium | User to verify |
| R8 | Gemini Flash quality worse on Indian queries | Medium | Medium | High-stakes routing to Claude; measure on real queries |
| R9 | RAG corpus stale/contradictory | Medium | Medium | Tier 3 docs; weekly review |
| R10 | Undiagnosed health condition → wrong recommendations | Low | Very High | Red-flag screen; wellness disclaimer; full checkup reviewed (§3a) |
| R11 | Gemini thinking tokens silently truncate responses | Medium (mitigated) | High | maxTokens floor (done); $ tracking unaffected |
| R12 | **Free Gemini trains on health data** | **N/A for POC; CERTAIN at productization** | **High** | **POC: own data + minimize PII. Productization: HARD blocker — migrate to Vertex/Claude/OpenAI w/ BAA before 2nd user.** |
| R13 | **Mid-stream LLM failures not caught** (drop after first chunk) | Low | Low-Med | Deferred; graceful degradation + route getErrorMessage later |

## 24. How the user works with Claude (PM mode)
- User (Aditya) is a **non-coder**, guided step-by-step. Define unfamiliar terms briefly and simply (e.g. "RLS = a lock so each person only sees their own data"; "dev server = the program running your app locally").
- Claude acts as **program manager** + architect + engineer + thinking partner.
- **USER PROCESS REQUEST:** surface decisions that need his input (anything affecting goal, cost, data integrity, or hard-to-undo) clearly and definitively with stakes spelled out (🎯). Decide low-stakes/reversible/technical things himself and just mention them. Markers: ⚠️ RISK, 🎯 DECISION NEEDED, 🧠 ASSUMPTION/plain-English explanation.
- Claude summarizes at end of each session (changed / next / blocking). Flags real-money actions BEFORE proceeding.
- Claude owns step ordering, prerequisite verification, QA, security checks, and proactively re-shares/updates this brief.
- Claude reviews ALL Claude-Code-generated SQL/code before it touches DB/prod, especially RLS.
- Build rhythm: for changes to working code, "look before leap" — Claude Code investigates + proposes + shows diff; Claude.ai reviews; THEN apply. One inspectable change at a time. Prove behavior live where possible (e.g. logging proven via a real row in api_usage_log).
- Claude Code prompts: pick "Yes" (option 1), never "don't ask again"; stop on git commits/pushes, .env changes, anything outside ~/projects/bulq, or spending beyond tiny verified calls.

## 25. Where we are RIGHT NOW (for a fresh session)
- Sprint 2.4 DONE (foods DB live, 60 foods committed). Sprint 2.4b (LLM hardening) in progress.
- **Done & committed in 2.4b:** api_usage_log table; pricing.ts (+test); logApiUsage; usage logging wired into adapter (4a, proven live via a real row); retries + classifyLlmError + failure logging (4b-i, +test); provider failover (4b-ii, decoupled cheap failover model).
- **Immediate NEXT:** Pass 4b-iv = **graceful degradation** (calm "try again" message instead of silent failure / vanished message — reordered ahead of the budget guard because failures currently surface as confusing silence) + a **failover unit test** with a mocked failing provider (repeatable proof). THEN Pass 4b-iii = **budget guard** (query api_usage_log for Claude spend; stop at 95% of $4.51) + **usage tracker UI** (Gemini RPD + $ spent, amber/red). THEN Sprint 2.5 = the meal-understanding pipeline (the core feature — uses the foods DB).
- **Pending small items to not forget:** swap high_stakes model Haiku → Sonnet 4.6 (before first high_stakes use); verify current Gemini free-tier RPD + re-confirm Haiku/Sonnet pricing when building cost/tracker; add Vercel prod URL to Supabase redirects.
