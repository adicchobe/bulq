# Bulq — Project Brief

> Living document. Canonical context for Claude Code, future Claude.ai sessions, and any AI assistant working on this project. Updated at the end of each major decision point.
>
> **Last updated:** END of Sprint 4 — **COMPLETE (v10).** Teach-your-foods is LIVE (user-taught food entries + edit on meal card + alias dedup + matcher priority). Weight logging, trend analysis, TDEE recalibration (±200 kcal, 14-day cooldown, ±600 cap), and meal suggestions from the foods DB are all LIVE. **127 tests passing. NEXT = Sprint 5 (Polish + Daily Use).**

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

### Computed defaults (stored in DB profile; recalibrated from real weight trend via 4.3)
- **BMR (Mifflin-St Jeor):** 1540 kcal/day
- **TDEE (1.6× via 'moderate_plus' multiplier):** ~2464 kcal/day
- **Ectomorph-adjusted maintenance (+7%):** ~2636 kcal/day
- **Daily target (+300 kcal lean-gain surplus):** ~2936 kcal/day (range ~2736–3136, ±200 band)
- **Protein target (1.8 g/kg):** ~97 g/day
- **Realistic timeline 54 → 62 kg:** ~9–14 months at sustainable rates
- **Recalibration (4.3):** ±200 kcal per 2-week cycle based on actual vs expected weight trend. Capped at ±600, 14-day cooldown. Stored in `profiles.recalibration_adjustment_kcal`.

## 4. Behavioral pillars (non-negotiable)

1. **Never invent nutritional numbers.** Use database lookups or cite sources. If unknown, say "I don't know precisely" and show a range. (LIVE: 60 system foods + user-taught foods; meal pipeline NEVER lets LLM emit calories; chat uses only foods DB / day-state / available-foods list; anti-hallucination watches for slips.)
2. **Always surface uncertainty.** Show ranges, never false precision. (LIVE: compounded kcal bands + worst-item confidence on every meal.)
3. **Conservative estimates by default for planning.** Under-estimate rather than over. (LIVE: unknown = 0 kcal; bare "egg" = boiled not fried.)
4. **Every scientific claim has a citation or is marked as estimate.** ✅ **LIVE (Sprint 3):** RAG retrieval + source citations + `fabricated_source` WATCH check.
5. **Indian-first food knowledge.** Rotis, dals, sabzis, paneer, eggs, common Mumbai foods. User can teach any food.
6. **Respect the cooking situation.** Maid-prepared vs. self-prepared meals have different effort/timing.
7. **No diet shaming, no compliance shaming.** (LIVE: anti-hallucination 'shaming' check.)
8. **Single-tenant data, multi-tenant ready.** Every table has `user_id`; RLS enforced on all 12 tables.
9. **Symmetric caloric engine.** Surplus and deficit are the same math with opposite sign.
10. **LLM-provider-agnostic.** All AI calls through `/lib/ai/adapter`. Default = Gemini Flash (free). High-stakes = Claude Sonnet 4.6. Failover = Claude Haiku 4.5.

## 5. MVP scope (v0.1)

### In MVP (all LIVE)
1. ✅ Onboarding form
2. ✅ TDEE / calorie-target calculator with uncertainty band
3. ✅ Chat as primary surface — stateful, intra-day aware, streaming
4. ✅ Meal logging via NL → proposed meal card → Confirm/Dismiss → persist
5. ✅ Conservative food estimates — 60 foods with min/typical/max kcal
6. ✅ Intra-day running state (consumed/remaining as ranges, IST-windowed)
7. ✅ Real-time recommendations — grounded in remaining range
8. ✅ Meal suggestions from foods DB (4.4) — specific foods with real numbers
9. ✅ Manual weight logging (4.1) — dashboard widget
10. ✅ Weekly trend interpretation + 2-week TDEE recalibration (4.2, 4.3)
11. ✅ Indian-first food database — 60 foods curated & sourced
12. ✅ RAG knowledge base — 11 chunks, 5 topics, pgvector cosine retrieval
13. ✅ Source citations on every claim
14. ✅ Uncertainty disclosure on every estimate
15. ✅ Teach-your-foods — teach unknown foods + edit known ones; alias dedup; user foods prioritized

