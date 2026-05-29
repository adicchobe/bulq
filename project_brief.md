# Bulq — Project Brief

> Living document. Canonical context for Claude Code, future Claude.ai sessions, and any AI assistant working on this project. Updated at the end of each major decision point.
>
> **Last updated:** End of Phase 3 — Sprint 1 COMPLETE (v5). App live; user has real auth, saved profile, profile-driven dashboard.

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
| Current weight | 54 kg (BMI 16.7 — underweight per WHO) |
| Target weight | 62–65 kg (form default stored as 63) |
| Diet | Vegetarian primary; egg daily acceptable; chicken 1–2× per week max |
| Training | 5×/week consistent baseline; partial-equipment gym now, fully equipped gym soon; ~45 min sessions |
| Cooking situation | Maid cooks main meals; user self-preps supplements (boiled eggs, milk, chana, chia) |
| Sleep | 8 hours average — excellent foundation |
| Digestion | No general issues; mild discomfort with night-time whey protein shakes (suspected lactose sensitivity in concentrate) |
| Health checkup | Full body checkup done — report to be shared/reviewed for any flags affecting nutrition targets |
| Cultural context | Indian home cooking + Mumbai food access |
| Goal direction | Sustainable lean weight gain at 0.25–0.4% body weight per week |
| Tech comfort | Minimal coding — guided step-by-step; builds via Claude Code |
| Hosting budget | Strictly free tiers only for POC |

### Computed defaults (now stored in DB profile; recalibrate from real weight trend)
- **BMR (Mifflin-St Jeor):** 1540 kcal/day
- **TDEE (1.6× via 'moderate_plus' multiplier):** ~2464 kcal/day
- **Ectomorph-adjusted maintenance (+7%):** ~2636 kcal/day
- **Daily target (+300 kcal lean-gain surplus):** ~2936 kcal/day (range ~2736–3136, ±200 band)
- **Protein target (1.8 g/kg):** ~97 g/day
- **Realistic timeline 54 → 62 kg:** ~9–14 months at sustainable rates

## 4. Behavioral pillars (non-negotiable)

1. **Never invent nutritional numbers.** Use database lookups or cite sources. If unknown, say "I don't know precisely" and show a range.
2. **Always surface uncertainty.** Show ranges, never false precision. *"~280–340 kcal"*, never *"312 kcal"* for an estimate.
3. **Conservative estimates by default for planning.** Under-estimate calories rather than over, so user doesn't fall short of surplus target.
4. **Every scientific claim has a citation or is marked as estimate.** No bare assertions.
5. **Indian-first food knowledge.** Rotis, dals, sabzis, paneer, eggs, common Mumbai foods. Western foods deferred.
6. **Respect the cooking situation.** Maid-prepared vs. self-prepared meals have different effort/timing.
7. **No diet shaming, no compliance shaming.** Never use weight-loss app language ("guilt-free", "cheat day", "treat yourself").
8. **Single-tenant data, multi-tenant ready.** Every table has `user_id` from day one; RLS enforced. (NOW LIVE: profiles + weight_logs have RLS scoped to authenticated, auth.uid() = user_id.)
9. **Symmetric caloric engine.** Surplus and deficit are the same math with opposite sign. Pivot-ready. (Verified in TDEE engine tests.)
10. **LLM-provider-agnostic.** All AI calls go through `/lib/ai/adapter`. **Default = Gemini 2.5 Flash (free).** Claude (Haiku 4.5) is the high-stakes swap-in via `priority: 'high_stakes'`.

## 5. MVP scope (v0.1)

### In MVP
1. Onboarding chat — progressively builds profile (NOTE: Sprint 1 shipped a pre-filled FORM; conversational chat onboarding deferred to Sprint 2 when chat infra exists. Form stays as the edit-profile/settings screen.)
2. TDEE / calorie-target calculator — Mifflin-St Jeor + activity + ectomorph adj + surplus, with uncertainty band ✅ BUILT
3. Chat as primary surface — stateful, intra-day aware
4. Real-time meal logging via natural language → parsed, confirmed, stored
5. Conservative food estimates — each food has min/typical/max kcal (95% rule)
6. Intra-day running state — consumed today + remaining vs target
7. Real-time recommendations — "what should I do now"
8. Weekly meal plan generator — optional, once/week, reference not contract
9. Manual weight logging
10. Weekly trend interpretation + 2-week TDEE recalibration
11. Indian-first food database — ~300 foods curated
12. RAG knowledge base — ICMR-NIN + curated PubMed/Examine
13. Source citations on every claim
14. Uncertainty disclosure on every estimate

