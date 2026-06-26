# stack.md — Targets, Approach & Stack (Interview Reference)

A requirement-by-requirement map of the Klypup assessment: **what the brief asked for**, **how we approached it**, **what we used**, and **why** — written so every decision can be explained out loud in the interview. The challenge is the only option offered (Investment Research Dashboard, Option A).

---

## At-a-glance stack

| Layer | Choice | One-line rationale |
|---|---|---|
| Frontend | React + Vite + TypeScript + Tailwind + Recharts | Auth-walled SPA — no SEO need, so a Vite SPA is lighter than Next.js and deploys free on Vercel. |
| Backend | FastAPI (async Python) | `yfinance` + first-class LLM/embedding SDKs live in Python; async fits parallel tool calls. |
| Database + Vectors + Auth | Supabase (Postgres + pgvector + Auth) | One free service is the relational DB, JWT auth provider, *and* vector store — fewer moving parts in 5 days. |
| LLM | Gemini 2.0 Flash (primary), Groq Llama-3 (fallback) | Both free; Gemini has native JSON mode + a large free tier. One module so the swap is one line. |
| Market data | `yfinance` | Free, no key, not IP-blocked on cloud hosts. |
| News + sentiment | `duckduckgo-search` + lexicon classifier | Free, keyless; NewsAPI blocks Render's free-tier IPs. |
| Deploy | Vercel (frontend) + Render (backend) + Supabase (DB) | All free tiers; Docker Compose for one-command local run. |

The thread tying these together: **everything that costs money or holds a secret stays in the backend.** The browser never calls an LLM or data API directly.

---

## 1. The core idea — AI as a feature, not a chatbot

**Target (goal.md §1, §2):** AI lives *inside* a product with real users, auth, persistence. The AI is a feature that adds value, not a prompt-in/text-out wrapper.

**Approach:** A **two-LLM-call agentic flow** (`backend/app/services/agent.py`), not a chat loop:
1. **Router call** — the natural-language query goes to the LLM, which returns a JSON *execution plan*: `{tickers, fetch_market, fetch_news, search_filings, filing_query}`. The model decides which tools are needed. A news-only question skips market and filings.
2. **Tool execution** — only the selected tools run, **concurrently** via `asyncio.to_thread` + `asyncio.gather`. One tool failing (`return_exceptions=True`) degrades that section instead of failing the whole query.
3. **Synthesizer call** — raw tool outputs go back to the LLM, which returns **strict structured JSON UI state**: `company_cards[]`, `comparison_table`, `news_sentiment[]`, `filing_insights[]`, `risks[]`, `summary`, `sources_used` — every item carrying a `citation`.

**Why two calls:** it cleanly separates *planning* (what data do I need?) from *synthesis* (what does it mean?). It is the difference between "an agent that orchestrates tools" and "a chatbot that talks." This is the 25%-weighted axis of the rubric.

**Interview line:** *"The LLM never touches the financial APIs. It plans, we execute the plan deterministically and in parallel, then it synthesizes. Tools are chosen by the model per query, not hardcoded."*

---

## 2. Full-stack application (rubric 30%)

### 2.1 Authentication
**Target:** Real signup/login/logout, JWT/OAuth/session, protected routes, no fake logins.

**Approach & stack:** Supabase Auth issues JWTs. Signup either **creates an org** (caller becomes `admin`) or **joins via invite code** (caller becomes `analyst`). `org_id` and `role` are written into the JWT's `app_metadata` — **server-controlled, not user-editable** — so every request carries its tenant identity. Verified HS256 against `SUPABASE_JWT_SECRET` with `aud="authenticated"` in `backend/app/core/auth.py`. Frontend stores the token and auto-attaches it (`lib/api.ts`); protected routes gated in `App.tsx`.

**Edge case we handle:** if creating the auth user fails (e.g. duplicate email) right after creating a fresh org, we **roll back the org** and return `409` — no orphan rows, no raw 500.

