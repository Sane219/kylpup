<p align="center">
  <img src="../LOGO.png" alt="Klypup" width="240">
</p>

# Architecture Decision Records

Concise ADRs documenting the decision journey for the Klypup Applied-AI assessment.
Challenge chosen: **Investment Research Dashboard (Option A)**.

> Each ADR records what was decided, what alternatives were researched, and why. The research notes capture what was learned during the evaluation — not all paths led to the chosen solution.

---

## ADR-001: Challenge Selection

### Context
The assessment offered one challenge: build an Investment Research Dashboard where an analyst types a natural-language query and gets structured, sourced market intelligence back.

### Decision
Accept the Investment Research Dashboard challenge.

### Research Notes
The challenge description emphasizes that the AI must be a *genuine feature inside a product* — routing over real data tools, returning structured UI state — not a chatbot bolted onto a CRUD app. This was the deciding factor: it exercises full-stack breadth (auth, multi-tenancy, CRUD, charts) and AI depth (routing, parallel tools, structured output, citations) at once.

The alternative would have been to decline, but there was only one option, and the problem statement aligned well with the AI-assessment format.

### Rationale
- The AI is embedded in a real product flow: query → tools → structured results → saved reports
- Covers both the "can build a full-stack app" and "can integrate LLMs responsibly" axes
- Source attribution requirement forces grounded architecture, not a free-text chatbot

---

## ADR-002: Tech Stack Selection

### Context
Choose the frontend framework, backend runtime, database, vector store, and authentication provider. Must be deployable at zero cost, require no paid API keys, and be completable within 5 days.

### Research Notes

**Frontend:**
| Option | Pros | Cons |
|--------|------|------|
| React + Vite + TS | Lightweight, fast builds, Vercel free tier, HMR | Need to wire routing and auth manually |
| Next.js | SSR, bundle splitting, Vercel-native | Overkill for an auth-walled SPA; RSC complexity |
| SvelteKit | Fast, simple | Smaller ecosystem; team has less Svelte experience |
| Vue/Nuxt | Good DX | Less relevant for the target ecosystem |

**Backend:**
| Option | Pros | Cons |
|--------|------|------|
| FastAPI (Python) | Async support, native Pydantic, great for parallel tool calls | GIL limits CPU-heavy work |
| Node/Express | Familiar, fast iteration | yfinance is Python-only; LLM SDKs are better in Python |
| Go | Fast, good concurrency | Longer ramp; fewer ML library bindings |
| Flask | Simple, well-known | Synchronous — would need hacks for parallel tool calls |

**Database + Auth + Vectors:**
| Option | Pros | Cons |
|--------|------|------|
| Supabase (Postgres + pgvector + Auth) | Single service for everything; generous free tier; JWT auth built-in | Service-key pattern requires discipline for tenant isolation |
| Neon + Auth0 | Good Postgres | Two services to manage; Auth0 has a learning curve |
| Pinecone + Cognito | Purpose-built vector search | Expensive; Cognito is painful to configure |
| PlanetScale + Clerk | Solid DB | No vector support; Clerk costs scale |

**LLM Provider:**
| Option | Pros | Cons |
|--------|------|------|
| Gemini 2.5 Flash | Free tier (1500 req/day); native JSON mode; thinking mode | Google Cloud SDK can be verbose |
| Groq Llama 3.3 70B | Fast inference; free tier | JSON mode exists but less mature; no embedding API |
| OpenAI GPT-4o-mini | Best-in-class | Free credits expire; costs money long-term; rate limits |
| Claude (AWS Bedrock) | Quality | Requires AWS setup; no free tier |

**Market Data:**
| Option | Pros | Cons |
|--------|------|------|
| yfinance | Free, no API key, well-maintained | Informal (scrapes Yahoo Finance); may break without notice |
| Alpha Vantage | Free tier (5 req/min, 500/day) | Hit limits fast with a polling dashboard |
| Financial Modeling Prep | 250 req/day free | Very limited |
| Polygon.io | Reliable | $29/month minimum |