### NOT in MVP
Photo logging, training/exercise programming, native apps (PWA covers it), wearables, push notifications, recipe generation, bilingual, multi-user/social, payments, weight-loss-mode UI

## 6. Long-term vision
- v0.2 — Photo logging, wearable sync, notifications, weight-loss mode, Hindi/Marathi, conversational onboarding upgrade, magic-link/Google OAuth (nicer auth UX), re-enable email confirmation
- v0.5 — Public beta, multi-user, subscription, doctor/RD read-only portal
- v1.0 — Multi-region (Indian diaspora first), verified-creator content layer
- v2.0+ — Biomarker integration, CGM reasoning, micronutrient targeting

## 7. Tech stack (all installed/working)

| Layer | Choice | Status / Free-tier |
|---|---|---|
| Framework | Next.js 14.2.35 (App Router) | ✅ |
| Language | TypeScript strict mode | ✅ tsc clean throughout |
| UI | Tailwind 3.4 (shadcn not yet added) | ✅ |
| Mobile | PWA via next-pwa (not yet added) | ⏳ Sprint 5 |
| Hosting | Vercel (env vars set in dashboard) | ✅ deployed live, auto-deploy on push |
| DB + Auth + Storage + Vector | Supabase (project: bulq-dev, Mumbai region) | ✅ tables + RLS + auth live |
| Auth | Supabase email/password, email confirmation OFF for POC | ✅ working; re-enable confirmation at productization |
| Vector store | pgvector inside Supabase | ⏳ enable in Sprint 3 |
| LLM primary | Gemini 2.5 Flash (`gemini-2.5-flash`) | ✅ verified working |
| LLM high-stakes | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | ✅ verified working |
| Embeddings | Gemini text-embedding-004 (768 dim) | ⏳ Sprint 3 |
| Vercel AI SDK | `ai` 3.4.33 + `@ai-sdk/google` 0.0.55 + `@ai-sdk/anthropic` 0.0.50 | ✅ |
| Testing | Vitest | ✅ 16 TDEE tests passing |
| Source control | GitHub (adicchobe/bulq), gh CLI authed | ✅ |
| Dev tooling | Claude Code CLI 2.1.x via Enterprise Claude.ai sub | ✅ |

## 8. Authentication & credentials — strict separation

| Credential | What it's for | Cost |
|---|---|---|
| **Enterprise Claude.ai subscription** (work account) | Authenticates Claude Code during dev | Already paid |
| **Anthropic API key** (PERSONAL account, $4.51 balance) | Running Bulq app → Claude high-stakes calls | Burns $4.51 |
| **Gemini API key** (AI Studio, free tier) | Running Bulq app → default LLM | Free within quota |
| **Supabase anon key** | App DB access (RLS-gated) | Free tier |

**Hard rules:**
- Claude Code authenticated via Enterprise subscription, never API key.
- API keys live ONLY in `.env.local` (gitignored, verified 3 ways) and Vercel encrypted env vars.
- Bulq app prefers Gemini; falls back to Claude (Haiku) only when orchestrator flags high-stakes.
- Personal $4.51 account confirmed — no org concern on runtime API key. Org policy on Enterprise-Claude-for-personal-Claude-Code is user's responsibility (R7).

**App auth model:** Supabase email/password. Email confirmation disabled for single-user POC. RLS policies scoped to `authenticated` role only — logged-out clients get nothing even with anon key. Redirect URLs configured for localhost + Vercel production.

## 9. System architecture (four layers)

1. **Client (PWA):** Chat | Dashboard | Onboarding/Login
2. **Application & API (Next.js routes):** API endpoints | Orchestrator | Domain services
3. **AI reasoning:** LLM adapter (Gemini default, Claude high-stakes) | RAG layer | Tools
4. **Data & knowledge:** PostgreSQL | pgvector

### Request flow (one user message)
User → PWA → POST /api/chat → orchestrator loads context → intent classification → branch → LLM call via adapter with tools → tools executed (DB/math/RAG) → response with [CITE:] markers → anti-hallucination post-processor → citations attached → streamed → persisted.

## 10. Files built so far (through Sprint 1)

