# Bulq — Project Brief

> Living document. Canonical context for Claude Code, future Claude.ai sessions, and any AI assistant working on this project. Updated at the end of each major decision point.
>
> **Last updated:** END of Sprint 2 — **COMPLETE (v8).** The meal-understanding pipeline is now WIRED & LIVE end-to-end in chat (NL → parse → match → portion → conservative band → worst-item confidence → proposed meal card → Confirm/Dismiss → persist). Day-aware chat is LIVE with **honest, day-state-grounded numbers**, **real injected IST time**, and a **today-meal list grounded in the DB** (not chat history). Anti-fabrication guardrails shipped (calorie + time). Alias coverage fixed (migration 0007, run). **Anti-hallucination post-processor 2.7 is LIVE in WATCH mode** — it logs response violations to `response_flags`, no blocking. Everything deployed to prod. **95 tests passing. NEXT = Sprint 3 (RAG + citations).**

---

## 1. Identity

- **Name:** Bulq (working name, changeable)
- **Type:** AI-assisted nutritional reasoning partner for naturally skinny individuals
- **Primary user (POC):** Self-build by user (Aditya), age 26, Mumbai, India
- **GitHub:** github.com/adicchobe/bulq (private)
- **Live URL:** Vercel auto-generated (rename later). Production URL on the Vercel dashboard is the stable one to use. Project = `bulq-dev` (Supabase, single project behind both localhost and prod).
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

1. **Never invent nutritional numbers.** Use database lookups or cite sources. If unknown, say "I don't know precisely" and show a range. (LIVE: 60 foods carry source_type + source_ref; the meal pipeline NEVER lets the LLM emit calories; chat numbers come ONLY from the foods DB / day-state; the system prompt forbids the model stating its own calorie/protein/time figures; the anti-hallucination post-processor (2.7) watches for slips.)
2. **Always surface uncertainty.** Show ranges, never false precision. (LIVE: per-100g kcal band + portion band compounded into every meal item; worst-item confidence on every meal; consumed/remaining shown as ranges in chat.)
3. **Conservative estimates by default for planning.** Under-estimate calories rather than over. (LIVE: unknown foods contribute 0 to a meal total → conservative lower bound; bare "egg/eggs" maps to boiled (lower-cal) not fried.)
4. **Every scientific claim has a citation or is marked as estimate.** No bare assertions. (Citation enforcement lands with RAG in Sprint 3.)
5. **Indian-first food knowledge.** Rotis, dals, sabzis, paneer, eggs, common Mumbai foods. Western foods deferred.
6. **Respect the cooking situation.** Maid-prepared vs. self-prepared meals have different effort/timing.
7. **No diet shaming, no compliance shaming.** Never use weight-loss app language. (LIVE: the anti-hallucination 'shaming' check flags cheat-day/guilt-free/treat-yourself/etc.)
8. **Single-tenant data, multi-tenant ready.** Every user-data table has `user_id` from day one; RLS enforced. (LIVE: profiles, weight_logs, conversations, messages, api_usage_log, meals, meal_items, response_flags = per-user RLS; foods, units = shared-reference RLS — see §16.)
9. **Symmetric caloric engine.** Surplus and deficit are the same math with opposite sign. Pivot-ready.
10. **LLM-provider-agnostic.** All AI calls go through `/lib/ai/adapter`. **Default = Gemini 2.5 Flash (free).** High-stakes = Claude Sonnet 4.6. Failover = Claude Haiku 4.5.

## 5. MVP scope (v0.1)

### In MVP
1. Onboarding chat — (Sprint 1 shipped a pre-filled FORM; conversational onboarding deferred to v0.2. Form doubles as edit-profile/settings.) ✅ FORM BUILT
2. TDEE / calorie-target calculator — Mifflin-St Jeor + activity + ectomorph adj + surplus, with uncertainty band ✅ BUILT
3. Chat as primary surface — stateful, intra-day aware ✅ LIVE (streaming, personalized, honest, day-aware)
4. Real-time meal logging via natural language → parsed, confirmed, stored — ✅ **LIVE END-TO-END** (NL → proposed meal card with honest band + confidence → Confirm persists / Dismiss discards)
5. Conservative food estimates — each food has min/typical/max kcal ✅ DATA LIVE (60 foods) + applied in the meal pipeline
6. Intra-day running state — consumed today + remaining vs target ✅ **LIVE** (compute-on-the-fly via `getTodaySummary`, IST-windowed, confirmed meals only)
7. Real-time recommendations — "what should I do now" ✅ LIVE (qualitative, grounded in remaining range)
8. Weekly meal plan generator ⏳ Sprint 4
9. Manual weight logging ⏳ Sprint 4
10. Weekly trend interpretation + 2-week TDEE recalibration ⏳ Sprint 4
11. Indian-first food database — ✅ 60 foods curated & sourced + alias coverage hardened (0007)
12. RAG knowledge base — ICMR-NIN + curated PubMed/Examine ⏳ Sprint 3
13. Source citations on every claim ⏳ Sprint 3 (foods already carry provenance in DB)
14. Uncertainty disclosure on every estimate ✅ (dashboard + chat + meal pipeline all show ranges)

