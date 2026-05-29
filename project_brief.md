# Bulq — Project Brief

> Living document. Canonical context for Claude Code, future Claude.ai sessions, and any AI assistant working on this project. Updated at the end of each major decision point.
>
> **Last updated:** Start of Phase 3 — Sprint 0 (v3). Phase 2 architecture complete.

---

## 1. Identity

- **Name:** Bulq (working name, changeable)
- **Type:** AI-assisted nutritional reasoning partner for naturally skinny individuals
- **Primary user (POC):** Self-build by user (Aditya), age 26, Mumbai, India
- **Productization path:** Single-tenant POC → public multi-tenant SaaS for skinny-individual demographic, India-first
- **Pivot possibility:** Architecture is caloric-balance-direction-agnostic, so it can also serve weight-loss users without rewrite

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
| Target weight | 62–65 kg |
| Diet | Vegetarian primary; egg daily acceptable; chicken 1–2× per week max |
| Training | 5×/week consistent baseline; partial-equipment gym now, fully equipped gym soon; ~45 min sessions |
| Cooking situation | Maid cooks main meals; user self-preps supplements (boiled eggs, milk, chana, chia) |
| Sleep | 8 hours average — excellent foundation |
| Digestion | No general issues; mild discomfort with night-time whey protein shakes (suspected lactose sensitivity in concentrate) |
| Cultural context | Indian home cooking + Mumbai food access |
| Goal direction | Sustainable lean weight gain at 0.25–0.4% body weight per week |
| Tech comfort | Minimal coding — relies heavily on AI assistance to build |
| Hosting budget | Strictly free tiers only for POC |

### Computed defaults at onboarding (will recalibrate from real weight trend)
- **BMR (Mifflin-St Jeor):** 1540 kcal/day
- **TDEE (1.6× activity multiplier):** ~2464 kcal/day
- **Ectomorph-adjusted maintenance (+7%):** ~2640 kcal/day
- **Daily target (+300 kcal lean-gain surplus):** ~2940 kcal/day (±200 uncertainty band)
- **Protein target (1.8 g/kg):** ~97 g/day
- **Realistic timeline 54 → 62 kg:** ~9–14 months at sustainable rates

## 4. Behavioral pillars (non-negotiable)

1. **Never invent nutritional numbers.** Use database lookups or cite sources. If unknown, say "I don't know precisely" and show a range.
2. **Always surface uncertainty.** Show ranges, never false precision. *"~280–340 kcal"*, never *"312 kcal"* for an estimate.
3. **Conservative estimates by default for planning.** Under-estimate calories rather than over, so user doesn't accidentally fall short of their surplus target.
4. **Every scientific claim has a citation or is marked as estimate.** No bare assertions.
5. **Indian-first food knowledge.** Rotis, dals, sabzis, paneer, eggs, common Mumbai foods. Western foods are a deferred enhancement.
6. **Respect the cooking situation.** Maid-prepared vs. self-prepared meals have different effort costs and timing.
7. **No diet shaming, no compliance shaming.** Never use weight-loss app language patterns ("guilt-free", "cheat day", "treat yourself"). Wrong domain.
8. **Single-tenant data, multi-tenant ready.** Every table has `user_id` from day one.
9. **Symmetric caloric engine.** Surplus and deficit are the same math with opposite sign. Pivot-ready.
10. **LLM-provider-agnostic.** All AI calls go through `/lib/ai/adapter`. **Default model at runtime = Gemini 2.5 Flash (free).** Claude is a swap-in for trust-critical paths via a `priority: 'high-stakes'` flag.

## 5. MVP scope (v0.1)

### In MVP
1. **Onboarding chat** — progressively builds user profile
2. **TDEE / calorie-target calculator** — Mifflin-St Jeor BMR + activity multiplier + ectomorph adjustment + surplus, with uncertainty band shown
3. **Chat as primary surface** — stateful, intra-day aware
4. **Real-time meal logging via natural language** — *"3 chapatis and a katori of toor dal"* → parsed, confirmed, stored
5. **Conservative food estimates** — each food has `min_kcal` / `typical_kcal` / `max_kcal`. 95% rule: real meals fall at-or-above conservative estimate.
6. **Intra-day running state** — what you've eaten today + what's left against target
7. **Real-time recommendations** — *"What should I do now"* given current state
8. **Weekly meal plan generator** — optional, once per week. Reference, not contract.
9. **Manual weight logging**
10. **Weekly trend interpretation + 2-week TDEE recalibration**
11. **Indian-first food database** — ~300 foods curated to start
12. **RAG knowledge base** — ICMR-NIN guidelines + curated PubMed/Examine summaries
13. **Source citations on every claim**
14. **Uncertainty disclosure** on every estimate