```
src/
  app/
    page.tsx                    ✅ protected dashboard: no user→/login, no profile→/onboarding, else renders target card from REAL saved profile
    layout.tsx                  ✅ title/description set to Bulq
    login/page.tsx              ✅ email/password sign-in + sign-up (client)
    auth/signout/route.ts       ✅ POST signout → /login
    onboarding/
      page.tsx                  ✅ server guard (redirect if logged out or already onboarded) wrapping the form
      onboarding-form.tsx       ✅ client form, pre-filled with §3 defaults, grouped sections
      actions.ts                ✅ 'use server' — Zod validate → upsert profile for auth.uid() → redirect /
      schema.ts                 ✅ shared Zod OnboardingSchema + OnboardingInput type
  middleware.ts                 ✅ session refresh (route protection now active via page guards)
  lib/
    db/
      client.ts                 ✅ browser Supabase client
      server.ts                 ✅ server Supabase client (+ cookies)
      middleware.ts             ✅ updateSession helper
      profiles.ts               ✅ typed: ProfileRow, getProfile(), upsertProfile(), profileToNutritionProfile() mapper (Number() coercion for numeric-as-string)
      index.ts                  ✅ barrel
    ai/
      adapter.ts                ✅ llmCall() — Gemini default, Claude Haiku high-stakes
      types.ts                  ✅ Message, ToolCall, LLMCallOptions, LLMResponse, etc.
      index.ts                  ✅ barrel
    nutrition/
      tdee.ts                   ✅ BMR, TDEE, ectomorph adj, daily target, protein; computeNutritionTargets(); DEFAULT_SURPLUS_KCAL 300, DEFAULT_DEFICIT_KCAL 400, DEFAULT_PROTEIN_PER_KG 1.8, DEFAULT_UNCERTAINTY_BAND_KCAL
      types.ts                  ✅ Sex, ActivityLevel (incl. moderate_plus), GoalDirection, NutritionProfile, KcalRange, NutritionTargets
      tdee.test.ts              ✅ 16 Vitest tests passing
      index.ts                  ✅ barrel
    rag/index.ts                (empty — Sprint 3)
    utils/index.ts              (empty)
supabase/
  migrations/
    0001_profiles_and_weight_logs.sql  ✅ applied in Supabase dashboard + committed; RLS on both tables
scripts/
  smoke-test-llm.ts             ✅ npm run smoke:llm
.env.local                      ✅ 4 keys, gitignored
.env.local.example              ✅ committed template
project_brief.md                ✅ committed (this file)
```

## 11. Coding principles for Claude Code

- TypeScript strict mode; **no `any` types**
- Server components by default; client components only when interactivity demands
- API routes / server actions use **Zod** for input validation
- Every DB query is a typed function in `/lib/db/`
- Every LLM call goes through `/lib/ai/adapter` — **never** import provider SDKs in business logic
- Component props typed via `interface`
- Tailwind only; no CSS-in-JS
- Comments only where the *why* isn't obvious
- Tests (Vitest) on critical paths: TDEE calc ✅, macro calc, RAG retrieval, conservative-estimate logic, meal pipeline
- Row-Level Security on every Supabase table from day one
- Numeric columns from Supabase: coerce with Number() in mappers (PostgREST can return numeric as string)
- Folder structure under `src/`: /app, /components, /lib/{db,ai,nutrition,rag,utils}

## 12. AI architecture key points

- **Three LLM jobs** prompted separately: parsing (NL→structured), reasoning (state→decision), composition (draft).
- **Tool-using orchestrator:** lookup_food, estimate_unknown_food, calculate_tdee, get_today_summary, get_weekly_trend, search_knowledge, log_meal, log_weight.
- **Adapter pattern** via Vercel AI SDK. Verified working both providers.
- **Anti-hallucination post-processor:** verifies numbers sourced, softens absolutes, blocks prohibited tone.
- **High-stakes → Claude Haiku:** weight-trend interpretation, contradictory-evidence resolution, onboarding TDEE explanation, 2-week recalibration, user-flagged confusion.
- ⚠️ **Gemini thinking-token issue (R11):** Gemini 2.5 Flash spends hidden "thinking" tokens that count against maxTokens but aren't surfaced in completionTokens. At a tight cap, the visible answer truncates. MUST set a sane maxTokens floor in the adapter + decide per-call thinking budget when building the orchestrator (Sprint 2). api_usage_log will undercount Gemini cost until thinking tokens are surfaced.

## 13. RAG architecture key points (Sprint 3)

- Tiers: Tier 1 ICMR-NIN primary; Tier 2 curated PubMed/Examine; Tier 3 Bulq-authored opinion docs (cited).
- Chunking ~300–500 tokens, 50 overlap. Embeddings text-embedding-004 (768d).
- Retrieval: cosine similarity in pgvector, top-5, optional topic pre-filter, rerank by recency + evidence_grade.
- Citation enforcement: LLM emits [CITE:chunk_id] placeholders; orchestrator resolves to real source titles + links.

## 14. Meal-understanding pipeline (6 steps, Sprint 2)

