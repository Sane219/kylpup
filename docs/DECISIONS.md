<p align="center">
  <img src="../LOGO.png" alt="Klypup" width="240">
</p>

# Decisions

Concise ADRs for the Klypup Applied-AI assessment. Challenge chosen: **Investment Research Dashboard**.

## 1. Which challenge and why
There was one challenge (Investment Research Dashboard). It's a strong fit: the AI is a genuine *feature inside a product* — agentic tool orchestration over real financial data, rendered as structured UI — rather than a chatbot. It exercises full-stack breadth (auth, multi-tenancy, CRUD, charts) and AI depth (routing, parallel tools, structured output, citations) at once.

## 2. Tech stack and alternatives
| Layer | Chosen | Alternatives considered | Why |
|---|---|---|---|
| Frontend | React + Vite + TS + Tailwind + Recharts | Next.js | App is auth-walled (no SEO need); a Vite SPA is lighter and deploys free on Vercel. Next.js RSC would add complexity we don't use. |
| Backend | FastAPI (async Python) | Node/Express | Python gives `yfinance` + first-class LLM/embedding SDKs; async fits parallel tool calls. |
| DB + vectors + auth | Supabase (Postgres + pgvector + Auth) | separate Pinecone + Auth0 | One free service covers relational data, JWT auth, *and* the vector store — fewer moving parts in 5 days. |
| LLM | Gemini 2.0 Flash (primary), Groq Llama-3 (fallback) | OpenAI | Both free; Gemini has native JSON mode + large free tier. Wrapped behind one module so the swap is one line. |
| Market / News | `yfinance` / `duckduckgo-search` | Alpha Vantage / NewsAPI | Free, no keys, and crucially **not IP-blocked on cloud hosts** (NewsAPI blocks Render's IPs on free tier). |

## 3. Multi-tenancy approach
Pattern: **`org_id` column + tenant middleware** (shared multi-tenant), not schema-per-tenant — simplest correct pattern for the scale. A FastAPI dependency (`get_current_tenant`) verifies the Supabase JWT and reads `org_id`/`role` from its `app_metadata` (server-controlled, not user-editable), so isolation needs no extra per-request DB lookup. **Every query filters by `org_id`; single-resource ops filter by both `org_id` and `id` (IDOR guard).**

Key subtlety: the backend uses Supabase's **service key, which bypasses Row-Level Security** — so isolation is enforced in app code. RLS policies are still defined as **defense-in-depth**. A guard test (`tests/test_tenant_scoping.py`) statically fails if any route queries a tenant table without an `org_id` filter. RBAC: `require_role("admin")` gates admin-only routes (invite code, member roster); analysts create/view research.

## 4. AI integration & prompt engineering
Two-call agentic flow (`services/agent.py`):
1. **Router** LLM → JSON execution plan choosing tools per query. Not hardcoded — a news-only query skips market + filings (unit-tested).
2. Selected tools run **concurrently** (`asyncio.to_thread` + `gather`); one tool failing degrades gracefully instead of failing the request.
3. **Synthesizer** LLM → strict structured UI JSON (`company_cards`, `comparison_table`, `news_sentiment`, `filing_insights`, `risks`, `sources_used`), every item carrying a `citation`.

Prompt-engineering decisions: schema-first; **API-native JSON mode** (Gemini `response_mime_type`, Groq `json_object`) instead of "respond only in JSON" hacks; low temperature (0.2); explicit grounding rule "use ONLY the provided tool data, do not invent numbers." Provider abstraction retries twice, then fails over Gemini↔Groq.

RAG: 4 sample SEC filings → 1000-char overlapping chunks → Gemini `text-embedding-004` (768-dim) → pgvector with an IVFFlat cosine index and a `match_filing_chunks` RPC. The KB is shared reference data (no `org_id`).

## 5. Trade-offs given 5 days
- Lexicon sentiment instead of a model/LLM pass — fast, good enough for the demo; upgrade path noted in code.
- Service-key + app-code isolation (with RLS as backup) instead of passing the user JWT to Supabase for pure-RLS enforcement — simpler, and the guard test keeps it honest.
- In-process TTL cache, not Redis — fine for one Render instance.
- Synthetic SEC excerpts, not full filings — keeps the vector store small and the repo clean.
- Email confirmation disabled on signup for demo simplicity.

## 6. What I'd add with 2 more weeks
SSE streaming of the planning→fetching→synthesizing steps; real SEC EDGAR ingestion + reranking; LLM/VADER sentiment; per-org usage limits + Redis cache; report PDF/CSV export; broader test coverage + Playwright E2E; structured logging/observability.

## 7. Hardest part
Getting tenant isolation *provably* right given that the Supabase service key bypasses RLS. The resolution: enforce `org_id` scoping in the FastAPI dependency, keep RLS as defense-in-depth, and add a static guard test that fails CI if any route forgets the filter — so the invariant is enforced mechanically, not by discipline.

## Operational notes / deferred (not blockers)
- Render free tier cold-starts ~50s after idle.
- Live run needs a Supabase project + Gemini/Groq keys: run `migrations/001_init.sql` + `002_filings.sql`, set `backend/.env`, then `python scripts/seed.py` and `python scripts/ingest.py`.