**News:**
| Option | Pros | Cons |
|--------|------|------|
| DuckDuckGo News (duckduckgo-search) | Free, no key, works from cloud IPs | No sentiment API — must build our own |
| NewsAPI | Good coverage | Blocked on Render's free tier IPs (confirmed via forum posts) |
| Finnhub | Free tier | Very limited news coverage |
| Yahoo Finance news (yfinance) | Already have yfinance | yfinance news is unreliable |

### Decision
| Layer | Chosen | Key Driver |
|-------|--------|------------|
| Frontend | React + Vite + TS + Tailwind | Right-sized: auth-walled SPA, no SSR needed, free Vercel deploy |
| Backend | FastAPI (Python) | Async parallel tool calls + Python's LLM & data SDK ecosystem |
| DB + vectors + auth | Supabase (all-in-one) | One free service covers Postgres, pgvector, and JWT auth |
| LLM | Gemini (primary) + Groq (fallback) | Both free; native JSON mode; failover gives resilience |
| Market data | yfinance | Free, no key, works from cloud |
| News | DuckDuckGo + built-in lexicon sentiment | Free, works from Render, lightweight |

---

## ADR-003: Multi-Tenancy Isolation Strategy

### Context
Multiple organizations must be isolated. The backend uses Supabase's service-role key (which bypasses Row-Level Security). How do we prevent org A from seeing org B's data?

### Research Notes

**Option 1: Pure RLS (pass user JWT to Supabase)**
- The cleanest Supabase pattern: set `Authorization: Bearer <user_jwt>` on every DB request
- RLS policies filter by `auth.uid()` → `org_id`
- Problem: the research agent needs admin-level access to call `auth.admin.create_user()` during signup and access the `filing_chunks` table (shared reference data, no org_id). Switching between service-key and user-JWT mid-request is error-prone.

**Option 2: Service key + app-code isolation**
- Backend always talks to Supabase with the service key
- Tenant extraction happens in a FastAPI dependency (`get_current_tenant()`)
- Every query must manually filter by `org_id`
- Risk: a developer forgets to filter → data leak. Mitigation: static guard test.

**Option 3: Schema-per-tenant**
- A separate Postgres schema per organization
- Strongest isolation at the database level
- Problem: Supabase doesn't manage per-tenant schemas easily; migrations become complex. Overkill for this scale.

**Option 4: Hybrid**
- Use service key for auth operations and filing search (shared data)
- Use user JWT for tenant-scoped queries
- Problem: two authentication paths in the same codebase, confusing to maintain

### Decision
**Option 2: Service key + app-code isolation**, with RLS as defense-in-depth.

### Rationale
- The research agent flow needs mixed access levels (admin auth ops + org-scoped reads + shared filing KB reads)
- A single authentication path (service key everywhere) is simpler to reason about
- A static guard test (`tests/test_tenant_scoping.py`) scans route files with regex — if any `.table("tenant_table")` call lacks `.eq("org_id", ...)` in the chain, CI fails
- RLS policies on every table provide a second layer of defense

```
Static guard test logic:
  For each route file:
    for each .table("research_reports|watchlist|users|audit_logs|organizations"):
      assert ".eq(\"org_id\"" in the call chain
    if not found → test fails → CI blocks the PR
```

---

## ADR-004: AI Agent Architecture

### Context
Design the LLM integration. How many LLM calls? Should tools be hardcoded or model-selected? How does the system handle partial failures?

### Research Notes

**Architecture patterns evaluated:**

| Pattern | Pros | Cons | Used by |
|---------|------|------|---------|
| Single LLM call, prompt includes tool data | Simple, one round-trip | Prompt becomes enormous; hard to iterate; no reasoning visibility | Naive RAG systems |
| Router → tools → synthesizer (2 calls) | Clean separation of concerns; tools are model-selected; structured output | Two LLM round-trips = ~2-3s latency | Agent frameworks (LangChain, Vercel AI SDK) |
| Router → tools → synthesizer → critic → refine (3-4 calls) | Self-correcting; higher quality output | More latency; more LLM costs | Advanced agent systems |
| ReAct loop (multi-turn reasoning + tool calls) | Flexible; can handle multi-step reasoning | Complex; hard to bound; streaming is hard | AutoGPT, BabyAGI |