1. Tokenize input into food units (Gemini Flash, structured output)
2. Resolve to known foods (exact → alias → fuzzy → LLM-inferred → unknown)
3. Resolve units to grams (chapati/katori/bowl table in /lib/nutrition/units.ts)
4. Compute macros (min/typical/max per item, summed)
5. Confidence assessment (worst-item rule)
6. Confirm with user; corrections feed feedback_events

## 15. TDEE engine (Sprint 1 — BUILT)

- BMR: Mifflin-St Jeor (1990) ✅
- Activity multipliers: sedentary 1.2 / light 1.375 / moderate 1.55 / moderate_plus 1.6 / active 1.725 / very_active 1.9 ✅
- Ectomorph adjustment: +5–10% (default 7) for goal=gain only ✅
- Surplus: default 300 (range 250–400) gain; default 400 (300–500) deficit ✅
- deltaKcal & proteinPerKg are DERIVED from goal_direction, not stored as columns
- 2-week recalibration (Sprint 4): if actual change < 50% of expected, +200 kcal/day; if > 150%, −200. 7-day rolling average.

## 16. Data model (11 tables; profiles + weight_logs LIVE)

users, profiles ✅, weight_logs ✅, foods (min/typical/max kcal), meals, meal_items, meal_plans, conversations, messages, daily_summaries, knowledge_chunks (pgvector), feedback_events, api_usage_log. All `user_id`-scoped, RLS from day one.

profiles columns: user_id (PK→auth.users), sex, age_years, height_cm, current_weight_kg, goal_weight_kg, goal_direction, goal_rate_pct_per_week, activity_level (incl moderate_plus), training_days_per_week, ectomorph_adjustment_pct, dietary_pattern, chicken_max_per_week, medical_flags jsonb, sleep_avg_hours, kitchen_context jsonb, created_at, updated_at (auto-touch trigger). TEXT+CHECK for enums (extensible).

weight_logs columns: id (PK), user_id (→auth.users), weight_kg, logged_at, measured_at, notes, source, created_at. Index on (user_id, measured_at).

## 17. Trust & verification framework