### NOT in MVP
Photo logging, training/exercise programming, native apps (PWA covers it), wearables, push notifications, recipe generation, bilingual, multi-user/social, payments, weight-loss-mode UI

## 6. Long-term vision
- v0.2 — Photo logging, wearable sync, notifications, weight-loss mode, Hindi/Marathi, conversational onboarding upgrade, magic-link/Google OAuth, re-enable email confirmation, **migrate off free Gemini to paid privacy-safe providers (HARD blocker, §18/§23)**, **multi-model 2-proposer/1-judge consensus for high-stakes (§12a)**, per-user portion calibration (R5), **PWA + a prod cache/version strategy so users get new deploys without manual hard-refresh (§22 #28)**, **anti-hallucination ENFORCE mode where the WATCH log shows real slips (e.g. the time check, §17)**
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
| DB + Auth + Storage + Vector | Supabase (project: bulq-dev, Mumbai region) | ✅ 10 tables + RLS + auth live |
| Auth | Supabase email/password, email confirmation OFF for POC | ✅ working |
| Vector store | pgvector inside Supabase | ⏳ Sprint 3 |
| LLM default | Gemini 2.5 Flash (`gemini-2.5-flash`), free tier | ✅ verified working |
| LLM high-stakes | Claude Sonnet 4.6 (`claude-sonnet-4-6`) | ✅ swap done & verified; still inert in the running app (chat = Gemini) until a real high_stakes caller exists |
| LLM failover | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) — CLAUDE_FAILOVER_MODEL, decoupled from high-stakes primary | ✅ live |
| Embeddings | Gemini text-embedding-004 (768 dim) | ⏳ Sprint 3 |
| Vercel AI SDK | `ai` 3.4.33 + `@ai-sdk/google` 0.0.55 + `@ai-sdk/anthropic` 0.0.50 (+ `@ai-sdk/react` / ui-utils for useChat) | ✅ |
| Testing | Vitest — **95 tests passing** (tdee 16, pricing 6, errors 5, adapter 6, data-stream 1, meal-totals 3, parse 6, match 5, portion 10, assemble 8, intent 4, proposal 2, summary 6 + today-meal-list assertion, **anti-hallucination 15**) | ✅ all passing |
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

**Model decisions (May 2026):**
- **High-stakes = Claude Sonnet 4.6** ($3/$15 per M tokens). Reasoning tier for trend interpretation, contradiction resolution, recalibration. No running-app caller uses high_stakes yet (chat = Gemini); Sonnet money starts when trends add real high_stakes calls; budget guard caps it.
- **Failover = Claude Haiku 4.5** ($1/$5) — a SEPARATE constant from the high-stakes primary.
- **Pricing verified May 2026:** Haiku $1/$5, Sonnet $3/$15, Gemini $0. Stored in `src/lib/ai/pricing.ts`.
- **Budget guard thresholds:** amber 70%, red 90%, hard-stop-Claude 95% of $4.51. Guard ACTS only at hard-stop; amber/red are display-only.

**Privacy decision (POC vs productization):**
- **POC: free Gemini is acceptable** — builder's OWN data, single-user, wellness-not-clinical. Mitigation: minimize PII in prompts.
- ⚠️ **Productization: HARD blocker.** Free Gemini tier TRAINS on submissions, has human reviewers, bans clinical use. Before a 2nd user's data flows, MUST migrate to a privacy-safe provider with a data-protection agreement: paid Gemini via Vertex AI (BAA), Claude API (BAA), or OpenAI API (BAA + ZDR). See §23 R12.