### NOT in MVP
Photo logging, training/exercise programming, native apps (PWA covers it), wearables, push notifications, recipe generation, bilingual, multi-user/social, payments, weight-loss-mode UI

## 6. Long-term vision
- v0.2 — Photo logging, wearable sync, notifications, weight-loss mode, Hindi/Marathi, conversational onboarding, magic-link/Google OAuth, migrate off free Gemini (HARD blocker), multi-model consensus, per-user portion calibration, PWA + prod cache strategy, anti-hallucination ENFORCE mode, expand RAG corpus
- v0.5 — Public beta, multi-user, subscription, doctor/RD read-only portal
- v1.0 — Multi-region (Indian diaspora first), verified-creator content layer
- v2.0+ — Biomarker integration, CGM reasoning, micronutrient targeting

## 7. Tech stack (all installed/working)

| Layer | Choice | Status |
|---|---|---|
| Framework | Next.js 14.2.35 (App Router) | ✅ |
| Language | TypeScript strict mode (no `any`) | ✅ |
| UI | Tailwind 3.4; react-markdown for chat | ✅ |
| Mobile | PWA via next-pwa | ⏳ Sprint 5 |
| Hosting | Vercel (auto-deploy on push) | ✅ |
| DB + Auth + Vector | Supabase (bulq-dev, Mumbai region) | ✅ 12 tables + RLS |
| Auth | Supabase email/password, confirmation OFF for POC | ✅ |
| Vector store | pgvector in Supabase | ✅ LIVE |
| LLM default | Gemini 2.5 Flash (free tier) | ✅ |
| LLM high-stakes | Claude Sonnet 4.6 ($3/$15) | ✅ (inert until needed) |
| LLM failover | Claude Haiku 4.5 ($1/$5) | ✅ live |
| Embeddings | Gemini gemini-embedding-001 (768d, normalized) | ✅ LIVE |
| Vercel AI SDK | ai 3.4.33 + @ai-sdk/google 0.0.55 + @ai-sdk/anthropic 0.0.50 | ✅ |
| Testing | Vitest — **127 tests passing** (17 files) | ✅ |
| Source control | GitHub (adicchobe/bulq), gh CLI | ✅ |
| Dev tooling | Claude Code CLI 2.1.x via Enterprise sub | ✅ |

⚠️ **SDK version pinning:** @ai-sdk/google 0.0.55 is old. ALWAYS check installed types/exports before writing code. text-embedding-004 is deprecated; gemini-embedding-001 works; providerOptions doesn't exist on ai@3.4.33's embed() — use model settings instead.

## 8. Authentication & credentials — strict separation

| Credential | What it's for | Cost |
|---|---|---|
| Enterprise Claude.ai subscription | Authenticates Claude Code during dev | Already paid |
| Anthropic API key (~$4.51 balance) | App's Claude failover/high-stakes calls | Burns $4.51 |
| Gemini API key (AI Studio, free tier) | App's default LLM + embeddings | Free |
| Supabase anon key | App DB access (RLS-gated) | Free tier |
| Supabase service role key | Server-side seeding scripts only — NEVER in app code | Free tier |

**Hard rules:** API keys in .env.local (gitignored) + Vercel encrypted env only. Service role key for scripts only, never app code. Budget guard: amber 70%, red 90%, hard-stop 95% of $4.51.

**Privacy:** POC free Gemini acceptable (own data). Productization HARD blocker: migrate to BAA provider before 2nd user (applies to chat + embeddings).

## 9. System architecture (four layers)

1. **Client:** Chat (meal cards + teach form) | Dashboard (targets + weight log + trend + recalibrate) | Onboarding/Login | Usage tracker
2. **Application:** API endpoints | Meal pipeline | Day-state | Weight logging + trends | Recalibration
3. **AI reasoning:** LLM adapter (hardened) | Anti-hallucination (WATCH, 5 checks) | RAG retrieval | Embeddings
4. **Data:** PostgreSQL (12 tables) | pgvector (knowledge_chunks + HNSW + RPC)