**Tool selection: hardcoded vs model-selected:**
- Hardcoded: always call all tools → wasteful when user only asks about one dimension
- Model-selected: router picks tools → efficient, flexible, unit-testable

**Parallel execution:**
- Python `asyncio.to_thread` + `asyncio.gather` for three tools
- One tool failing should not fail the query (graceful degradation)
- `asyncio.as_completed` for streaming status updates

**Streaming:**
- Synchronous: wait for everything, return one JSON blob — simple but no UX feedback
- NDJSON stream: yield events as the agent works (plan → tool running → tool done → synth → result) — better UX but more complex

### Decision
**Two-LLM-call agentic flow** (router + synthesizer) with optional critique/refine, model-selected tools, parallel execution with graceful degradation, and NDJSON streaming.

### Rationale
- Router and synthesizer have completely different prompts and responsibilities — mixing them into one call would hurt quality
- Model-selected tools are more efficient than always calling all three
- Graceful degradation via `return_exceptions=True` in `asyncio.gather` + `as_completed` for streaming
- The critique/refine loop is optional — a solid first pass skips it, saving latency
- NDJSON streaming lets the UI show progress (agent timeline) instead of a spinner

```
LLM Call 1 (Router):
  Input:  user query
  Output: {companies, fetch_market, fetch_news, search_filings, filing_query, reasoning}
  Cost:   ~300 tokens

  ↓

Parallel Tools (selected by router):
  market.get_quotes(tickers)     → [{ticker, price, pe_ratio, ...}]
  news.get_news_multi(tickers)   → {ticker: [{title, sentiment, ...}]}
  filings.search_filings(query)  → [{ticker, excerpt, source_ref, similarity}]

  ↓

LLM Call 2 (Synthesizer):
  Input:  {query, tool_data}
  Output: {summary, key_takeaways, company_cards[], news_sentiment[],
           filing_insights[], opportunities[], risks[], outlook, sources_used}
  Cost:   ~2000-4000 tokens

  ↓ (optional)

LLM Call 3 (Critic):
  Input:  {query, draft, tool_data}
  Output: {issues[], needs_revision}

  ↓ (conditional)

LLM Call 4 (Refine):
  Input:  {query, tool_data, prior_draft, editor_feedback}
  Output: Revised ResearchData JSON
```

---

## ADR-005: Embedding Model and Vector Store

### Context
Build a small SEC filing knowledge base for the RAG tool. The sample set is 4 filings (~60 chunks). Need to choose the embedding model, vector store, indexing strategy, and chunking approach.

### Research Notes

**Embedding models:**
| Model | Dimensions | Free tier | Notes |
|-------|-----------|-----------|-------|
| Gemini text-embedding-001 | 3072 | Yes (1500 req/day) | Used through Google AI Studio; good quality |
| OpenAI text-embedding-3-small | 1536 | No (pay per token) | Best quality but costs |
| BGE-small (local) | 384 | Yes (local) | Lower quality, no API dependency |
| sentence-transformers (local) | 384-768 | Yes (local) | Heavy to run on Render free tier |

**Vector stores:**
| Option | Pros | Cons |
|--------|------|------|
| pgvector on Supabase | Same DB, no extra service; IVFFlat + HNSW indexes | Limited to 768 dims with IVFFlat (depending on PG version) |
| Pinecone | Purpose-built; handles high-dim vectors | Free tier limits; extra service to manage |
| Chroma (local, in-process) | Simple | State doesn't persist across deploys on Render |
| Weaviate on Supabase | Supabase-native | Still in alpha at time of evaluation |

**Chunking strategies:**
| Strategy | Pros | Cons |
|----------|------|------|
| Fixed character window + overlap | Simple, deterministic | May split in the middle of a sentence |
| Recursive character split | Respects paragraph/sentence boundaries | More complex |
| Semantic chunking (LLM-based) | Best quality | Slow, expensive, overkill for 4 filings |

### Decision
**Gemini text-embedding-001** → **pgvector** with IVFFlat cosine index → **1000-char chunks with 150-char overlap**.