5 layers: input verification, source grounding, uncertainty surfacing, refusal-when-unsure, audit trail. Anti-hallucination post-processor enforces. Confidence-card UX primitive: green/amber/gray dot per numeric estimate, tappable for basis. (Dashboard already shows uncertainty range — pillar #2 visible.)

## 18. Privacy & security

- PII + health data in Supabase, encrypted at rest, behind auth ✅
- RLS on every table from day one ✅ (profiles + weight_logs live)
- Data export (full JSON) + data deletion first-class from MVP (on delete cascade in place)
- No biometric data beyond weight in MVP
- No medical claims; wellness/lifestyle positioning
- API keys in .env.local (gitignored) + Vercel encrypted env vars only

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

## 20. Project status

- ✅ Phase 1 — Problem refinement complete
- ✅ Phase 2 — Architecture complete (3 messages)
- 🚧 Phase 3 — Execution
  - ✅ Sprint 0 — Foundations COMPLETE
  - ✅ Sprint 1 — Profile + TDEE COMPLETE (TDEE engine + tests, target screen, email/password auth, profiles+weight_logs tables w/ RLS, onboarding form, profile-driven protected dashboard, full loop tested live + deployed)
  - ⏳ Sprint 2 — Chat + Meal logging (NEXT)
  - ⏳ Sprint 3 — Knowledge + Citations (RAG)
  - ⏳ Sprint 4 — Trends + Plans
  - ⏳ Sprint 5 — Polish + Daily use

## 21. Sprint structure

| Sprint | Duration | Deliverable |
|---|---|---|
| 0 — Foundations | DONE | Deployed app, DB connected, adapter verified |
| 1 — Profile + TDEE | DONE | Auth + tables + onboarding + TDEE; user sees their target from saved data |
| 2 — Chat + Meal Logging | 2.5 wk | Core chat + natural language meal logging (the big one) |
| 3 — Knowledge + Citations | 1.5 wk | RAG pipeline, sources on claims |
| 4 — Trends + Plans | 1.5 wk | Weight logging, trend interpretation, meal plan generator |
| 5 — Polish + Daily Use | 1 wk | PWA install, perf, npm audit cleanup, URL rename, daily-use ready |

## 22. Open decisions / carried-forward items

| # | Item | Status |
|---|---|---|
| 1 | Review user's full body checkup report for flags affecting nutrition targets | Pending — user to share |
| 2 | Whey timing/type experiment (isolate vs concentrate; earlier in day) | Flagged for feedback loop |
| 3 | Gemini thinking-token config — sane maxTokens floor in adapter + per-call thinking budget; api_usage_log undercount | DO IN SPRINT 2 (orchestrator) |
| 4 | Top up Anthropic balance beyond $4.51 | Defer until real usage data |
| 5 | Sentry adoption | Defer to first 5 users |
| 6 | Vercel URL rename + domain/branding | Defer to v0.2 (cosmetic) |
| 7 | Org policy check on Enterprise Claude for personal project | User's responsibility |
| 8 | npm audit (vulns, all transitive) | Defer to Sprint 5 cleanup |
| 9 | Vercel AI SDK v3 → v4 upgrade | Defer; v3 stable |
| 10 | Conversational chat onboarding (upgrade from current form) | Deferred to Sprint 2 (needs chat infra); form stays as settings/edit screen |
| 11 | Re-enable email confirmation + nicer auth (magic-link/Google OAuth) | Defer to v0.2 / productization |
| 12 | Editable profile / settings screen (the onboarding form can be reused) | Sprint 2 or later |
| 13 | Add Vercel production URL to Supabase redirect URLs for phone login | User doing now |

## 23. Risks register (top 11)

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Food DB estimates off >20% → user under-eats surplus | Medium | High | 3-value storage + 2-week TDEE calibration |
| R2 | LLM hallucinates calorie number despite tools | Low | High | Anti-hallucination post-processor; tools mandatory |
| R3 | $4.51 Anthropic drained during dev | Medium | Medium | Gemini default; cost tracking; graceful degradation; Haiku cheap |
| R4 | User stops logging after week 2 | High | High | Chat-first logging; intra-day rewards; never shame |
| R5 | Katori size mismatch | High | Medium | Per-user calibration v0.2; uncertainty band absorbs in MVP |
| R6 | Supabase free tier runs out post-launch | Low for MVP | High at scale | Clear migration path |
| R7 | Org policy on personal use of Enterprise Claude | Unknown | Medium | User to verify |
| R8 | Gemini Flash quality worse than tested on Indian queries | Medium | Medium | High-stakes routing to Claude; measure on real queries |
| R9 | RAG corpus stale/contradictory | Medium | Medium | Tier 3 docs resolve; weekly review |
| R10 | Undiagnosed user health condition → wrong recommendations | Low | Very High | Onboarding red-flag screen; wellness-not-medical disclaimer; user did full checkup |
| R11 | Gemini thinking tokens silently truncate responses | Medium | High | Discovered Sprint 0 smoke test; set maxTokens floor in adapter (Sprint 2) |

## 24. How the user works with Claude (PM mode)

- User (Aditya) is a **non-coder**, guided step-by-step. Define unfamiliar terms briefly.
- Claude acts as **program manager** + architect + engineer + thinking partner.
- Markers: ⚠️ RISK, 🎯 DECISION NEEDED, 🧠 ASSUMPTION.
- Claude summarizes at end of each session (changed / next / blocking).
- Claude over-communicates when stakes unclear.
- Claude pushes back when requests conflict with pillars (§4); doesn't comply silently with wrong-direction requests.
- Claude flags real-money actions (paid API, top-ups, paid tiers) BEFORE proceeding.
- **Claude owns step ordering, prerequisite verification, QA, security checks, and proactively re-shares artifacts (like this brief) when needed.**
- Claude maintains a continuous QA + security watch at every sprint boundary (secrets, RLS, no-invented-numbers, citations, provider-agnostic, Indian-first, no shaming, TS strict, cost monitoring).
- **Claude reviews all Claude-Code-generated SQL/code before it touches the database or production**, especially RLS policies.
- When working in Claude Code: always pick "Yes" (option 1) on approval prompts, never "don't ask again"; stop on git commits/pushes, .env changes, anything outside ~/projects/bulq, or anything spending money beyond tiny verified calls.

## 25. Sprint 2 preview (NEXT — the big one, 2.5 wk)

The core of the product. Likely sub-steps:
1. Conversations + messages tables (RLS) for chat history
2. Foods table + ~300 curated Indian-first foods (min/typical/max kcal); units table (chapati/katori/bowl→grams)
3. Meals + meal_items tables (RLS)
4. The orchestrator: intent classification, tool-using loop, the 3 LLM jobs (parse/reason/compose) via the adapter
5. /api/chat streaming endpoint + chat UI (primary surface)
6. Meal-understanding pipeline (6 steps): NL → parsed items → confirm → store
7. Intra-day running state (daily_summaries) + "what should I do now" recommendation
8. Anti-hallucination post-processor (numbers sourced, tone, absolutes)
9. RESOLVE the Gemini maxTokens/thinking-budget issue (R11/#3) in the adapter here