### Request flow (one chat message — current, LIVE)
User → POST /api/chat → auth → **intent gate** (classifyMealIntent, maxTokens:1024) →
- **meal_log:** assembleMeal → insertMeal('pending') → proposed meal card (teach/edit buttons) → Confirm/Dismiss
- **question:** 15-msg history + profile + targets + day-state + **RAG retrieval** (searchKnowledge, fail-safe) + **available foods** → buildChatSystemPrompt(profile, targets, today, nowIst, chunks, foods) → llmStream → onFinish: persist + log usage + **checkResponse (5 checks incl. fabricated_source)**

## 10. Files (key modules; Sprint 4 complete)

```
src/
  app/
    page.tsx                    ✅ dashboard + weight-log widget
    login/page.tsx              ✅ auth
    usage/page.tsx              ✅ usage tracker
    onboarding/                 ✅ profile form
    weight-log.tsx              ✅ (Sprint 4.1) client component: weight form + history + trend + recalibrate button
    actions/weight.ts           ✅ (Sprint 4) logWeight, getRecentWeights, recalibrateTargets server actions
    chat/
      page.tsx                  ✅ server guard
      chat-thread.tsx           ✅ useChat + meal-card rendering + voice input + teach handler
      meal-card.tsx             ✅ meal card + teach form + edit button on all items
      actions.ts                ✅ confirmMeal, rejectMeal, teachFood server actions
    api/chat/route.ts           ✅ intent gate → meal/question path; RAG + available foods in question path
  middleware.ts                 ✅ session refresh
  lib/
    db/
      profiles.ts               ✅ + recalibration columns
      chat.ts / usage.ts        ✅
      foods.ts                  ✅ + createUserFood, updateUserFood, addAliasToUserFood, 'user' source_type
      units.ts                  ✅
      meals.ts                  ✅ + updateMealItem, recomputeMealTotals
      weight-logs.ts            ✅ (Sprint 4.1) WeightLogRow, insertWeightLog, getWeightLogs, getLatestWeight
      response-flags.ts         ✅
    ai/
      adapter.ts                ✅ llmCall/llmStream (hardened)
      embed.ts                  ✅ embed() + normalizeVector + toPgVector (gemini-embedding-001, 768d)
      embed.test.ts             ✅ 5 tests
      system-prompt.ts          ✅ buildChatSystemPrompt(profile, targets, today, nowIst, chunks?, availableFoods?)
      anti-hallucination.ts     ✅ 5 checks: ungrounded_number, invented_time, false_logged, shaming, fabricated_source
      types.ts / pricing.ts / errors.ts / data-stream.ts / index.ts  ✅
    meals/                      ✅ parse → match → portion → assemble → intent → proposal → summary
      match.ts                  ✅ + user foods prioritized + similarity() exported
      intent.ts                 ✅ maxTokens:1024 (fixed from 8) + broadened few-shots
      (all other files unchanged)
    nutrition/
      tdee.ts                   ✅ + recalibration_adjustment_kcal wired into computeNutritionTargets
      trends.ts                 ✅ (Sprint 4.2) rollingAverage, weeklyRateOfChange, interpretTrend
      trends.test.ts            ✅ 13 tests
      recalibrate.ts            ✅ (Sprint 4.3) recalibrateTdee (pure, ±200/±600/14d cooldown)
      recalibrate.test.ts       ✅ 10 tests
    rag/
      search.ts                 ✅ searchKnowledge (cosine top-5 via match_knowledge_chunks RPC)
  types/speech-recognition.d.ts ✅
supabase/migrations/
    0001–0010                   ✅ all run
    0011_foods_source_type_user.sql  ✅ 'user' source_type for teach-your-foods
    0012_recalibration.sql      ✅ recalibration_adjustment_kcal + recalibrated_at
scripts/
    smoke-test-llm.ts           ✅
    ingest-knowledge.ts         ✅ 11 chunks, idempotent, service-role
.env.local                      ✅ 5 keys, gitignored
project_brief.md                ✅ THIS FILE (v10)
```

## 11. Coding principles for Claude Code
- TypeScript strict; no `any`. Server components by default. Zod on inputs. Every DB query typed in `/lib/db/` (import directly, not via barrel). Every LLM call through `/lib/ai/adapter`. Tailwind only.
- Tests (Vitest) on PURE logic; DB/LLM exercised live. **Code-correct ≠ behavior-correct for LLM prompts — always verify LIVE.**
- RLS on every table. Coerce Supabase numerics with Number().
- **Migration workflow:** Claude Code writes SQL → Claude.ai reviews (esp. RLS) → user runs in Supabase SQL Editor → verify → commit after run.
- **Build rhythm:** one inspectable change at a time. Investigate before changing existing code.
- ⚠️ Dev server in BACKGROUND or Claude Code hangs. Browser cache: hard-refresh after deploy.

