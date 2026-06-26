# walkthrough.md — Spoken Presentation Script

For the Klypup interview: **15-min walkthrough + 15-min live demo + 10-min Q&A.** Lines in *italics* are what to say; **bold** notes are what to show or do. Timings are targets, not a stopwatch.

---

## PART 1 — Walkthrough (15 min)

### 0:00 – 1:30 · Frame the problem
> *"Research analysts spend days per company — pulling prices off a terminal, reading dozens of news articles, combing SEC filings. By the time it's compiled, the market's moved. I built a tool where an analyst types one natural-language question and gets back a structured, source-attributed analysis in minutes."*
>
> *"The brief's framing stuck with me: AI as a feature inside a real product, not a chatbot. So everything I'll show has auth, persistence, multi-tenancy — and the AI is one well-integrated piece of it."*

**Show:** the dashboard landing page.

### 1:30 – 4:00 · The architecture in one breath
**Show:** `docs/ARCHITECTURE.md` system diagram.
> *"Three pieces. A React/Vite SPA on Vercel. A FastAPI backend on Render. And Supabase — which is doing triple duty: Postgres, the pgvector store, and the auth provider. One free service instead of three."*
>
> *"The one rule the whole design hangs on: the browser never calls an LLM or a financial API directly. Every external call and every secret lives in the backend. The frontend only ever talks to my API."*
>
> *"Why this stack? Python backend because yfinance and the embedding SDKs are first-class there, and async fits the parallel tool calls I'll show in a second. A Vite SPA not Next, because the app is entirely auth-walled — there's no SEO to gain from server rendering, so the lighter option wins."*

### 4:00 – 8:00 · The AI layer (spend the most time here — 25% of the grade)
**Show:** `backend/app/services/agent.py`, then the AI-orchestration diagram.
> *"This is the heart of it, and it's deliberately not a chat loop. It's two LLM calls with deterministic execution in between."*
>
> *"Call one is the **router**. The natural-language query goes in, and the model returns a JSON plan — which tickers, and which of the three tools to run: market data, news, filings. The model decides. If you only ask about news, it doesn't call the price API. Nothing's hardcoded."*
>
> *"Then **I** execute that plan — not the model. The selected tools run concurrently with asyncio.gather. And critically, one tool failing doesn't fail the query — I gather with return_exceptions, so a dead news feed just means the news section degrades, the rest still renders."*
>
> *"Call two is the **synthesizer**. Raw tool outputs go back to the model, and it returns strict structured JSON — company cards, a comparison table, news with sentiment, filing insights, risks, a summary. Every single item carries a citation. Source attribution is a graded requirement and it's enforced end to end."*
>
> *"Two prompt-engineering choices I'll call out: I use the providers' native JSON mode — Gemini's response schema, Groq's json_object — instead of begging the model to 'respond only in JSON.' The platform guarantees the shape. And I pin a grounding rule: use only the provided tool data, don't invent numbers."*

**Show (briefly):** `services/llm.py`.
> *"LLM access is behind one module. Gemini is primary, Groq is the fallback — it retries twice, then fails over. Swapping provider is a one-line env change."*

### 8:00 – 10:30 · The RAG pipeline
**Show:** `backend/scripts/ingest.py` + `migrations/002_filings.sql`.
> *"The filings tool is real retrieval, and I made the pipeline explicit rather than hiding it. Sample filings get chunked into 1000-character overlapping windows, embedded with Gemini's text-embedding-004 at 768 dimensions, and stored in pgvector with an IVFFlat cosine index. Search goes through a Postgres RPC. The filings are public reference data, so they're shared — not scoped to a tenant."*

### 10:30 – 14:00 · Multi-tenancy (the part graders probe hardest)
**Show:** `backend/app/core/auth.py` + the multi-tenant isolation diagram.
> *"Multi-tenancy is where I want to be most precise, because there's a subtlety. My backend uses Supabase's service key — and the service key bypasses Row-Level Security. So I can't rely on RLS as my isolation boundary. Isolation has to live in app code."*
>
> *"Here's how. Every protected route depends on get_current_tenant, which decodes the JWT and returns user, org, and role. The org_id and role live in the JWT's app_metadata — that's server-controlled, the user can't edit it. And every query filters by org_id. Single-resource reads filter by org_id AND id, so you can't guess another org's report ID — that's the IDOR guard."*
>
> *"RLS policies still exist in the migrations, as defense-in-depth. But here's the part I'm proudest of:"*

**Show:** `tests/test_tenant_scoping.py`.
> *"This is a static test that parses my route files and fails the build if any query against a tenant table is missing an org_id filter. The isolation invariant is enforced mechanically, not by my discipline. It's even its own named step in CI, so a leak is impossible to miss."*
>
> *"RBAC is two roles — Admin manages the workspace and invites users; Analyst creates and views research. require_role gates the admin routes."*

### 14:00 – 15:00 · Engineering rigor, quick
> *"Quickly on quality: clean layered structure — core, routes, services, tools, models. Docker Compose for one-command local run. pytest on the core logic. GitHub Actions running lint, the tenant guard, tests, typecheck, build, and a secret scan. In-process caching on repeated fetches. And ARCHITECTURE and DECISIONS are kept current — they're deliverables, not afterthoughts."*
>
> *"Now let me show it running."*

