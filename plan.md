# Klypup Assessment — Build Plan (Challenge: Investment Research Dashboard)

**Goal:** Full-stack app where an analyst types a NL research query and gets a structured, source-attributed, AI-orchestrated analysis. Multi-tenant, deployed live, $0 cost.

> **MANDATORY for every phase:** before writing any code for a phase, invoke the Skill(s) named in that phase's `> **Skill — MUST invoke…**` line via the Skill tool. This is not optional and is not overridden by laziness/minimal-diff preferences. If a phase names a skill, the Skill tool call must happen first.

## Stack (all free tier)
| Layer | Choice | Notes |
|---|---|---|
| Frontend | React + TS + Vite + Tailwind + Recharts | → Vercel |
| Backend | Python FastAPI | → Render (cold-start ~50s; document it) |
| DB + Vector | Supabase Postgres + `pgvector` | one service does DB, auth keys, vectors |
| Auth | Supabase Auth (JWT) | verified in FastAPI |
| LLM | **Gemini 2.0 Flash** (primary), Groq Llama-3 (fallback) | both free; Gemini = native JSON mode + big free tier. Wrap behind one `llm.py` so swapping is one line |
| Market data | `yfinance` | no key, no IP blocks |
| News | `duckduckgo-search` + RSS fallback | NewsAPI blocks cloud IPs — avoid |
| Embeddings | Gemini `text-embedding-004` (free) | or local `sentence-transformers` if rate-limited |

> **Decision to record in DECISIONS.md:** Gemini chosen over Groq for reliable structured JSON output + generous free tier; Groq kept as drop-in fallback for speed.

## Critical architecture gotcha (don't skip)
FastAPI talking to Supabase with the **service key bypasses RLS**. So tenant isolation is enforced **in the backend**: a FastAPI dependency decodes the JWT → resolves `org_id` → every query is filtered by `org_id`. RLS policies are added as **defense-in-depth**, not the only line. Demo isolation = backend scoping.

---

## Phase 0 — Setup (½ day)
> **Skill — MUST invoke before starting:** `senior-fullstack` (project scaffolding / structure). _Done._
- Init git repo, frequent commits from here on (graded).
- `.gitignore` (no node_modules/.env/build), `.env.example` in both apps.
- Repo layout: `/frontend`, `/backend`, `/docs`, `docker-compose.yml`, root `README.md`.
- Create Supabase project; enable `pgvector` extension.
- Get Gemini + Groq API keys.
- Backend skeleton: FastAPI, `services/`, `routes/`, `models/`, `tools/`, `core/` (config, auth, logging).

## Phase 1 — Auth + Multi-Tenancy (Day 1) [covers 3.1 auth, 3.3]
> **Skill — MUST invoke before writing code:** `senior-backend` (auth flows, schema, tenant middleware). Then `senior-security` for the isolation/RBAC review before the checkpoint.
- Schema (Supabase SQL migration, checked into `/backend/migrations`):
  - `organizations(id, name, invite_code, created_at)`
  - `users(id, org_id FK, email, role['admin'|'analyst'], created_at)`
  - `research_reports(id, org_id FK, user_id FK, query, result_json, tags[], created_at)`
  - `watchlist(id, org_id, user_id, ticker)`
  - `audit_logs(id, org_id, user_id, action, meta, created_at)`
  - indexes on `org_id` everywhere.
- Auth flow: signup (creates org **or** joins via invite_code), login, logout. Supabase issues JWT.
- FastAPI dependency `get_current_tenant()`: verify JWT → load user → return `{user_id, org_id, role}`. Inject into every protected route.
- RBAC: `require_role("admin")` dependency. Admin = manage org/invite users; Analyst = create/view research.
- RLS policies on all tenant tables (defense-in-depth).
- ✅ Checkpoint: two orgs, data never crosses.

## Phase 2 — Data Tools (Day 2) [covers Required Data Integrations 1–3]
> **Skill — MUST invoke before writing code:** `senior-backend` (tool/service design). For the vector store + ingestion pipeline, also invoke `senior-ml-engineer` (chunking, embeddings, RAG retrieval).
Each tool = a plain Python function with a JSON-serializable return **including a `source` field**.
- `tools/market.py` — `yfinance`: price, volume, P/E, market cap, revenue, EPS, historical series. Multi-ticker.
- `tools/news.py` — `duckduckgo-search`/RSS: recent articles (last 7–30d), per-article sentiment (LLM or VADER), pos/neg/neutral label.
- `tools/filings.py` — vector store:
  - **Ingestion pipeline** (`scripts/ingest.py`): download 3–5 sample SEC 10-K/10-Q (or synthetic) → chunk → embed → store in Supabase `pgvector` table `filing_chunks(id, ticker, chunk, embedding, source_ref)`. Commit the script + sample docs.
  - Query: similarity search returning chunks + `source_ref` (e.g. "AAPL 10-K Q3").
- Caching: `@lru_cache`/TTL dict on market+news fetches (bonus: rate-limit/caching).

## Phase 3 — AI Orchestration (Day 2–3) [covers AI Agent section, 3.2]
> **Skill — MUST invoke before writing code:** `senior-prompt-engineer` (router/synthesizer prompt design, structured-output contracts, agent/tool validation). For provider/model details, also load the `claude-api` reference if using Claude; otherwise consult the chosen provider's docs.
Two-call agentic flow (not hardcoded):
1. **Router** (LLM call 1): NL query → JSON plan `{tickers, fetch_market, fetch_news, search_filings}`. Tools are chosen by the model — if user asks only news, only news runs.
2. **Execute**: FastAPI runs selected tools concurrently (`asyncio.gather`). Skip un-requested tools.
3. **Synthesizer** (LLM call 2): raw tool outputs + strict system prompt → **structured JSON** UI state: `company_cards[]`, `comparison_table`, `news_sentiment[]`, `risks[]`, `summary`. Every item carries a `citation` field.
- **Error handling:** per-tool try/except (one tool failing ≠ whole query fails), LLM timeout + retry/backoff, graceful "AI unavailable" response. Never crash.
- Bonus: stream progress via SSE ("planning → fetching → synthesizing").