### NOT in MVP (deferred)
- Photo meal logging, training/exercise programming, native iOS/Android (PWA covers it), wearable integrations, push notifications, recipe generation, bilingual support, multi-user/social, payments, weight-loss mode UI

## 6. Long-term vision (post-MVP)
- v0.2 — Photo logging, wearable sync, notifications, weight-loss mode, Hindi/Marathi
- v0.5 — Public beta, multi-user, subscription, doctor/RD read-only portal
- v1.0 — Multi-region (Indian diaspora first), verified-creator content layer
- v2.0+ — Biomarker integration, CGM reasoning, micronutrient targeting

## 7. Tech stack

| Layer | Choice | Free-tier ceiling |
|---|---|---|
| Framework | Next.js 14 (App Router) | Open source |
| Language | TypeScript (strict mode) | n/a |
| UI | Tailwind + shadcn/ui | n/a |
| Mobile | PWA via `next-pwa` | n/a |
| Hosting (web + API) | Vercel | 100 GB bandwidth/mo, 100K function invocations/day |
| Database + Auth + Storage + Vector | Supabase | 500 MB DB, 1 GB file, 50K MAU auth |
| Vector store | pgvector inside Supabase | Included |
| **LLM primary (runtime default)** | **Google Gemini 2.5 Flash** | 15 req/min, 1500 req/day |
| **LLM fallback (high-stakes only)** | Anthropic Claude (Haiku/Sonnet) via API | Pay-as-you-go — uses user's $4.51 API balance |
| Embeddings | Gemini `text-embedding-004` (768 dim) | Covered by Gemini quota |
| Source control | GitHub | Unlimited repos |
| CI/CD | Vercel + GitHub Actions | Included |
| Errors | Sentry (deferred until first 5 users) | 5K events/month |
| Dev tooling | Claude Code | User's Enterprise Claude.ai subscription |

## 8. Authentication & credentials — strict separation

| Credential | What it's for | What it costs |
|---|---|---|
| **Enterprise Claude.ai subscription** | Authenticates Claude Code during development | Already paid (subscription) |
| **Anthropic API key** (from console.anthropic.com — $4.51 balance) | Used by the *running* Bulq app to call Claude for high-stakes nutrition reasoning | Burns the $4.51 balance per call |
| **Gemini API key** (from aistudio.google.com) | Used by the *running* Bulq app as the default LLM | Free (within quota) |
| **Supabase service-role + anon keys** | App database access | Free tier |
| **Vercel deploy hooks** | Auto-deploy on git push | Free tier |

**Hard rules:**
- Claude Code is authenticated via subscription, *never* via API key.
- API keys never appear in code or git history. All keys live in `.env.local` (gitignored) and Vercel encrypted env vars.
- Bulq app prefers Gemini; falls back to Claude only when orchestrator flags request as high-stakes.

## 9. System architecture (four layers)

1. **Client (PWA):** Chat | Dashboard | Onboarding
2. **Application & API (Next.js routes):** API endpoints | Orchestrator | Domain services
3. **AI reasoning:** LLM adapter (Gemini default, Claude high-stakes) | RAG layer | Tools (macro calc, food lookup, TDEE calc, search_knowledge)
4. **Data & knowledge:** PostgreSQL (profile, meals, weights, food DB, conversations) | pgvector (cited evidence chunks)

### Request flow (one user message end-to-end)
User → PWA → POST /api/chat → orchestrator loads context → intent classification (Gemini Flash, structured) → branch by intent → LLM call via adapter with tools → tools executed (DB / math / RAG) → response generated with [CITE:] markers → anti-hallucination post-processor → citations attached → streamed to client → persisted in `messages`.

## 10. Data model (11 tables)

| Table | Purpose |
|---|---|
| `users` | Auth record, timezone |
| `profiles` | Body data, goal, dietary pattern, kitchen context, ectomorph adjustment, sleep, medical flags |
| `weight_logs` | Longitudinal weight record |
| `foods` | Food knowledge base — each food has min/typical/max kcal, aliases, region, evidence source |
| `meals` | A logged meal (composite of meal_items) |
| `meal_items` | Individual foods within a meal, with quantity, grams resolved, macros, confidence, match_method |
| `meal_plans` | Optional weekly skeletons |
| `conversations`, `messages` | Chat history with model_used, tokens_used, cited_sources |
| `daily_summaries` | Cached aggregate per user per day |
| `knowledge_chunks` | RAG corpus with pgvector embeddings |
| `feedback_events` | Corrections, rejections, learning signal |
| `api_usage_log` | Cost tracking per provider |

