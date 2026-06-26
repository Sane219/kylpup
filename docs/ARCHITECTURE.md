# Architecture

Klypup is an AI-powered investment research dashboard: an analyst types a natural-language query, an agentic LLM flow orchestrates data tools (market data, news+sentiment, SEC-filing vector search), and the result renders as structured, source-attributed UI. Multi-tenant with RBAC.

## System Architecture

```mermaid
flowchart LR
  subgraph Client["Browser — React/Vite SPA (Vercel)"]
    UI[Pages: Dashboard, Research, Reports, Watchlist, Team]
  end
  subgraph Backend["FastAPI (Render)"]
    MW[JWT + tenant dependency]
    R[Routes: auth, orgs, research, watchlist]
    AG[Agent orchestrator]
    LLM[LLM abstraction\nGemini / Groq]
    TM[Tool: market]
    TN[Tool: news]
    TF[Tool: filings]
  end
  subgraph Data["Supabase"]
    PG[(Postgres + RLS)]
    VEC[(pgvector: filing_chunks)]
    AUTH[Supabase Auth]
  end
  YF[yfinance]
  DDG[DuckDuckGo News]
  GEM[Gemini API]
  GRQ[Groq API]

  UI -->|Bearer JWT, REST| MW --> R
  R --> AG --> LLM --> GEM & GRQ
  AG --> TM --> YF
  AG --> TN --> DDG
  AG --> TF --> VEC
  R --> PG
  UI -. signup/login .-> AUTH
  LLM -. embeddings .-> GEM
```

## Data Flow

A research query, end to end:

```mermaid
sequenceDiagram
  actor A as Analyst
  participant FE as React SPA
  participant API as FastAPI
  participant MW as Tenant dependency
  participant AG as Agent
  participant T as Tools (parallel)
  participant LLM as Gemini/Groq
  participant DB as Supabase

  A->>FE: types NL query
  FE->>API: POST /research (Bearer JWT)
  API->>MW: verify JWT -> {user_id, org_id, role}
  MW-->>API: tenant context
  API->>AG: run_research(query)
  AG->>LLM: router call -> tool plan (JSON)
  LLM-->>AG: {companies, fetch_market, fetch_news, search_filings}
  AG->>T: asyncio.gather selected tools only
  T-->>AG: market + news + filing data (each with source)
  AG->>LLM: synthesizer call (tool data)
  LLM-->>AG: structured UI state + citations
  AG-->>API: result_json
  API->>DB: INSERT research_reports (org_id scoped) + audit_log
  API-->>FE: {data: report}
  FE-->>A: cards, tables, charts, sentiment, citations
```

## Database Schema / ER

```mermaid
erDiagram
  organizations ||--o{ users : has
  organizations ||--o{ research_reports : owns
  organizations ||--o{ watchlist : owns
  organizations ||--o{ audit_logs : records
  users ||--o{ research_reports : creates
  users ||--o{ watchlist : curates

  organizations {
    uuid id PK
    text name
    text invite_code UK
    timestamptz created_at
  }
  users {
    uuid id PK "== auth.users.id"
    uuid org_id FK
    text email
    text role "admin | analyst"
  }
  research_reports {
    uuid id PK
    uuid org_id FK
    uuid user_id FK
    text query
    jsonb result_json
    text_array tags
    timestamptz created_at
  }
  watchlist {
    uuid id PK
    uuid org_id FK
    uuid user_id FK
    text ticker
  }
  audit_logs {
    uuid id PK
    uuid org_id FK
    uuid user_id
    text action
    jsonb meta
  }
  filing_chunks {
    uuid id PK
    text ticker
    text chunk
    text source_ref
    vector embedding "768-dim, shared KB"
  }
```

`filing_chunks` is shared reference data (same SEC filings for all orgs) so it has no `org_id`. Indexes: `org_id` on every tenant table, `(org_id, created_at desc)` on reports, GIN on `tags`, IVFFlat cosine on `embedding`.

## AI Orchestration Flow

```mermaid
flowchart TD
  Q[NL query] --> ROUTER[LLM call 1: Router]
  ROUTER --> PLAN{JSON plan}
  PLAN -->|fetch_market| M[market.get_quotes]
  PLAN -->|fetch_news| N[news.get_news_multi]
  PLAN -->|search_filings| F[filings.search_filings]
  PLAN -->|not requested| SKIP[tool skipped]
  M & N & F --> AGG[Aggregate tool data\nasyncio.gather, per-tool try/except]
  AGG --> SYNTH[LLM call 2: Synthesizer\nstrict JSON schema, 'use only tool data']
  SYNTH --> UI[Structured UI state:\ncards, comparison_table,\nnews_sentiment, filing_insights,\nrisks, sources_used + citations]
```

The router chooses tools per query (a news-only query skips market and filings). Tools run concurrently; one failing degrades gracefully. Provider abstraction retries twice then fails over Gemini↔Groq.

## Multi-Tenant Data Flow

Isolation is enforced in app code because the backend uses the Supabase **service key, which bypasses RLS**. RLS policies exist as defense-in-depth.

```mermaid
flowchart LR
  REQ[Request + Bearer JWT] --> V{verify JWT\nHS256, aud=authenticated}
  V -->|invalid| E401[401]
  V -->|valid| CTX[extract app_metadata\norg_id + role]
  CTX --> RBAC{require_role?}
  RBAC -->|role mismatch| E403[403]
  RBAC -->|ok| Q[query .eq org_id\n+ .eq id for single resource]
  Q --> DB[(Supabase)]
  DB --> RLS[RLS policy: current_org_id\ndefense-in-depth]
```

`org_id` and `role` live in the JWT's `app_metadata` (server-controlled, not user-editable). Org A's token can never resolve to Org B's `org_id`, and every query filters by it — single-resource ops filter by both `org_id` and `id` (IDOR guard).

## API Design

All responses use a consistent envelope — success: `{data, meta}`, error: `{error:{code,message,details}, meta}`. Protected routes require `Authorization: Bearer <jwt>` and resolve `org_id`/`role` from the token; every query is org-scoped.

| Method | Path | Auth | Role | Body / Notes |
|---|---|---|---|---|
| GET | `/health` | none | — | liveness |
| POST | `/auth/signup` | none | — | `{email,password, org_name \| invite_code}` → creates org (admin) or joins (analyst) |
| POST | `/auth/login` | none | — | `{email,password}` → `{access_token,...}` |
| POST | `/auth/logout` | yes | any | audit + client drops token |
| GET | `/auth/me` | yes | any | current user/org/role |
| GET | `/orgs/invite` | yes | **admin** | org invite code |
| GET | `/orgs/members` | yes | any | org member list |
| POST | `/research` | yes | any | `{query}` → runs agent, saves + returns structured report |
| GET | `/research?q=&tag=` | yes | any | list (search + tag filter), org-scoped |
| GET | `/research/{id}` | yes | any | single report (org_id+id) |
| PATCH | `/research/{id}` | yes | any | `{tags?,query?}` rename/retag |
| DELETE | `/research/{id}` | yes | any | 204 |
| GET | `/watchlist` | yes | any | user's tickers |
| POST | `/watchlist` | yes | any | `{ticker}` upsert |
| DELETE | `/watchlist/{ticker}` | yes | any | 204 |