**App auth model:** Supabase email/password, confirmation OFF for POC. RLS scoped to `authenticated`. ⚠️ Vercel production URL still to be added to Supabase redirect URLs for phone login (non-blocking, §22 #13).

## 9. System architecture (four layers)

1. **Client (PWA):** Chat (with meal cards) | Dashboard | Onboarding/Login | Usage tracker
2. **Application & API (Next.js routes):** API endpoints | Meal pipeline (`/lib/meals`) | Orchestrator/chat-wiring (LIVE) | Day-state (`getTodaySummary`) | Domain services
3. **AI reasoning:** LLM adapter (Gemini default, Claude high-stakes/failover; fully hardened) | Anti-hallucination post-processor (WATCH) | RAG layer (Sprint 3) | meal pipeline tools
4. **Data & knowledge:** PostgreSQL (10 tables live) | pgvector (Sprint 3)

### Request flow (one chat message — current, LIVE)
User → PWA → POST /api/chat → auth → **intent gate** (`classifyMealIntent` → meal_log vs question; fail-safe → question) →
- **meal_log path:** `assembleMeal` (parse→match→portion→confidence) → `insertMeal('pending')` → `buildProposal` → render proposed meal card (items, conservative kcal band, confidence dots) → user Confirms (`setMealStatus` pending→confirmed, returns boolean) or Dismisses.
- **question path:** load 15-msg history + profile + targets + **day-state** (`getTodaySummary`: consumed/remaining as ranges, today's confirmed meal list, real IST time via `istNowLabel`) → `buildChatSystemPrompt(profile, targets, today, nowIst)` → `llmStream` (retries + failover + budget guard + usage logging) → `toDataStreamResponse()` (graceful fallback on total failure) → **onFinish** persists assistant msg + logs usage + **runs `checkResponse` (anti-hallucination) → logs to `response_flags` if violations (fail-safe, never affects the reply)**.

## 10. Files (key modules; Sprint 2 complete)

```
src/
  app/
    page.tsx                    ✅ protected dashboard (target card) + "Usage" link
    login/page.tsx              ✅ email/password sign-in + sign-up
    usage/page.tsx              ✅ usage tracker (Anthropic $ vs $4.51, Gemini calls, lifetime calls/failures/failovers)
    onboarding/                 ✅ server guard + pre-filled form + Zod server action
    chat/
      page.tsx                  ✅ server guard
      chat-thread.tsx           ✅ useChat UI; react-markdown; renders meal-card from message annotations
      meal-card.tsx             ✅ PROPOSED MEAL card (per-item name/qty/grams/kcal-band/confidence dot; total band + protein + confidence; honest note; Confirm/Dismiss → "✓ Logged"/"Dismissed")
      actions.ts                ✅ confirmMeal/rejectMeal server actions (return { ok: updated } — truthful confirm)
    api/chat/route.ts           ✅ intent gate → meal_log path / question path; onFinish persists + logs usage + runs anti-hallucination checkResponse → response_flags
  middleware.ts                 ✅ session refresh
  lib/
    db/
      profiles.ts / chat.ts / usage.ts                 ✅
      foods.ts                  ✅ FoodRow + getMatchableFoods
      units.ts                  ✅ UnitRow + getUnits
      meals.ts                  ✅ MealInput/MealItemInput/MealRow/...; computeMealTotals; insertMeal (THROWS); getMealById; setMealStatus (returns boolean — rows matched); getConfirmedMealsForDay
      response-flags.ts         ✅ logResponseFlags (FAIL-SAFE, mirrors logApiUsage) — writes anti-hallucination violations (Sprint 2.7)
    ai/
      adapter.ts                ✅ llmCall/llmStream — hardened (retries, failover, budget guard, usage logging, graceful degradation)
      types.ts / pricing.ts / errors.ts / data-stream.ts  ✅
      system-prompt.ts          ✅ buildChatSystemPrompt(profile, targets, today, nowIst) — injects real IST time + today's meal list; STRICT anti-fabrication rules (use ONLY provided numbers; quote "Today so far"; never invent calories/time; report ONLY day-state meals not chat history)
      anti-hallucination.ts     ✅ checkResponse(text, facts) PURE → { violations } — 4 checks: ungrounded_number / invented_time / false_logged / shaming (Sprint 2.7, WATCH)
      index.ts                  ✅ barrel
    meals/                      ✅ MEAL PIPELINE — LIVE END-TO-END
      types.ts                  ✅ ParsedItem/ParsedMeal/ParseResult + Zod
      parse.ts                  ✅ parseMealText (Gemini, numbers-FREE, Zod) + pure extractParsedMeal
      match.ts                  ✅ matchFood (exact→alias→fuzzy≥0.82→unknown; prefers unknown over shaky)
      portion.ts                ✅ pickUnitKey/resolveGrams (per-unit grams, qty-once) + computeItemMacros (compounded band) + buildMealItem
      assemble.ts               ✅ computeItemConfidence/worstConfidence + assembleMeal → proposed MealInput (no persist)
      intent.ts                 ✅ classifyMealIntent (Gemini, operation:'intent_detect') + pure extractIntent (fail-safe → 'question')
      proposal.ts               ✅ MealProposal + buildProposal (items + total kcal band + total protein + confidence)
      summary.ts                ✅ istDayRangeUtc + istNowLabel + TodaySummary (consumed/target/remaining/meals[]/mealCount) + computeTodaySummary + getTodaySummary
      index.ts                  ✅ barrel
    nutrition/                  ✅ TDEE engine, 16 tests
    rag/index.ts                (empty — Sprint 3)
supabase/migrations/
    0001 … 0006                 ✅ profiles/weight_logs, conversations/messages, foods/units (+ seed 60 foods/16 units), api_usage_log, meals/meal_items
    0007_alias_fixes.sql        ✅ alias coverage: egg/eggs/anda/ande/boiled eggs→Boiled egg; rice→Cooked white rice; chana→Boiled kala chana; chapati explicit; (anda re-pointed off raw egg). RUN in Supabase + verified.
    0008_response_flags.sql     ✅ response_flags table (per-user RLS) for anti-hallucination WATCH log. RUN in Supabase + verified (first real flag captured live).
scripts/smoke-test-llm.ts       ✅
.env.local                      ✅ 4 keys, gitignored
project_brief.md                ✅ THIS FILE (v8)
```

## 11. Coding principles for Claude Code
- TypeScript strict; **no `any`**. Server components by default. Zod on inputs. Every DB query a typed function in `/lib/db/` (server-only modules imported directly, not via barrel). Every LLM call through `/lib/ai/adapter`. Tailwind only.
- Tests (Vitest) on PURE logic; DB/LLM exercised live. **Code-correct ≠ behavior-correct for LLM prompts — always verify LIVE before committing** (proven repeatedly: a fabrication bug passed tsc + tests but only showed in live chat).
- RLS on every table from day one (per-user for user data; shared-reference for foods/units). Coerce Supabase numerics with Number().
- **Migration workflow:** Claude Code writes SQL → Claude.ai REVIEWS (esp. RLS) → user pastes into Supabase SQL Editor + Run → verify (⚠️ Table Editor CACHES — refresh or `select count(*)`) → commit the migration file AFTER it's run.
- **Build rhythm:** changes to working code → investigate→propose→show diff→review→apply. New additive modules → build→show→review. One inspectable change at a time. Prove behavior live where possible.
- ⚠️ **Dev server must run in the BACKGROUND** (non-blocking) — foreground `npm run dev` makes Claude Code HANG forever (token usage goes flat; press Esc to interrupt, edits persist).
- ⚠️ **Browser cache:** after a deploy/code change the browser serves STALE JS until a hard refresh (Cmd+Shift+R) or incognito. "Vercel Ready" = server updated; hard refresh = browser actually loads it. Test in incognito on the exact URL.

## 12. AI architecture key points
- **Three LLM jobs** prompted separately: parsing (NL→structured), reasoning (state→decision), composition (draft).
- **Tool-using orchestrator (LIVE):** meal pipeline (`/lib/meals`) is the parse/match/compute engine; the chat route wires it (intent detect → assembleMeal → proposal card → confirm → persist).
- **Adapter pattern** via Vercel AI SDK — FULLY HARDENED: retries (maxRetries 2), error classification, provider failover (transient initial-connect only, userId-gated, decoupled Haiku failover), graceful degradation (calm fallback reply, not persisted), budget guard (gates both Claude points at hard-stop), usage logging (fail-safe, awaited), cost computation (Gemini $0; unpriced → rateKnown:false).
- ⚠️ KNOWN GAP (R13): mid-stream failures (drop after first chunk) not caught/logged — deferred.
- ⚠️ **Gemini thinking-token issue (R11):** DEFAULT_MAX_TOKENS=2048 floor fixes truncation; api_usage_log undercounts Gemini TOKEN volume but Gemini=$0 so the $ figure is accurate.
- ⚠️ **Meal-turn latency 7–10s** (#32): 2 sequential Gemini calls (intent_detect → meal_parse) + Gemini thinking overhead. Fix paths: tool-using orchestrator (1 call), thinking-control (AI SDK v4), faster classify, or a loading-state UX.

## 12a. Multi-model consensus (DEFERRED to productization — research done)
- NARROW 2-proposer + 1-judge ensemble for HIGH-STAKES steps only. Key findings: DB-grounding > ensembling; correlated errors mean consensus ≠ verification; judge must compare NUMBERS + be allowed to ABSTAIN.
- **Privacy-DISQUALIFYING for health data:** DeepSeek hosted, Alibaba-hosted Qwen, free Gemini AI Studio. Privacy-safe set = paid Gemini via Vertex (BAA), Claude (BAA), OpenAI (BAA+ZDR). **DECISION:** defer to productization (needs PAID providers; tied to the §18 migration).

## 13. RAG architecture key points (Sprint 3)
- Tiers: Tier 1 ICMR-NIN primary; Tier 2 curated PubMed/Examine; Tier 3 Bulq-authored opinion docs (cited).
- Chunking ~300–500 tokens, 50 overlap. Embeddings text-embedding-004 (768d). Retrieval: cosine in pgvector, top-5, optional topic pre-filter, rerank by recency + evidence_grade.
- Citation enforcement: LLM emits [CITE:chunk_id] placeholders; orchestrator resolves to real source titles + links. (Pillar #4 citation enforcement lands here.)

## 14. Meal-understanding pipeline (Sprint 2.5 — COMPLETE & LIVE)
1. ✅ Parse — `parseMealText` (Gemini, numbers-FREE prompt + Indian few-shots, Zod-validated; never throws).
2. ✅ Match — `matchFood` (exact → alias → fuzzy Levenshtein ≥0.82 → unknown; prefers unknown over shaky). Alias coverage hardened (0007): bare egg/eggs/anda/ande→boiled egg, rice→cooked rice, chana→boiled kala chana, chapati explicit. ('llm_inferred' for foods outside the 60 still deferred — #26.)
3. ✅ Portion — `resolveGrams`+`pickUnitKey` (per-unit grams, fallback {null,100g,50–200}). Design A: quantity applied EXACTLY ONCE.
4. ✅ Macros — `computeItemMacros`: kcal band = food per-100g kcal band × portion gram band × qty/100 (compounded). variance_class is confidence-only, never a kcal multiplier.
5. ✅ Confidence — `computeItemConfidence` (min of match+variance+portion) + `worstConfidence` (meal = weakest item).
6. ✅ **Wired into chat (LIVE):** intent gate → `assembleMeal` → `insertMeal('pending')` → proposed meal card (items, conservative band, confidence dots) → Confirm (`setMealStatus` pending→confirmed, returns boolean → "✓ Logged" only on a real write) or Dismiss. Verified live in prod (egg estimates correctly at ~50g/egg via egg_large; "2 eggs + glass of milk" ≈ 215–408 kcal / ~19g, high confidence).

## 15. TDEE engine (Sprint 1 — BUILT)
- BMR: Mifflin-St Jeor. Activity multipliers sedentary 1.2 … very_active 1.9 (moderate_plus 1.6). Ectomorph +5–10% (default 7) for gain only. Surplus default 300 (250–400) gain; 400 (300–500) deficit. deltaKcal & proteinPerKg DERIVED from goal_direction.
- 2-week recalibration (Sprint 4): actual change <50% expected → +200 kcal/day; >150% → −200. 7-day rolling average.

## 16. Data model (10 tables LIVE)

**LIVE (10):**
- profiles, weight_logs — per-user RLS
- conversations, messages (messages.user_id denormalized) — per-user RLS
- foods, units — SHARED-REFERENCE RLS (user_id NULL = system row readable by all authenticated; non-null = user's custom; split SELECT vs INSERT/UPDATE/DELETE policies)
- api_usage_log — per-user RLS
- meals, meal_items (meal_items.user_id denormalized; food_id ON DELETE SET NULL; meals.status DEFAULT 'pending') — per-user RLS
- **response_flags** (Sprint 2.7) — per-user RLS. Columns: id, user_id, conversation_id (nullable, ON DELETE SET NULL), created_at, path (question/meal_log), response_excerpt, violations jsonb, allowed_facts jsonb. Single owner-only policy `for all to authenticated`.

**NOT created (by decision):** `daily_summaries` — 2.6 intra-day state uses **compute-on-the-fly** (`getTodaySummary`) instead; a materialized table is a scale optimization deferred.
**REMAINING (planned):** meal_plans (Sprint 4), knowledge_chunks/pgvector (Sprint 3), feedback_events (corrections feedback loop).

**Migrations:** 0001–0006 (base) + 0007_alias_fixes + 0008_response_flags. ⚠️ 0007's aliases are UPDATEs on top of the 0004 seed — if 0004 is ever re-run (delete+reinsert), 0007 must be re-applied (or fold the aliases into 0004's seed values during a migration tidy-up — §22 #29).

### Foods DB provenance (sourced, not invented)
- 60 foods. Sources: IFCT 2017 (ICMR-NIN) raw ingredients; USDA FoodData Central cooked items + gaps; INDB (Vijayakumar et al. 2024, DOI 10.1016/j.cdnut.2024.103790) composites; ICMR "My Plate" portions.
- Key corrected assumptions: cooked chicken breast 31g protein/100g; boiled kala chana ~9g protein/100g (15–18g is DRY).
- ⚠️ PRE-PRODUCTIZATION: verify a few IFCT values vs the official IFCT 2017 PDF (#18).

## 17. Trust & verification framework
6 layers: (1) input verification, (2) source grounding (foods DB w/ provenance), (3) uncertainty surfacing (ranges + worst-item confidence), (4) refusal-when-unsure (matcher prefers unknown; LLM never emits numbers), (5) audit trail (api_usage_log), (6) **anti-hallucination post-processor (2.7, WATCH) — `checkResponse` flags ungrounded numbers / invented time / false "logged" claims / shaming to `response_flags`.**
- **WATCH vs ENFORCE:** currently WATCH (logs, no blocking — keeps streaming, zero UX cost). Escalate a check to ENFORCE (buffer + replace before the user sees it) IF the log shows real, recurring slips. ⚠️ **Day-one signal: the net already caught an `invented_time` slip** ("1:40 am" stated when it was 1:21 pm IST) — the model occasionally ignores the injected time despite the prompt. Tune the time rule and/or escalate the time check to ENFORCE (§22 #30).
- Confidence-card UX primitive (green/amber/gray dot) LIVE on meal cards.

## 18. Privacy & security
- PII + health data in Supabase, encrypted at rest, behind auth ✅. RLS on every table ✅ (10 tables). Data export/deletion first-class (on delete cascade). No biometric data beyond weight. Wellness/lifestyle positioning. API keys in .env.local + Vercel encrypted env only.
- ⚠️ **Free Gemini trains on submissions** (POC-acceptable for builder's own data; HARD productization blocker — migrate to BAA provider before a 2nd user; §8, §23 R12).

## 19. Development environment
| Item | Value |
|---|---|
| OS | macOS · Homebrew · Node v20+ |
| Git | gh CLI authed (adicchobe), HTTPS |
| Editor | VS Code |
| AI dev tool | Claude Code CLI 2.1.x via Enterprise sub |
| Repo | ~/projects/bulq |
| Dev server | `npm run dev` — ⚠️ start in BACKGROUND or Claude Code hangs. Editing .env.local auto-restarts it. Supabase timestamps UTC; Mumbai = UTC+5:30 (IST day boundary = 18:30 UTC). |

## 20. Project status
- ✅ Phase 1 — Problem refinement · ✅ Phase 2 — Architecture · 🚧 Phase 3 — Execution
  - ✅ Sprint 0 — Foundations
  - ✅ Sprint 1 — Profile + TDEE + Auth + Onboarding
  - ✅ **Sprint 2 — Chat + Meal Logging — COMPLETE**
    - ✅ 2.1 adapter chat-ready · ✅ 2.2 conversations+messages · ✅ 2.3 basic chat · ✅ 2.4 foods DB · ✅ 2.4b LLM hardening
    - ✅ 2.5 meal pipeline — engine + WIRED LIVE (parse→match→portion→confidence→propose→confirm)
    - ✅ 2.6 intra-day state — consumed-today read + day-aware chat (honest numbers, real IST time, meal-list grounded in day-state) + anti-fabrication fixes (Fix A truthful confirm, Fix B no-estimation prompt, time injection, list grounding)
    - ✅ 2.7 anti-hallucination post-processor — WATCH mode (checkResponse + response_flags + onFinish wiring)
  - ⏳ Sprint 3 — Knowledge + Citations (RAG)
  - ⏳ Sprint 4 — Trends + Plans
  - ⏳ Sprint 5 — Polish + Daily use (PWA, prod cache strategy, perf, npm audit, URL rename)

## 21. Sprint structure
| Sprint | Status | Deliverable |
|---|---|---|
| 0 — Foundations | ✅ DONE | Deployed app, DB, adapter verified |
| 1 — Profile + TDEE | ✅ DONE | Auth + tables + onboarding + TDEE |
| 2 — Chat + Meal Logging | ✅ **DONE** | Chat + foods DB + hardened adapter + meal pipeline LIVE + day-aware honest chat + real IST time + alias coverage + anti-hallucination WATCH |
| 3 — Knowledge + Citations | ⏳ NEXT | RAG pipeline (pgvector, embeddings), sources on claims, [CITE] resolution |
| 4 — Trends + Plans | ⏳ | Weight logging, trend interpretation, 2-week recalibration, meal plan generator |
| 5 — Polish + Daily Use | ⏳ | PWA + prod cache/version strategy, perf (meal-turn latency), npm audit, URL rename |

## 22. Open decisions / carried-forward items
| # | Item | Status |
|---|---|---|
| 2 | Whey timing/type experiment (isolate vs concentrate, earlier in day) | Flagged for feedback loop |
| 3 | Gemini thinking-budget / api_usage_log token undercount | maxTokens floor done; full fix needs AI SDK v4 (deferred) |
| 4 | Top up Anthropic balance beyond $4.51 | Defer until real usage data |
| 5 | Sentry adoption | Defer to first 5 users |
| 6 | Vercel URL rename + domain/branding | Defer to v0.2 |
| 7 | Org policy on Enterprise Claude for personal project | User's responsibility |
| 8 | npm audit | Defer to Sprint 5 |
| 9 | Vercel AI SDK v3 → v4 upgrade | Defer; v3 stable |
| 10 | Conversational chat onboarding | v0.2 (form stays as settings) |
| 11 | Re-enable email confirmation + magic-link/Google OAuth | v0.2 |
| 13 | Add Vercel prod URL to Supabase redirect URLs (phone login) | Pending, non-blocking |
| 17 | Mid-stream streaming failure logging (R13) | Deferred (needs route getErrorMessage) |
| 18 | Verify IFCT food values vs official PDF | Pre-productization |
| 19 | Migrate off free Gemini to BAA provider | Pre-productization HARD blocker (§18, R12) |
| 20 | Multi-model 2-proposer/1-judge consensus | Productization (§12a) |
| 21 | Verify current Gemini free-tier RPD (tracker uses adjustable ~250) | When refining tracker |
| 25 | **Dedicated chicken serving unit** — chicken logged weekly, currently hits the wide 100g fallback (egg now resolves correctly to egg_large) | PENDING (fast-follow) |
| 26 | **'llm_inferred' food matching** — foods outside the 60 → currently 'unknown' | PENDING (fast-follow) |
| 27 | Per-user portion calibration (R5) — "your katori is 130g" → narrows bands | v0.2 |
| 28 | **Prod cache/version strategy** — users see stale builds until hard-refresh; need a service-worker update prompt | Sprint 5 / PWA |
| 29 | **Fold 0007 aliases into the 0004 seed** so a re-seed doesn't wipe them | Migration tidy-up (Sprint 5 / pre-prod) |
| 30 | **Anti-hallucination ENFORCE mode** — WATCH already flagged a real invented_time slip; tune the time prompt rule and/or escalate the time check from WATCH to ENFORCE (buffer+replace) | NEXT tuning item, informed by response_flags |
| 31 | **`allowedNutritionNumbers` tuning** — currently includes target range + maintenance + BMR to avoid log floods; narrow to exactly-what-the-prompt-states if the log shows it matters | Tune via response_flags |
| 32 | **Meal-turn latency 7–10s** (2 sequential Gemini calls) | Track; fix via tool-orchestrator / AI SDK v4 / loading UX |

## 23. Risks register
| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Food DB estimates off >20% → user under-eats surplus | Medium | High | 3-value band + 2-week TDEE calibration |
| R2 | LLM hallucinates a number/time/log-claim despite tools | Low | High | LLM never emits meal numbers; numbers only from DB/day-state; strict prompt rules; **anti-hallucination post-processor (WATCH; escalate to ENFORCE where the log warrants)** |
| R3 | $4.51 Anthropic drained | Medium | Medium | Gemini default; cost tracking + budget guard; cheap Haiku failover |
| R4 | User stops logging after week 2 | High | High | Chat-first logging; intra-day "here's your day" reward; never shame |
| R5 | Katori size mismatch | High | Medium | Per-user calibration v0.2; band absorbs in MVP |
| R6 | Supabase free tier runs out post-launch | Low for MVP | High at scale | Clear migration path |
| R7 | Org policy on personal use of Enterprise Claude | Unknown | Medium | User to verify |
| R8 | Gemini Flash quality worse on Indian queries | Medium | Medium | High-stakes routing to Claude; measure on real queries |
| R9 | RAG corpus stale/contradictory | Medium | Medium | Tier 3 docs; weekly review |
| R10 | Undiagnosed health condition → wrong recommendations | Low | Very High | Red-flag screen; wellness disclaimer; full checkup reviewed (§3a) |
| R11 | Gemini thinking tokens silently truncate responses | Medium (mitigated) | High | maxTokens floor; $ tracking unaffected |
| R12 | Free Gemini trains on health data | N/A POC; CERTAIN at productization | High | POC: own data + minimize PII. Productization: HARD blocker — migrate to BAA provider before 2nd user |
| R13 | Mid-stream LLM failures not caught | Low | Low-Med | Deferred; graceful degradation covers initial/both-fail |
| R14 | Wrong fuzzy food match → wrong calories | Low-Med | High | Conservative threshold 0.82; prefers 'unknown'; confirm card lets user correct |
| R15 | Meal portion fallback too wide | Medium | Medium | Honest wide band + low confidence; chicken unit (#25) + per-user calibration (R5) tighten common cases |
| R16 | **Stale browser cache → users see old build after deploy** | Medium | Medium | Hard-refresh/incognito for now; prod cache/version strategy in Sprint 5 (#28) |

## 24. How the user works with Claude (PM mode)
- User (Aditya) is a **non-coder**, guided step-by-step. Define unfamiliar terms briefly and simply.
- **CONCISE answers — do not overcomplicate.** Focus on a bug-free best solution aligned with the goal; don't forget backlog.
- Claude acts as **program manager** + architect + engineer + thinking partner.
- **USER PROCESS REQUEST:** surface decisions needing his input (anything affecting goal, cost, data integrity, hard-to-undo) with stakes spelled out (🎯); decide low-stakes/reversible/technical things and just mention them. Markers: ⚠️ RISK, 🎯 DECISION NEEDED, 🧠 ASSUMPTION/plain-English.
- Claude summarizes at session ends (changed/next/blocking). Flags real-money actions BEFORE proceeding. Reviews ALL Claude-Code SQL/code before it touches DB/prod, esp. RLS.
- **Verify behavior LIVE before committing** (prompt changes especially). Build rhythm: one inspectable change at a time.
- Claude Code prompts: pick "Yes" (option 1), never "don't ask again"; stop on git commits/pushes, .env changes, anything outside ~/projects/bulq, or real spend.
- **Brief update workflow:** Claude produces the brief file → user downloads → drag-replaces in repo + VS Code → Claude Code commits → user re-uploads to the Claude.ai Project (delete old, upload new).

## 25. Where we are RIGHT NOW (for a fresh session)
- **Sprint 2 is COMPLETE and deployed to prod.** What's live: streaming personalized chat; the full meal pipeline wired into chat (NL → proposed meal card → Confirm/Dismiss → persist); day-aware chat with honest day-state-grounded numbers (consumed/remaining as ranges), the real injected IST time, and today's meal list grounded in the DB; anti-fabrication guardrails; alias coverage (0007); and the anti-hallucination post-processor (2.7) in WATCH mode logging violations to `response_flags`.
- **95 tests passing. tsc clean. All commits pushed; Vercel deployed.** Migrations 0007 + 0008 are RUN in Supabase.
- **Day-one signal from the watch-net:** it already caught a real `invented_time` slip — the model sometimes ignores the injected time. Tune the time rule / consider ENFORCE for the time check (#30).
- **IMMEDIATE NEXT = Sprint 3 (RAG + Citations):** pgvector + embeddings (text-embedding-004), knowledge_chunks table, chunk/embed ICMR-NIN + curated sources, retrieval (cosine top-5), and [CITE:chunk_id] resolution so every scientific claim carries a source (pillar #4). Plan before building.
- **Fast-follow backlog (don't forget):** chicken serving unit (#25); 'llm_inferred' matching (#26); anti-hallucination time-rule tune / ENFORCE (#30); allowedNutritionNumbers tuning (#31); fold 0007 into 0004 seed (#29); prod cache strategy (#28); Vercel prod URL → Supabase redirects (#13); meal-turn latency (#32).