### 2.2 Database
**Target:** Persistent schema, survives restarts.

**Stack:** Supabase Postgres. Tables: `organizations`, `users`, `research_reports`, `watchlist`, `audit_logs`, `filing_chunks` (vector). Migrations in `backend/migrations/` (`001_init.sql`, `002_filings.sql`) with indexes on the hot paths (`org_id`, vector IVFFlat).

### 2.3 API layer
**Target:** Clean REST, error handling, validation, meaningful status codes, consistent responses.

**Approach:** FastAPI with a layered structure — `core/` (config, auth, logging, responses, cache) · `routes/` · `services/` · `tools/` · `models/`. Pydantic models validate every request body. A single `ok(data, meta)` envelope and `install_error_handlers()` give **consistent response shapes**. The frontend unwraps `{data}` uniformly.

### 2.4 Frontend
**Target:** Functional, clean UI; loading/error/empty states; CRUD; responsive on desktop.

**Stack:** React + Vite + TS + Tailwind. Pages: Login, Dashboard, Research, Reports, ReportDetail, Watchlist, Members. `ResearchResult.tsx` maps the agent's JSON into cards / tables / Recharts / sentiment badges / citations. Full CRUD on saved reports; watchlist add/remove. *(A full Bloomberg-modern visual redefinition is specced in `plan_frontend.md`.)*

---

## 3. AI integration quality (rubric 25%)

| Requirement | How we meet it |
|---|---|
| **Tool/function calling, model-decided** | Router LLM emits a JSON plan; tools chosen per query, not a fixed sequence. |
| **≥2 external data tools** | Three: market (`yfinance`), news+sentiment (`duckduckgo-search`), filings (pgvector RAG). |
| **Structured output** | Synthesizer returns schema-shaped JSON rendered as UI components — never raw text. |
| **Source attribution** | Every tool return and every synthesized item carries a `source`/`citation`. A graded requirement, enforced end-to-end. |
| **Error handling** | Provider abstraction retries twice then **fails over Gemini↔Groq**; one tool failing never fails the query; FastAPI timeouts + graceful degradation. |

**Prompt-engineering decisions worth naming:**
- **API-native JSON mode** (Gemini `response_mime_type`, Groq `json_object`) instead of "respond ONLY in JSON" prompt hacks — the platform guarantees shape.
- **Low temperature (0.2)** for deterministic, parseable output.
- **Explicit grounding rule:** "use ONLY the provided tool data, do not invent numbers" — anti-hallucination.
- **Schema-first** design: the output contract was written before the prompt.

**LLM access** is behind one module (`services/llm.py`, `chat_json(system, user)`) so switching provider is a one-line `LLM_PROVIDER` env change.

### Document Knowledge Base (RAG)
**Target:** Vector store of sample filings; show the ingestion pipeline (chunk → embed → store).

**Approach:** 4 synthetic SEC filing excerpts → **1000-char overlapping chunks (150 overlap)** → **Gemini `text-embedding-004` (768-dim)** → **pgvector** with an **IVFFlat cosine index** and a `match_filing_chunks` RPC for similarity search. Ingestion is an explicit, runnable script (`backend/scripts/ingest.py`) — the pipeline is visible, not hidden. The KB is **shared reference data** (no `org_id`) since filings are public.

---

## 4. Multi-tenant architecture (rubric 15%)