## 12. AI architecture
- Three LLM jobs: parsing, reasoning, composition. Tool-using orchestrator (meal pipeline) LIVE.
- **RAG (Sprint 3):** embed query → cosine top-5 → inject chunks → model cites by source name → fabricated_source check.
- **Adapter:** hardened (retries, failover, budget guard, graceful degradation, usage logging).
- **Meal suggestions (4.4):** available foods injected into system prompt so model suggests specific foods with real DB numbers.
- ⚠️ Gemini thinking tokens: maxTokens floor 2048 (chat), 1024 (intent). R11.
- ⚠️ Meal-turn latency 7–10s (#32).

## 13. RAG architecture (Sprint 3 — COMPLETE & LIVE)
- **Corpus:** 11 chunks, 5 topics, 3 tiers. Own-words summaries, "Summarized from: [Source]". Sources: ICMR-NIN, Examine, PMC, WebMD/AND.
- **Embeddings:** gemini-embedding-001, 768d, normalized. Free tier.
- **Retrieval:** searchKnowledge(query, topK=5) → cosine via match_knowledge_chunks RPC.
- **Citation:** model cites by source name; fabricated_source WATCH check.
- **Honesty rules:** protein answers carry both Indian RDA + muscle-gain evidence. B12/D = inform + recommend testing, never prescribe.
- **SDK limitation:** taskType/title inert on @ai-sdk/google 0.0.55. Tied to SDK upgrade (#38).

## 14. Meal-understanding pipeline (COMPLETE & LIVE)
1. ✅ Parse → Match → Portion → Macros → Confidence → Propose → Confirm/Dismiss
2. ✅ **Teach-your-foods:** "Teach Bulq this food" (unknowns) / "Edit" (known items). Protein required, calories optional (estimated if blank). Creates/updates user food + alias dedup (≥0.82). Matcher prioritizes user foods. Edits update current meal item + recompute totals.

## 15. TDEE engine + recalibration
- BMR: Mifflin-St Jeor. Activity multipliers. Ectomorph +7%. Surplus/deficit.
- **Recalibration (4.3):** actual rate < 50% expected → +200 kcal; > 150% → -200. ±600 cap, 14-day cooldown. Stored in profiles.recalibration_adjustment_kcal, applied in computeNutritionTargets → all consumers inherit.

## 16. Data model (12 tables LIVE)

**Per-user RLS:** profiles (+ recalibration_adjustment_kcal, recalibrated_at), weight_logs, conversations, messages, api_usage_log, meals, meal_items, response_flags.
**Shared-reference RLS:** foods (+ 'user' source_type), units, knowledge_chunks.
**RPC:** match_knowledge_chunks.
**Migrations:** 0001–0012, all RUN.

### Foods DB: 60 system foods (IFCT 2017, USDA, INDB) + user-taught foods.
### Knowledge chunks: 11 chunks (ICMR-NIN, Examine, PMC). Own-words summaries, copyright-clean.

## 17. Trust & verification framework
7 layers: input verification, source grounding, uncertainty surfacing, refusal-when-unsure, audit trail, anti-hallucination WATCH (5 checks: ungrounded_number, invented_time, false_logged, shaming, fabricated_source), RAG-grounded citations.

## 18. Privacy & security
- PII + health data in Supabase, encrypted at rest, behind auth. RLS on all 12 tables. Data export/deletion first-class (cascade).
- ⚠️ Free Gemini trains on submissions (incl. embeddings) — HARD productization blocker.

## 20. Project status
- ✅ Sprint 0–1 — Foundations + Profile + TDEE
- ✅ Sprint 2 — Chat + Meal Logging (2.1–2.8)
- ✅ Sprint 3 — Knowledge + Citations (RAG, 3.1–3.6 + intent fix)
- ✅ **Sprint 4 — Trends + Plans + Teach-your-foods**
  - ✅ Teach-your-foods (migration 0011 + DB functions + teachFood action + meal card UI + matcher priority)
  - ✅ 4.1 Manual weight logging + dashboard widget
  - ✅ 4.2 Trend analysis (rolling average, rate of change, interpretation)
  - ✅ 4.3 TDEE recalibration (±200 kcal, ±600 cap, 14-day cooldown, migration 0012)
  - ✅ 4.4 Meal suggestions from foods DB in chat
- ⏳ **Sprint 5 — Polish + Daily Use**

## 21. Sprint structure
| Sprint | Status | Deliverable |
|---|---|---|
| 0 — Foundations | ✅ | Deployed app, DB, adapter |
| 1 — Profile + TDEE | ✅ | Auth + onboarding + TDEE |
| 2 — Chat + Meal Logging | ✅ | Full chat + meal pipeline + day-state + anti-hallucination + voice |
| 3 — Knowledge + Citations | ✅ | pgvector + embeddings + RAG + citations + fabricated_source guard |
| 4 — Trends + Plans | ✅ | Teach-your-foods + weight logging + trends + recalibration + meal suggestions |
| 5 — Polish + Daily Use | ⏳ NEXT | Mic icon, PWA, prod cache, perf, npm audit, URL rename |

## 22. Open backlog
| # | Item | Status |
|---|---|---|
| 25 | Dedicated chicken serving unit | PENDING |
| 26 | 'llm_inferred' food matching | Partially solved by teach-your-foods |
| 28 | Prod cache/version strategy | Sprint 5 |
| 29 | Fold 0007 aliases into 0004 seed | Sprint 5 |
| 30 | Anti-hallucination ENFORCE mode | Tune via response_flags |
| 31 | allowedNutritionNumbers tuning | Tune via response_flags |
| 32 | Meal-turn latency 7–10s | Sprint 5 |
| 34 | Western/junk-food coverage | Partially solved by teach-your-foods |
| 35 | Mic icon polish (replace emoji with proper icon) | Sprint 5 |
| 37 | Expand RAG corpus | Ongoing |
| 38 | SDK upgrade for embed taskType | Tied to AI SDK v4 |
| 39 | Stale meal-card totals after teach (cosmetic) | Deferred |
| 40 | Item-id plumbing for teach (same-named items edge case) | Deferred |

## 23. Risks register
| # | Risk | Mitigation |
|---|---|---|
| R1 | Food DB estimates off >20% | 3-value band + TDEE recalibration + teach-your-foods |
| R2 | LLM hallucinates number/time/source | Anti-hallucination WATCH (5 checks); LLM never emits meal numbers |
| R3 | $4.51 Anthropic drained | Gemini default; budget guard; Haiku failover |
| R5 | Katori size mismatch | Per-user calibration v0.2; band absorbs in MVP |
| R9 | RAG corpus stale | Small hand-verified corpus; idempotent re-ingest |
| R11 | Gemini thinking tokens truncate | maxTokens floor (2048 chat, 1024 intent) |
| R12 | Free Gemini trains on health data | HARD productization blocker |
| R16 | Stale browser cache | Hard-refresh for now; Sprint 5 prod cache strategy |
| R17 | RAG returns irrelevant chunks | Small focused corpus; fabricated_source WATCH |

## 24. How the user works with Claude (PM mode)
- Non-coder. Define terms simply. Short, crisp answers.
- 🎯 DECISION NEEDED for high-stakes. ⚠️ RISK. 🧠 ASSUMPTION.
- One inspectable change at a time. Claude Code prompts, not raw files.
- Verify LIVE before committing prompt changes.
- Claude tracks commit state, not the user.

## 25. Where we are RIGHT NOW (for a fresh session)
- **Sprint 4 COMPLETE, deployed.** 127 tests. Migrations 0001–0012 all run.
- **NEXT = Sprint 5 (Polish + Daily Use):** mic icon fix (#35), PWA, prod cache strategy, meal-turn latency, npm audit, URL rename.
- **Fast-follow backlog:** chicken serving unit (#25); expand RAG corpus (#37); anti-hallucination ENFORCE tuning (#30); allowedNutritionNumbers tuning (#31); stale meal-card totals after teach (#39); item-id plumbing (#40).