### Rationale
- Gemini embedding is free and used through the same provider as the LLM — one auth path
- pgvector keeps everything in Postgres — no new service to configure
- IVFFlat with 10 lists is appropriate for a KB of <1000 vectors (HNSW only needed at scale)
- The chunking strategy is simple and works for the filing format (numbered sections, paragraph structure)
- The `match_filing_chunks` RPC is a parameterized SQL function that the `filings` tool calls via Supabase's `.rpc()`

---

## ADR-006: News Sentiment Approach

### Context
The research agent needs to surface news sentiment. Options range from a simple keyword classifier to an LLM-based pass.

### Research Notes

**Approaches evaluated:**

| Approach | Accuracy | Cost | Latency | Maintenance |
|----------|----------|------|---------|-------------|
| Lexicon (word lists) | Low (~60-70%) | Zero | ~0.1ms | Manual word list updates |
| VADER (NLTK) | Medium (~75%) | Zero | ~1ms | Pretrained, general-purpose |
| LLM-based (prompt "is this positive?") | High (~90%) | 100-500 tokens/article | ~500ms/article | High quality but costly at scale |
| Fine-tuned classifier | Highest (>95%) | Training + inference | ~10ms | Needs labeled data |

### Decision
**Lexicon-based sentiment** (word lists in `tools/news.py`).

### Rationale
- At evaluation time, the news tool runs for at most 6 articles × 2-3 tickers = 12-18 articles per research query
- An LLM pass would add ~$0.001-0.003 per query and ~2-5s latency — not worth it for a demo
- VADER was considered but requires the `nltk` package (100MB+ download on Render)
- The lexicon handles the core use case: detecting clear positive ("surge", "record", "beat") and negative ("miss", "lawsuit", "plunge") signals
- Upgrade path is documented in a `ponytail:` comment: drop-in replace `_sentiment()` with VADER or an LLM call when accuracy matters

```
# ponytail: swap _sentiment for VADER or an LLM pass if accuracy matters

Positive words:  {surge, beat, beats, growth, record, profit, gain, gains,
                  upgrade, bullish, soar, strong, rally, rises, rose, jump}
Negative words:  {miss, misses, loss, drop, fall, falls, fell, decline,
                  downgrade, bearish, plunge, weak, lawsuit, probe, cuts, slump}

Score: (pos_count - neg_count) / (pos_count + neg_count)
Label: positive if score > 0, negative if score < 0, neutral if tie or 0
```

---

## ADR-007: Frontend State Management for Live Prices

### Context
The dashboard needs a live-updating market ticker that feels alive. Real yfinance data updates infrequently (polls every 60s). How do we make it feel live without hammering the backend?

### Research Notes

**Approaches:**

| Approach | Pros | Cons |
|----------|------|------|
| Poll backend every 1s | Feels very live | 16 API calls/min × 60 mins = 960 calls/hour; yfinance rate limits |
| WebSocket push from backend | Real-time | Complexity; yfinance doesn't support WebSocket for free |
| Poll every 60s + cosmetic jitter | Low API load; feels alive between refreshes | Prices are not real between polls |
| Poll every 60s, no jitter | Honest about delayed data | Ticker looks frozen for 59 out of 60 seconds |
| Server-Sent Events | Real-time push | yfinance doesn't change fast enough to justify |

### Decision
**60s poll + cosmetic jitter** using `useSyncExternalStore`.

### Rationale
- Real yfinance data refreshes every 60s via `GET /market/snapshot`
- Between refreshes, a 1.2s timer (`tick()`) applies ±0.06% random jitter with mean-reversion toward the last real price
- The `dir` field tracks whether the last change was up or down, enabling the CSS flash animation
- The `key={q.price}` React pattern remounts the element on price change, restarting the flash animation
- Users with `prefers-reduced-motion: reduce` get no jitter, respecting accessibility