**Target:** Data isolation (Org A can't see Org B), RBAC with ≥2 roles, org creation/join flow, tenant context enforced in the API.

**The load-bearing decision:** the backend talks to Supabase with the **service key, which bypasses Row-Level Security**. So **isolation is enforced in app code, not by RLS.**
- `get_current_tenant()` decodes the JWT → `(user_id, org_id, role)`.
- **Every protected route depends on it, and every query filters by `org_id`.** Single-resource reads filter by **both `org_id` and `id`** (IDOR guard).
- RLS policies still exist in the migrations as **defense-in-depth**.
- `require_role("admin")` gates admin-only routes (invite code, member roster). Two roles: **Admin** (manages workspace, invites) vs **Analyst** (creates/views research).

**How we keep the invariant honest:** a **static guard test** (`tests/test_tenant_scoping.py`) parses the route files and **fails CI if any query against a tenant table lacks an `org_id` filter.** The isolation rule is enforced mechanically, not by discipline — and it has its own named step in the CI pipeline so a leak is unmissable.

**Interview line:** *"The single highest-risk mistake in this codebase is a route that reads tenant data without scoping by org_id — so I made a test that fails the build if anyone ever writes one."*

---

## 5. Architecture & code quality (rubric 20%)

- **Clean separation:** `core / routes / services / tools / models`; one file per data tool, each returning JSON-serializable data with a `source` field.
- **Config & secrets:** all via env (`pydantic-settings`); `.env.example` committed in both apps, real `.env` gitignored.
- **Logging:** structured logger in `core/`.
- **Docs as deliverables, kept current:** `docs/ARCHITECTURE.md` (6 Mermaid diagrams — system, data-flow sequence, ER, AI orchestration, multi-tenant isolation, + API table) and `docs/DECISIONS.md` (7 ADRs answering every required question).
- **Commit history:** frequent, focused, meaningful messages (graded).

---

## 6. Bonus points addressed

| Bonus | Status |
|---|---|
| Docker Compose one-command setup | ✅ `docker-compose up` runs frontend + backend. |
| Testing | ✅ pytest: chunker, sentiment, agent tool-routing (mocked LLM), tenant scoping. |
| CI/CD | ✅ GitHub Actions: ruff lint, tenant-isolation guard, pytest, tsc, build, secret scan (gitleaks). |
| Caching & rate limiting | ✅ In-process TTL cache (`core/cache.py`) on repeated fetches. |
| Live deployment | ⏳ Configured (render.yaml, vercel.json); needs live accounts + keys to go live. |
| SSE streaming, PDF export, observability | ✗ Deferred — named in DECISIONS.md future-work. |

---

## 7. Trade-offs we made for 5 days (be ready to defend each)

| Trade-off | Why it's the right call at this scale | Upgrade path |
|---|---|---|
| **Lexicon sentiment**, not an LLM/VADER pass | Fast, keyless, good enough for the demo. | Swap in VADER or an LLM sentiment call. |
| **Service-key + app-code isolation** (RLS as backup), not user-JWT pure-RLS | Simpler; the guard test keeps it honest. | Pass the user JWT to Supabase for native RLS enforcement. |
| **In-process TTL cache**, not Redis | Fine for one Render instance. | Redis when horizontally scaled. |
| **Synthetic SEC excerpts**, not full EDGAR | Keeps the vector store small and the repo clean. | Real EDGAR ingestion + reranking. |
| **Vite SPA**, not Next.js | App is auth-walled; no SEO need. | — (deliberate, not debt). |

**What I'd add with 2 more weeks:** SSE streaming of the plan→fetch→synthesize steps; real EDGAR ingestion + reranking; LLM/VADER sentiment; per-org usage limits + Redis; PDF/CSV export; broader tests + Playwright E2E; structured observability.

**Hardest part:** getting tenant isolation *provably* right given the service key bypasses RLS. Resolved by enforcing `org_id` in the dependency, keeping RLS as defense-in-depth, and adding the static guard test that fails CI on any unscoped query.

---

## 8. The three demo workflows (required live)

1. **Core AI feature** — type a multi-company research query; watch the router plan, parallel tool fetch, and structured result render with citations.
2. **Multi-tenant isolation** — log in as Acme Capital, then Beacon Partners (seeded by `scripts/seed.py`); show each sees only its own reports.
3. **RBAC** — show an Admin can open Members + reveal the invite code; an Analyst cannot.