---

## PART 2 — Live demo (15 min)

> Demo the three required workflows in this order. Have two browser profiles / windows pre-logged-in to the two seeded orgs to save time.

### Workflow 1 — The core AI feature (~7 min)
**Do:** From the Research page, type a real multi-company query:
> *"Compare NVIDIA, AMD, and Intel — revenue growth, recent news sentiment, and key risks."*

**Narrate while it runs:**
> *"Watch the flow: it's routing the query, deciding it needs all three tools for three tickers, fetching market and news in parallel and searching filings, then synthesizing."*

**When it renders, point at each block:**
> *"Company cards with live metrics. A comparison table. News with positive/negative/neutral sentiment badges. Filing insights. A risk section and a summary. And every block shows its source — this number came from yfinance, this insight from this filing chunk."*

**Then show graceful degradation if you can:**
> *"If one tool times out, that section shows a soft error and the rest still renders — the query never hard-fails."*

### Workflow 2 — Multi-tenant isolation (~4 min)
**Do:** Show you're logged in as **Acme Capital** → open Reports → note the saved reports. Switch to the **Beacon Partners** window → Reports.
> *"Different org, completely separate data. Acme's research does not exist in Beacon's workspace. Same database, same tables — isolation is the org_id scoping I showed, on every query."*

*(Optional, if asked to prove it:)* **Do:** try hitting a known Acme report ID while authed as Beacon → 404.
> *"Guessing the ID gets you a 404, not the data — that's the IDOR guard."*

### Workflow 3 — RBAC (~4 min)
**Do:** As the **Admin**, open the Members page → show the roster and reveal/copy the invite code.
> *"Admin manages the workspace and can invite users via this code."*

**Do:** Log in as an **Analyst** → show Members is not accessible.
> *"The Analyst can run research and view reports, but the admin surface is gated — enforced in the API with require_role, not just hidden in the UI."*

---

## PART 3 — Q&A prep (10 min) — likely questions + crisp answers

**"Why enforce isolation in app code instead of RLS?"**
> *"Because my backend uses the service key, which bypasses RLS by design — that's what lets it do admin operations. So RLS can't be my primary boundary. I enforce org_id scoping in the FastAPI dependency, keep RLS as defense-in-depth, and back it with a static test that fails CI on any unscoped query."*

**"What if the LLM returns malformed JSON?"**
> *"I use native JSON mode, so the shape is guaranteed by the provider, not by prompt text. On top of that the provider wrapper retries twice and then fails over to the second provider. And tool failures are isolated — one bad tool degrades one section, it doesn't crash the request."*

**"Your sentiment is a lexicon — why not an LLM?"**
> *"Deliberate 5-day trade-off. It's keyless, instant, and good enough to demo the feature. The upgrade path is a VADER or LLM pass, and it's a drop-in swap because sentiment is isolated in the news tool."*

**"How does the agent decide which tools to call?"**
> *"The router LLM call returns a JSON plan with booleans per tool. I only execute what it selects. A news-only question never touches the price API. That's the 'not a hardcoded sequence' requirement."*

**"Why Supabase over Postgres + Pinecone + Auth0?"**
> *"One free service covers relational data, the vector store, and JWT auth. In a 5-day build, fewer moving parts and one set of credentials beats best-of-breed-but-three-integrations."*

**"What broke or surprised you?"**
> *"NewsAPI blocks Render's free-tier IPs — so I moved to DuckDuckGo search, which is keyless and isn't blocked. And the hardest design problem was proving tenant isolation given the service key bypasses RLS; the static guard test is how I made that provable instead of hopeful."*

**"What would you do with two more weeks?"**
> *"SSE streaming of the plan→fetch→synthesize steps so the user sees progress live; real EDGAR ingestion with reranking; LLM-based sentiment; per-org rate limits with Redis; and PDF export of reports."*

**"Did you write all this yourself / can you explain it?"**
> *"Assisted-first, as encouraged — but every decision here is mine and I can walk any file. The architecture, the two-call flow, the isolation strategy, the trade-offs — those are the parts that matter and the parts I can defend."*

---

## Pre-flight checklist (do before you present)

- [ ] Backend + frontend running (`docker-compose up`); both reachable.
- [ ] Seed + ingest already run — reports, watchlist, and filing chunks populated.
- [ ] Two orgs logged into two windows/profiles (Acme admin, Beacon — plus one Analyst).
- [ ] One research query pre-tested end-to-end so you know it returns cleanly on the venue's network.
- [ ] `ARCHITECTURE.md` diagrams open in tabs (system, AI orchestration, multi-tenant).
- [ ] `agent.py`, `auth.py`, `test_tenant_scoping.py` open in the editor, ready to show.
- [ ] Gemini/Groq keys valid and not rate-limited; confirm a fresh query works minutes before.
- [ ] Backup: a screen-recording of a successful query in case the venue network or an API is flaky.