```
Data flow:
  ┌──────────┐    60s     ┌──────────────┐   real prices   ┌──────────┐
  │ yfinance  │ ───────→  │ Snapshot API  │ ─────────────→  │  Store   │
  │ (backend) │           │ (cached 120s) │                 │ (merged) │
  └──────────┘           └──────────────┘                 └────┬─────┘
                                                              │
                                               ┌──────────────┘
                                               ▼
                                        ┌──────────────┐
                                        │  tick()       │
                                        │  every 1.2s   │
                                        │  ±0.06% jitter│
                                        │  + mean-revert│
                                        └──────┬───────┘
                                               │
                                               ▼
                                        ┌──────────────┐
                                        │  React       │
                                        │  re-render   │
                                        │  flash anim  │
                                        └──────────────┘
```

---

## ADR-008: Caching Strategy

### Context
External API calls (yfinance, DuckDuckGo, Gemini) are rate-limited and/or slow. We need caching but don't want to add infrastructure.

### Research Notes

| Option | Pros | Cons |
|--------|------|------|
| In-process dict + TTL | Zero deps, simple, fast | Lost on restart; not shared across instances |
| Redis (Render add-on) | Shared, persistent, fast | $20+/month on Render; overkill for one instance |
| Supabase as cache | Persistent, shared across instances | 100ms+ latency per query; defeats the purpose |
| `lru_cache` on each function | Zero deps, built-in | No TTL control — cache lives forever |

### Decision
**In-process TTL dict** via a custom `@ttl_cache(seconds)` decorator.