## Phase 4 — API Layer (Day 3) [covers 3.1 API, Integration #4]
> **Skill — MUST invoke before writing code:** `senior-backend` (REST design, validation, error envelopes, status codes).
Clean REST, consistent envelope `{data, error, meta}`, proper status codes, pydantic validation.
- `POST /auth/signup`, `/auth/login`, `/auth/logout`
- `POST /orgs/invite` (admin), `POST /orgs/join`
- `POST /research` → runs agent, returns structured JSON, saves report
- `GET /research` (list, search, filter by tag), `GET /research/{id}`, `PATCH` (tag/rename), `DELETE` — full CRUD
- `GET/POST/DELETE /watchlist`
- `GET /health`
- All protected routes tenant-scoped via dependency. No LLM calls from browser.

## Phase 5 — Frontend (Day 3–4) [covers 3.1 frontend, 3.2 structured output]
> **Skill — MUST invoke before writing components:** `senior-frontend` (React/Vite/Tailwind components, state, accessibility). For visual polish / dashboard UX, also invoke `design-taste`.
- Auth pages (signup/login), protected routing, logout.
- **Dashboard home:** recent queries, saved reports, watchlist, quick actions (New Research / Compare).
- **Research interface:** NL textarea → calls `/research` → renders structured components by mapping the JSON:
  - company overview **cards**, financial **comparison tables**, stock **charts** (Recharts), **sentiment badges**, section headers.
  - **citation/source shown on every data point.**
- **Saved research:** list, search, tag, view, delete (CRUD UI).
- **Watchlist** management.
- Admin view: invite users, see org members; Analyst sees only research.
- **Loading / error / empty states** on every async surface. Desktop-first, responsive.

## Phase 6 — Deploy + Docker (Day 4) [covers bonus deploy + docker]
> **Skill — MUST invoke before writing infra:** `senior-devops` (Docker, deploy pipeline, env config, health checks).
- `docker-compose.yml`: frontend + backend (+ optional local postgres) → `docker-compose up` runs whole app.
- Deploy: Supabase (already live) → Render web service (backend, env vars `GEMINI_API_KEY`, `GROQ_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`) → Vercel (frontend, `VITE_API_URL`).
- Note Render cold-start in DECISIONS.md.
- Seed script: creates 2 demo orgs, users of each role, sample reports + watchlist — evaluator sees data immediately.

## Phase 7 — Docs, Tests, Polish (Day 5) [covers Deliverables §4, bonus tests/CI]
> **Skills — MUST invoke:** `documentation-architect` for README + `ARCHITECTURE.md` Mermaid diagrams; `senior-qa` (or `tdd-guide`) for tests; `senior-architect` for the architecture diagrams/ADR framing in `DECISIONS.md`. Run `adversarial-reviewer` or `/code-review` over the diff before final submission.
- **README.md:** option chosen + why, stack rationale, *tested* setup instructions (Docker + manual), 4–6 screenshots, known limitations.
- **ARCHITECTURE.md** (Mermaid diagrams):
  - system architecture, data-flow (UI→API→auth/tenant→AI→tools→DB→render), ER diagram, AI orchestration flow, multi-tenant isolation flow, API endpoint table.
- **DECISIONS.md:** option choice, stack + alternatives, multi-tenancy pattern + why, AI/prompt design, 5-day trade-offs, "2 more weeks" list, hardest part.
- Bonus if time: pytest on tools + agent + tenant isolation; GitHub Actions lint/test/build; PDF/CSV export of a report; structured logging.
- **Final check:** clone repo to fresh dir, follow own README, confirm it runs.

---

## Requirement → Phase coverage map
| Requirement | Phase |
|---|---|
| Auth (signup/login/logout/protected) | 1, 5 |
| Persistent DB + schema | 1 |
| Multi-tenant isolation + RBAC + org mgmt + tenant middleware | 1 |
| Dashboard home | 5 |
| NL research query interface | 5 |
| Structured UI results + source attribution | 3, 5 |
| Saved research CRUD + tags + search | 4, 5 |
| Watchlist | 1, 4, 5 |
| Agentic tool orchestration (dynamic, parallel) | 3 |
| Market data tool | 2 |
| News + sentiment + recency | 2 |
| Vector KB + ingestion pipeline | 2 |
| Clean REST API + validation + errors | 4 |
| LLM tool/function calling + structured output + error handling | 3 |
| Code quality / structure / env vars / logging | 0, all |
| README / ARCHITECTURE / DECISIONS / seed data | 7 |
| Live demo (3 workflows: AI feature, 2-org isolation, RBAC) | 5, 6 |
| Bonus: deploy, SSE streaming, docker, tests, CI, caching, export, observability | 2,3,6,7 |

## Demo script (interview)
1. Login as Org-A analyst → run "Compare Tesla & Ford earnings + news" → show structured cards/tables/charts/citations.
2. Login as Org-B → confirm none of Org-A's reports visible (isolation).
3. Admin vs Analyst → admin can invite users, analyst cannot (RBAC).