Every table has `user_id` (FK to users); Row-Level Security (RLS) enforced from day one.

## 11. AI architecture key points

- **Three LLM jobs**, prompted separately: parsing (NL → structured), reasoning (state → decision), composition (draft response).
- **Tool-using orchestrator.** LLM calls tools — `lookup_food`, `estimate_unknown_food`, `calculate_tdee`, `get_today_summary`, `get_weekly_trend`, `search_knowledge`, `log_meal`, `log_weight`.
- **LLM adapter pattern.** All calls go through `/lib/ai/adapter`; no provider SDKs in business logic. Vercel AI SDK (`ai` package) preferred.
- **Anti-hallucination post-processor.** Verifies numbers are sourced, softens absolutes, blocks prohibited tone language.
- **High-stakes routing to Claude:** weight-trend interpretation, contradictory evidence resolution, onboarding TDEE explanation, 2-week plan recalibration, user-flagged confusion.

## 12. RAG architecture key points

- **Corpus tiers:** Tier 1 ICMR-NIN primary docs; Tier 2 curated PubMed/Examine summaries; Tier 3 Bulq-authored opinion docs with citations.
- **Chunking:** ~300–500 token chunks with 50-token overlap.
- **Embeddings:** Gemini `text-embedding-004` (768 dim).
- **Retrieval:** cosine similarity in pgvector, top-5, with optional topic pre-filter; reranked by recency + evidence_grade.
- **Citation enforcement:** LLM produces `[CITE:chunk_id]` placeholders; orchestrator resolves to real source titles + links before display.

## 13. Meal-understanding pipeline (6 steps)

1. Tokenize input into food units (Gemini Flash, structured output)
2. Resolve to known foods (exact → alias → fuzzy → LLM-inferred → unknown)
3. Resolve units to grams (chapati, katori, bowl, etc. — table in `/lib/nutrition/units.ts`)
4. Compute macros (min/typical/max per item, summed)
5. Confidence assessment (worst-item rule)
6. Confirm with user; corrections feed `feedback_events`

## 14. TDEE engine

- **BMR:** Mifflin-St Jeor (1990)
- **Activity multipliers:** sedentary 1.2 → very_active 1.9
- **Ectomorph adjustment:** +5–10% for `goal_direction = gain` (NEAT compensation)
- **Surplus:** 250–400 kcal/day for gain; 300–500 kcal/day deficit for loss
- **2-week recalibration loop:** if actual weight change < 50% of expected, increase target by 200 kcal/day; if > 150%, decrease by 200. Uses 7-day rolling average, not point measurements.

## 15. Trust & verification framework

5 layers:
1. **Input verification** — confirm parse before storing; sanity-check large weight jumps
2. **Source grounding** — citations or explicit "estimate" label
3. **Uncertainty surfacing** — ranges, not point estimates
4. **Refusal-when-unsure** — system allowed (required) to say "I don't know precisely"
5. **Audit trail** — full reasoning trace per response, replayable

**Anti-hallucination post-processor** is the enforcement mechanism.

**Confidence card UX primitive:** every numeric estimate shown with green/amber/gray confidence dot; tappable for basis.

## 16. Coding principles for Claude Code

- TypeScript strict mode; **no `any` types**
- Server components by default in Next.js; client components only when interactivity demands
- API routes use **Zod** for input validation
- Every DB query is a typed function in `/lib/db/`
- Every LLM call goes through `/lib/ai/adapter` — **never** import provider SDKs directly in business logic
- Every component has props typed via `interface`
- Tailwind for styling; **no CSS-in-JS**
- Comments only where the *why* isn't obvious from the code
- Tests (Vitest) on critical paths: TDEE calc, macro calc, RAG retrieval, conservative-estimate logic, meal pipeline
- Row-Level Security enabled on every Supabase table from day one
- Folder structure under `src/`: `/app` (routes), `/components`, `/lib/db`, `/lib/ai`, `/lib/nutrition`, `/lib/utils`, `/lib/rag`

## 17. Privacy & security

- All PII + health data in Supabase, encrypted at rest, behind auth
- Row-Level Security on every table from day one
- Data export (full JSON) and data deletion are first-class features from MVP
- No biometric data beyond weight in MVP
- No medical claims; positioned as wellness/lifestyle product
- API keys: `.env.local` for dev (gitignored), Vercel encrypted env vars for prod