### Rationale
- On Render's free tier there's only one instance — no sharing needed
- Cache is lost on restart (new deploy) which is acceptable — the first request after deploy fetches fresh data
- TTLs are set per function: 300s for market quotes (yfinance is slow), 120s for compact quotes (faster refresh needed for live tape), 600s for news (doesn't change rapidly)
- Upgrade path: swap `_store` dict for Redis client when multi-instance or persistence is needed (documented in `ponytail:` comment)

```
Cache TTLs:
  get_quote()      → 300s (5 min)  — full financial data
  quote_compact()  → 120s (2 min) — light quote for dashboard
  get_news()       → 600s (10 min)— recent news doesn't change fast
```

---

## ADR-009: Response Envelope and Error Handling

### Context
The frontend and backend need a consistent contract for success and error responses. The frontend's `api()` wrapper expects a `{data}` envelope.

### Research Notes

**Patterns considered:**

| Pattern | Structure | Pros |
|---------|-----------|------|
| Envelope (always wrapped) | `{data: ..., meta: {}}` / `{error: {code, message, details}, meta: {}}` | Frontend always parses the same shape |
| Bare response | `{...}` directly for success, `{"detail": "..."}` for errors | Simpler but inconsistent |
| HTTP status + body | Status code indicates success/failure, body is the resource | Standard REST, but error body format varies |

### Decision
**Always-envelope pattern** with a custom `install_error_handlers()`.

### Rationale
- Every response, success or error, has a `meta.request_id` for debugging
- The `api()` frontend wrapper always expects `body.data` — no conditional parsing
- `install_error_handlers()` registers three handlers: `StarletteHTTPException` → structured `_err()`, `RequestValidationError` → 400 with validation details, and a catch-all `Exception` → 500 with logging
- The catch-all handler uses `log.exception()` so full tracebacks are captured in Render logs even though the API response only says "something went wrong"

---

## ADR-010: Streaming Strategy for Research API

### Context
The research agent takes 5-15 seconds. A loading spinner is poor UX. We need to show progress.

### Research Notes

| Option | Pros | Cons |
|--------|------|------|
| NDJSON over HTTP POST | Simple, works with standard `fetch()` streaming; no special server config | Requires manual line-by-line parsing in JS |
| Server-Sent Events (SSE) | Browser-native `EventSource` API | Only supports GET requests; can't send POST body |
| WebSocket | Bidirectional, real-time | Complex; requires WebSocket server config on Render |
| Polling (client polls status endpoint) | Simple | Creates write contention (agent writes status, client reads it) |
| Long-polling | Simpler than WebSocket | Inefficient; complex timeout handling |

### Decision
**NDJSON stream** over HTTP POST (`POST /research/stream`, response type `application/x-ndjson`).

### Rationale
- NDJSON works with standard `fetch()` + `ReadableStream` — no special browser APIs needed
- POST method allows sending the query in the request body
- Each line is a self-contained JSON event with a `type` field
- The frontend reads the stream chunk by chunk, splits on newlines, and updates the agent timeline in real time
- If streaming fails mid-way, the error event is the last line — the frontend shows the partial result

```
Event sequence:
  ┌────────┐    ┌──────────┐    ┌──────────────┐    ┌────┐
  │ Status  │ →  │ Plan     │ →  │ Tool events   │ →  │ …  │ →  │ Result │ →  │ Saved │
  │ stage:  │    │ type:    │    │ per tool:     │    │    │    │ type:  │    │ type:  │
  │ routing │    │ plan     │    │ running/done  │    │    │    │ result │    │ saved  │
  └────────┘    └──────────┘    └──────────────┘    └────┘    └────────┘    └────────┘
```

---

## ADR-011: Database Migrations and Seeding

### Context
The database schema needs to evolve across phases. We need a migration strategy and demo data seeding.

### Research Notes

**Migration approaches:**
| Option | Pros | Cons |
|--------|------|------|
| Raw SQL files in `migrations/` | Simple, auditable, version-controlled | Manual application via Supabase SQL editor |
| Alembic | Auto-generated migrations, Python-native | Adds complexity; Supabase doesn't integrate natively |
| Supabase CLI + `supabase migration` | Tracks applied migrations | Requires Supabase CLI; adds CI dependency |

**Seeding:**
| Option | Pros | Cons |
|--------|------|------|
| Python script calling Supabase API | Programmatic; can roll back on failure | Requires Python env |
| SQL INSERT statements in migration | Simple | Harder to handle conditional logic (e.g., "create auth user, then org, then user row") |

### Decision
**Raw SQL migrations** + **Python seed script**.

### Rationale
- `migrations/001_init.sql` — core schema (5 tables, indexes, RLS policies)
- `migrations/002_filings.sql` — pgvector extension, `filing_chunks` table, IVFFlat index, `match_filing_chunks` RPC
- Migrations are applied manually via Supabase dashboard SQL editor (simple enough for 2 files)
- `scripts/seed.py` creates 2 orgs, 4 users, sample research reports, and watchlist entries — all through the Supabase API
- `scripts/ingest.py` chunks, embeds, and inserts sample filings into the vector store
- Both scripts are idempotent (clear + reinsert for the small KB)

---

## ADR-012: File Naming Conventions and Code Organization

### Context
Establish consistent naming and layering conventions across the backend.

### Research Notes

**Backend layering patterns considered:**
| Pattern | Structure | Used by |
|---------|-----------|---------|
| Flat routes/ | `routes/auth.py` directly imports services | Simple CRUD apps |
| Repository pattern | `services/` → `repositories/` → DB | Larger apps with complex data access |
| Clean/Hexagonal | `routes/` → `services/` → `ports/` → `adapters/` | Enterprise apps |
| Domain-driven | `domain/`, `application/`, `infrastructure/` | Large domain models |

### Decision
**Backend layered as: `core/` · `routes/` · `services/` · `tools/` · `models/`**

```
backend/app/
├── core/       # Config, auth, logging, cache, response envelope
├── routes/     # HTTP route handlers (thin — parse request, delegate, return)
├── services/   # Business logic (LLM calls, agent orchestration, DB)
├── tools/      # Data tool implementations (yfinance, DDG, pgvector)
├── models/     # Pydantic schemas (request/response shapes)
```

### Rationale
- `core/` → cross-cutting concerns (config, auth, cache, error handling)
- `routes/` → thin: parse the request, call a service/tool, return a response
- `services/` → business logic that doesn't fit in a single tool (agent orchestration, LLM abstraction, DB client)
- `tools/` → one file per external data source, each returns JSON-serializable dicts with a `source` field
- `models/` → Pydantic models for request validation and type safety
- Each file in `tools/` includes a `__main__` smoke test block so individual tools can be verified independently
- File names are lowercase singular (matching Python conventions), route files match their prefix (`market.py` for `/market/*`)