## 18. Development environment

| Item | Value |
|---|---|
| OS | macOS |
| Package manager | Homebrew |
| Node.js | v20+ (LTS) via Homebrew |
| Git | Apple-bundled (via Xcode CLT) |
| Editor | VS Code |
| AI dev tool | Claude Code CLI 2.1.x, authenticated via Enterprise Claude.ai subscription |
| Repo location | `~/projects/bulq` |

## 19. Execution plan — Sprint structure

| Sprint | Duration | Deliverable |
|---|---|---|
| 0 — Foundations | 1 week | Empty repo deployed live on Vercel; database connected; sign-in works |
| 1 — Profile + TDEE | 1.5 weeks | Onboarding flow; system knows the user; computes daily target |
| 2 — Chat + Meal Logging | 2.5 weeks | Core chat experience; natural language meal logging |
| 3 — Knowledge + Citations | 1.5 weeks | RAG pipeline; sources attached to claims |
| 4 — Trends + Plans | 1.5 weeks | Weight logging; weekly trend interpretation; meal plan generator |
| 5 — Polish + Daily Use | 1 week | PWA install, performance, daily-use ready |

## 20. Project status

- ✅ Phase 1 — Problem refinement complete
- ✅ Phase 2 — Architecture complete (3 messages)
- 🚧 Phase 3 — Execution roadmap in progress (Sprint 0 starting)
- 🚧 Environment setup — complete locally; cloud accounts created
- ⏳ Implementation — Sprint 0 in progress

## 21. Open decisions

| # | Decision | Status |
|---|---|---|
| 1 | One-time blood panel (thyroid, B12, vit D, Hb, glucose) given BMI 16.7 | Recommended; user to decide |
| 2 | Whey timing/type experiment (isolate vs concentrate; earlier in day) | Flagged for post-MVP feedback loop |
| 3 | ~~Default primary LLM~~ | ✅ Resolved: Gemini Flash default, Claude high-stakes swap-in |
| 4 | Top up Anthropic API balance beyond $4.51 | Defer until real usage data |
| 5 | Sentry adoption timing | Defer to first 5 users |
| 6 | Domain name / branding | Defer to v0.2 |
| 7 | Org policy check on Enterprise Claude for personal project | User's responsibility |

## 22. Risks register (top 10)

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Food DB estimates off by >20% → user under-eats surplus | Medium | High | 3-value storage + 2-week TDEE calibration |
| R2 | LLM hallucinates calorie number despite tools | Low | High | Anti-hallucination post-processor; tools mandatory for numbers |
| R3 | $4.51 Anthropic drained in 2 weeks of dev | Medium | Medium | Gemini default; cost tracking; graceful degradation |
| R4 | User stops logging after week 2 | High | High | Chat-first logging; intra-day rewards; never shame skipped logs |
| R5 | Katori size mismatch (user vs default) | High | Medium | Per-user calibration v0.2; uncertainty band absorbs in MVP |
| R6 | Supabase free tier runs out post-launch | Low for MVP | High at scale | Clear migration path to paid |
| R7 | Org policy on personal use of Enterprise Claude | Unknown | Medium | User to verify |
| R8 | Gemini Flash quality worse than tested on Indian queries | Medium | Medium | High-stakes routing to Claude available; measure on real queries |
| R9 | RAG corpus stale or contradictory | Medium | Medium | Tier 3 docs resolve; weekly review during MVP |
| R10 | Undiagnosed user health condition makes recommendations wrong | Low | Very High | Onboarding red-flag screen; wellness-not-medical disclaimer; user to do baseline blood panel |

## 23. How the user works with Claude (PM mode)

- The user (Aditya) identifies as a **non-coder** who will be guided step-by-step
- Claude acts as **program manager** in addition to designer/engineer
- Claude flags concerns with **⚠️ RISK**, decisions with **🎯 DECISION NEEDED**, and assumptions with **🧠 ASSUMPTION**
- Claude summarizes at the end of each work session (what changed, what's next, what's blocking)
- Claude defaults to over-communicating when stakes are unclear
- Claude pushes back when requests conflict with behavioral pillars (§4) — does not comply silently with wrong-direction requests
- When an action might cost real money (paid API calls, top-ups, paid tiers), Claude says so explicitly *before* proceeding
- **Claude is responsible for step ordering, prerequisite verification, and proactively re-sharing artifacts (like this brief) when needed**
