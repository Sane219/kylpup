<p align="center">
  <img src="../LOGO.png" alt="Klypup" width="240">
</p>

# Architecture Guide

## System Overview

Klypup is a **three-tier investment research platform** built as a React/Vite single-page application frontend, a FastAPI Python backend, and a Supabase Postgres database with pgvector. The core differentiator is an **agentic LLM flow**: a user types a natural-language research query, the backend orchestrates two LLM calls (router → synthesizer) and three data tools (market data, news+sentiment, SEC-filing vector search) to return structured, sourced analysis.

### Architectural Pattern

**Monolithic backend with service-key Supabase.** The backend is a single FastAPI process. It uses Supabase's service-role key, which bypasses Row-Level Security — tenant isolation is enforced entirely in application code via a `get_current_tenant()` FastAPI dependency. This is the single highest-risk architectural decision and is documented in [`docs/DECISIONS.md`](decisions.md).

### Stack Summary

| Layer | Technology | Deployment |
|-------|-----------|------------|
| Frontend | React 19, TypeScript, Vite 5, Tailwind CSS | Vercel |
| Backend | Python 3.12+, FastAPI, Uvicorn | Render |
| Database | Supabase Postgres 15 + pgvector | Supabase |
| Auth | Supabase Auth (JWT via ES256 JWKS) | Supabase |
| LLM (primary) | Google Gemini 2.5 Flash | Google AI |
| LLM (fallback) | Groq Llama 3.3 70B | Groq |
| Market data | yfinance | — |
| News | DuckDuckGo News API | — |
| Embeddings | Gemini text-embedding-001 (3072-dim) | Google AI |
| Vector store | pgvector (IVFFlat, cosine distance) | Supabase |

---

## System Architecture Diagram

```mermaid
graph TB
    subgraph Client["Browser (Vercel)"]
        UI["React SPA<br/>Vite + Tailwind"]
        MarketStore["Market Feed Store<br/>useSyncExternalStore<br/>60s poll + 1.2s jitter"]
        TickerTape["TickerTape Marquee<br/>CSS ticker animation"]
    end

    subgraph Server["Backend (Render)"]
        FastAPI["FastAPI Application<br/>uvicorn"]

        subgraph Core["Core Layer"]
            Config["app.core.config<br/>pydantic-settings"]
            Auth["app.core.auth<br/>JWT + Tenant<br/>get_current_tenant()"]
            Cache["app.core.cache<br/>@ttl_cache decorator"]
            Responses["app.core.responses<br/>{data, error} envelope"]
        end

        subgraph Routes["Route Handlers"]
            R_Auth["auth.py<br/>signup / login / logout / me"]
            R_Market["market.py<br/>GET /market/snapshot"]
            R_Research["research.py<br/>POST /research<br/>POST /research/stream<br/>GET/PATCH/DELETE /research/{id}"]
            R_Org["orgs.py<br/>invite / members"]
            R_Watchlist["watchlist.py<br/>CRUD"]
        end

        subgraph Agent["Agentic AI Layer"]
            LLM["services/llm.py<br/>Gemini -> Groq failover<br/>chat_json / stream_thinking"]
            AgentEngine["services/agent.py<br/>Router → Tools → Synthesizer<br/>→ Critique → Refine"]
        end

        subgraph Tools["Data Tools"]
            T_Market["tools/market.py<br/>yfinance wrappers<br/>get_quote / snapshot"]
            T_News["tools/news.py<br/>DDGS + lexicon sentiment<br/>get_news / get_news_multi"]
            T_Filings["tools/filings.py<br/>pgvector similarity search<br/>search_filings"]
        end

        subgraph Embeddings["Embedding Pipeline"]
            E_Service["services/embeddings.py<br/>gemini-embedding-001<br/>embed_one / embed_texts"]
        end
    end

    subgraph Database["Supabase"]
        PG["Postgres 15"]
        subgraph Tables["Tables"]
            Orgs["organizations"]
            Users["users"]
            Reports["research_reports"]
            Watch["watchlist"]
            Audit["audit_logs"]
            FilingChunks["filing_chunks<br/>vector(768)"]
        end
        Auth_SB["Auth Service<br/>JWT issuance + JWKS"]
    end

    subgraph External["External APIs"]
        YF["Yahoo Finance<br/>(yfinance)"]
        DDG["DuckDuckGo<br/>News API"]
        Gemini["Google Gemini<br/>2.5 Flash + embedding-001"]
        Groq["Groq<br/>Llama 3.3 70B"]
    end

    UI -->|"fetch() + JWT"| FastAPI
    MarketStore -->|"GET /market/snapshot"| R_Market

    FastAPI --> Auth
    FastAPI --> Cache
    FastAPI --> Responses

    R_Auth -->|"create_user / sign_in"| Auth_SB
    R_Auth -->|"INSERT"| PG

    R_Market --> T_Market
    T_Market --> YF

    R_Research --> AgentEngine
    AgentEngine --> LLM
    AgentEngine --> T_Market
    AgentEngine --> T_News
    AgentEngine --> T_Filings
    T_Filings --> E_Service
    E_Service --> Gemini
    LLM --> Gemini
    LLM -.->|"fallback"| Groq
    T_News --> DDG
    T_Filings -->|"match_filing_chunks RPC"| PG
    R_Research -->|"INSERT/SELECT"| PG

    R_Org --> PG
    R_Watchlist --> PG
```

---

## Data Flow: Research Query Lifecycle

```mermaid
sequenceDiagram
    actor User as Portfolio Manager
    participant UI as React SPA
    participant API as FastAPI Backend
    participant Agent as Agent Engine
    participant LLM as Gemini/Groq
    participant Market as yfinance Tool
    participant News as DuckDuckGo Tool
    participant Filing as pgvector Tool
    participant DB as Supabase

    User->>UI: Types "Compare NVDA and AMD"
    UI->>API: POST /research/stream {query}
    API->>Agent: stream_research(query)
    
    Agent->>LLM: ROUTER prompt → JSON plan
    LLM-->>Agent: {companies:["NVDA","AMD"], fetch_market:true, fetch_news:true, search_filings:true}
    Agent-->>API: yield {type:"plan", plan:{...}}
    API-->>UI: SSE: plan event
    UI->>UI: Render agent timeline

    par Parallel Tools
        Agent->>Market: get_quotes(["NVDA","AMD"])
        Agent->>News: get_news_multi(["NVDA","AMD"])
        Agent->>Filing: search_filings(query, ticker)
        Filing->>LLM: embed_one(query)
        LLM-->>Filing: 3072-dim vector
        Filing->>DB: match_filing_chunks RPC
        DB-->>Filing: [{ticker, chunk, source_ref, similarity}]
        Filing-->>Agent: [{excerpt, source_ref, ...}]
        Market-->>Agent: [{ticker, price, pe_ratio, ...}]
        News-->>Agent: [{title, sentiment, url, ...}]
    end

    loop as_completed
        Agent-->>API: yield {type:"tool", tool:"market", status:"done", summary, preview}
        API-->>UI: SSE: tool event
    end

    Agent->>LLM: SYNTH prompt + tool_data
    LLM-->>Agent: structured ResearchData JSON
    Agent-->>API: yield {type:"synth", status:"done"}

    Agent->>LLM: CRITIQUE prompt + draft + tool_data
    LLM-->>Agent: {issues:[], needs_revision:false}
    Agent-->>API: yield {type:"review", status:"done", ...}

    alt needs_revision
        Agent->>LLM: Refine pass
        LLM-->>Agent: Revised ResearchData JSON
    end

    Agent-->>API: yield {type:"result", result:{ResearchData}}
    API->>DB: INSERT research_reports
    DB-->>API: {id, query, result_json, ...}
    API-->>UI: yield {type:"saved", report:{...}}
    UI->>UI: Render ResearchResult with citations
```

---

## Agentic AI Layer

The agent engine (`backend/app/services/agent.py`) is the intellectual core of the platform. It implements a **two-LLM-call agentic flow** with an optional critique/refine loop.

### Router-Synthesizer Architecture

```mermaid
graph LR
    Q["User Query<br/>'Compare NVDA and AMD'"] --> Router

    subgraph Router["Router LLM Call"]
        R_Prompt["System: Execution Planner<br/>Choose tools + tickers"]
        R_Output["Output JSON:<br/>{companies, fetch_market,<br/>fetch_news, search_filings,<br/>filing_query, reasoning}"]
    end

    Router -->|"plan JSON"| Gather["Parallel Tool Execution<br/>asyncio.gather + as_completed"]

    Gather --> Market
    Gather --> News
    Gather --> Filing

    subgraph Market["Market Tool"]
        M_YF["yfinance<br/>get_quotes()"]
        M_Out["[{ticker, price, pe_ratio,<br/>market_cap, history, source}]"]
    end

    subgraph News["News Tool"]
        N_DDG["DuckDuckGo<br/>get_news_multi()"]
        N_Lex["Lexicon Sentiment<br/>positive/negative/neutral"]
        N_Out["{ticker: [{title, sentiment,<br/>url, publisher, source}]}"]
    end

    subgraph Filing["Filings Tool"]
        F_Emb["Embed query<br/>gemini-embedding-001"]
        F_Vec["pgvector similarity<br/>match_filing_chunks RPC"]
        F_Out["[{ticker, excerpt,<br/>source_ref, similarity, source}]"]
    end

    Gather -->|"tool_data JSON"| Synthesizer

    subgraph Synthesizer["Synthesizer LLM Call"]
        S_Prompt["System: Senior Analyst<br/>Write desk note from tool data"]
        S_Output["Output JSON:<br/>{summary, key_takeaways,<br/>company_cards[], news_sentiment[],<br/>filing_insights[], opportunities[],<br/>risks[], outlook, sources_used}"]
    end

    Synthesizer -->|"draft"| Critic

    subgraph Critic["Critique LLM Call (Optional)"]
        C_Prompt["System: Skeptical Editor<br/>Find gaps against tool_data"]
        C_Decision{"needs_revision?"}
        C_Issues["{issues: [...],<br/>needs_revision: true/false}"]
    end

    C_Decision -->|"Yes"| Refine["Refine Pass<br/>Re-synthesize with feedback"]
    Refine --> Final["Final ResearchData JSON"]
    C_Decision -->|"No"| Final
```

### LLM Provider Abstraction

The LLM layer (`backend/app/services/llm.py`) wraps both providers behind a single function:

```python
def chat_json(system: str, user: str) -> dict:
    """
    - Retries primary provider twice (0.5s, 1.0s backoff)
    - On failure, fails over to secondary
    - Uses native JSON mode (response_mime_type="application/json" for Gemini,
      response_format={"type": "json_object"} for Groq)
    - Raises RuntimeError if both providers are down
    """
```

| Feature | Function | Provider |
|---------|----------|----------|
| JSON completion | `chat_json()` | Gemini → Groq |
| With thinking | `chat_json_thinking()` | Gemini only |
| Streaming + thinking | `stream_thinking()` | Gemini only |
| Streaming via thread | `_stream_llm()` | Bridge for async context |

**Model versions:**
- Gemini: `gemini-2.5-flash` (temperature: 0.2)
- Groq: `llama-3.3-70b-versatile` (temperature: 0.2)

---

## Embedding Pipeline

The embeddings system (`backend/app/services/embeddings.py`) is used by the SEC filing knowledge base. The pipeline flows through three stages:

### Architecture

```mermaid
flowchart LR
    subgraph Ingest["Ingestion (scripts/ingest.py)"]
        FILES["Sample Filings<br/>AAPL_10K_FY2023.txt<br/>NVDA_10K_FY2024.txt<br/>TSLA_10K_FY2023.txt<br/>JPM_10K_FY2023.txt"]
        CHUNK["Chunking<br/>1000 chars + 150 overlap<br/>Paragraph-aware split"]
        EMBED_INGEST["Embedding<br/>gemini-embedding-001<br/>3072 dims"]
        INSERT["Supabase<br/>filing_chunks table<br/>vector(768)"]
    end

    subgraph Query["Query Time"]
        Q_TEXT["User's filing_query<br/>'revenue growth drivers'"]
        EMBED_Q["Embedding<br/>Same model<br/>(gemini-embedding-001)"]
        MATCH["pgvector RPC<br/>match_filing_chunks<br/>Cosine distance"]
        RESULT["Top 5 passages<br/>with similarity scores"]
    end

    FILES --> CHUNK --> EMBED_INGEST --> INSERT
    Q_TEXT --> EMBED_Q --> MATCH --> RESULT
    INSERT -.->|"Shared KB"| MATCH
```

### Key Details

| Aspect | Detail |
|--------|--------|
| Model | `gemini-embedding-001` |
| Dimensions | **3072** (stored as `vector(768)` — see note below) |
| Chunk size | 1000 characters |
| Chunk overlap | 150 characters |
| Index | IVFFlat with cosine distance, `lists = 10` |
| Similarity function | `1 - (embedding <=> query_embedding)` (cosine) |
| Max results | 5 per query |
| Optional filter | By ticker symbol |

> **Note on dimensions:** The code declares `embedding vector(768)` in the migration but the Gemini model `text-embedding-001` produces 3072 dimensions. The migration was written for an earlier 768-dim model. In production, this discrepancy must be reconciled — either by switching to a 768-dim model (e.g., `text-embedding-004`) or updating the schema to `vector(3072)` and rebuilding the index.

### Chunking Strategy

The ingestion script (`backend/scripts/ingest.py`) uses a **paragraph-aware character window** approach:

1. Split document on double newlines (`\n\n`) into paragraphs
2. Accumulate paragraphs into chunks up to 1000 characters
3. When a paragraph would overflow, flush the current chunk, then seed the next chunk with the last 150 characters of the previous one + the new paragraph
4. Each chunk gets a `source_ref` like `"AAPL 10-K FY2023 — chunk 3"`

### Source Attribution

Every document in the `sample_filings/` directory follows the naming convention:

```
<TICKER>_<DOCTYPE>_<PERIOD>.txt
```

Examples: `AAPL_10K_FY2023.txt`, `NVDA_10K_FY2024.txt`

This is parsed by the `source_ref()` function to generate human-readable citations that are surfaced in the UI alongside every filing insight.

---

## Data Tools

### Market Tool (`backend/app/tools/market.py`)

| Function | Cache | Returns | Used By |
|----------|-------|---------|---------|
| `get_quote(ticker)` | 300s | Full financial metrics + 3mo price history | Research agent |
| `get_quotes(tickers)` | per-call | Batch of `get_quote` results, errors isolated | Research agent |
| `quote_compact(yf_ticker)` | 120s | Lightweight `{price, prevClose, history}` | Dashboard snapshot |
| `snapshot(symbols)` | per-call | Array of compact quotes with change/changePct | `GET /market/snapshot` |

**Return format (get_quote):**
```json
{
  "ticker": "AAPL",
  "name": "Apple Inc.",
  "price": 226.8,
  "currency": "USD",
  "market_cap": 3500000000000,
  "pe_ratio": 30.2,
  "eps": 7.5,
  "revenue": 391000000000,
  "volume": 50000000,
  "fifty_two_week_high": 250.0,
  "fifty_two_week_low": 180.0,
  "history": [{"date": "2024-01-15", "close": 225.3}, ...],
  "source": "yfinance"
}
```

**Return format (snapshot):**
```json
{
  "symbol": "AAPL",
  "price": 226.80,
  "prevClose": 225.10,
  "change": 1.70,
  "changePct": 0.76,
  "history": [310.85, 312.51, ...],
  "currency": "USD",
  "source": "yfinance"
}
```

**Index mapping:**
| Friendly | yfinance symbol |
|----------|----------------|
| SPX | `^GSPC` |
| NDX | `^NDX` |
| DJI | `^DJI` |
| VIX | `^VIX` |
| BTC | `BTC-USD` |
| US10Y | `^TNX` |

### News + Sentiment Tool (`backend/app/tools/news.py`)

| Function | Cache | Returns | Used By |
|----------|-------|---------|---------|
| `get_news(ticker, max_results=6)` | 600s | Articles with sentiment labels | Research agent |
| `get_news_multi(tickers)` | — | Dict mapping ticker → `get_news` results | Research agent |

**Sentiment algorithm:** A lightweight lexicon-based approach using word sets:

| Sentiment | Example trigger words |
|-----------|---------------------|
| Positive | surge, beat, beats, growth, record, profit, bullish, soar, rally |
| Negative | miss, misses, loss, drop, fall, decline, downgrade, bearish, lawsuit |
| Neutral | Any text without sufficient signal words |

Score = `(positive_count - negative_count) / (positive_count + negative_count)`, clamped to 0.0 for ties.

**Return format:**
```json
{
  "title": "Apple Reports Record Q4 Revenue",
  "url": "https://...",
  "publisher": "Reuters",
  "date": "2024-12-15T10:00:00Z",
  "excerpt": "Apple Inc. reported record revenue...",
  "sentiment": "positive",
  "sentiment_score": 0.67,
  "source": "duckduckgo-news"
}
```

### SEC Filing Tool (`backend/app/tools/filings.py`)

| Function | Returns | Used By |
|----------|---------|---------|
| `search_filings(query, ticker, k=5)` | Similar passages with citations | Research agent |

The tool:
1. Embeds the query via `embed_one()` using Gemini
2. Calls the Postgres RPC `match_filing_chunks` with the vector, match count, and optional ticker filter
3. Returns passages sorted by cosine similarity descending

**Return format:**
```json
{
  "ticker": "NVDA",
  "excerpt": "Revenue for fiscal 2024 was $60.9 billion...",
  "source_ref": "NVDA 10-K FY2024 — chunk 3",
  "similarity": 0.87,
  "source": "sec-filing-kb"
}
```

---

## Frontend Architecture

### Component Tree

```mermaid
graph TB
    App["App.tsx<br/>ThemeProvider + AuthProvider + ToastProvider"]
    App --> Router["BrowserRouter"]
    Router --> Login["Login.tsx<br/>Sign in / Sign up"]
    Router --> Protected["Protected Route Wrapper"]
    Protected --> Layout["Layout.tsx<br/>Sidebar + Header + Status Bar"]
    Layout --> TickerTape["TickerTape.tsx<br/>Scrolling marquee"]
    Layout --> CommandPalette["CommandPalette.tsx<br/>⌘K palette"]

    Layout --> Dashboard["Dashboard.tsx<br/>Indices, Breadth, Board, Movers"]
    Layout --> Markets["Markets.tsx<br/>Paginated table + Heatmap"]
    Layout --> Research["Research.tsx<br/>NL query + agent results"]
    Layout --> Reports["Reports.tsx<br/>Saved reports list"]
    Layout --> Watchlist["Watchlist.tsx<br/>Tracked tickers"]
    Layout --> StockDetail["StockDetail.tsx<br/>Price chart + stats"]
    Layout --> Settings["Settings.tsx<br/>Theme + account"]
    Layout --> Members["Members.tsx<br/>Invite + roles"]

    Research --> ResearchAgentPlan["ResearchAgentPlan.tsx<br/>Live agent trace"]
    Research --> ResearchResult["ResearchResult.tsx<br/>Structured report cards"]

    subgraph Shared["Shared Components"]
        UI["ui.tsx<br/>Icon, Panel, Badge, Cite,<br/>Spinner, Toast, etc."]
        MarketComp["market.tsx<br/>Sparkline, LivePrice,<br/>QuoteDelta, Heatmap"]
    end

    subgraph State["State & Data"]
        AuthStore["auth.tsx<br/>AuthProvider context"]
        MarketStore["market.ts<br/>useSyncExternalStore<br/>60s poll + 1.2s jitter"]
        ThemeStore["theme.tsx<br/>Dark/light + persistence"]
        API["api.ts<br/>fetch wrapper + JWT"]
    end

    Dashboard --> MarketComp
    Markets --> MarketComp
    Watchlist --> MarketComp
    StockDetail --> MarketComp
    Dashboard --> MarketStore
    Markets --> MarketStore
    Watchlist --> MarketStore
```

### State Management

| Store | Mechanism | Key State |
|-------|-----------|-----------|
| Auth | React Context (`AuthProvider`) | `{user, loading}` |
| Theme | React Context + localStorage | `dark` / `light` |
| Market feed | `useSyncExternalStore` | ~16 quotes, polled + cosmetic jitter |

The market feed is particularly notable:

```mermaid
flowchart LR
    Init["Initialize<br/>16 seed quotes<br/>(6 indices + 10 equities)"]
    Subscribe["Component subscribes<br/>via useMarket()"]
    Start["start() called"]
    Refresh["refresh()<br/>GET /market/snapshot"]
    Merge["merge()<br/>Update anchorBy,<br/>compute dir"]
    Tick["tick()<br/>Every 1.2s<br/>±0.06% jitter<br/>Mean-revert to anchor"]
    Notify["Notify listeners<br/>React re-render<br/>Price flash animation"]

    Init --> Subscribe --> Start
    Start --> Refresh --> Merge --> Notify
    Start --> Tick --> Notify
    Tick -->|"60s loop"| Refresh
```

---

## Multi-Tenant Isolation

### Isolation Strategy

**Tenant isolation is enforced in application code, not by Row-Level Security.** The backend uses Supabase's service-role key which bypasses RLS. Every protected route depends on `get_current_tenant()`, which decodes the JWT and returns `Tenant(user_id, org_id, role)`. Every database query must filter by `org_id`.

```mermaid
sequenceDiagram
    participant User as User A (org_1)
    participant API as FastAPI
    participant Auth as auth.py
    participant DB as Supabase

    User->>API: GET /research (with JWT)
    API->>Auth: get_current_tenant()
    Auth->>Auth: Verify JWT signature<br/>via JWKS (ES256)
    Auth->>Auth: Extract app_metadata<br/>{org_id, role}
    Auth-->>API: Tenant(user_id="u1", org_id="org_1", role="analyst")

    API->>DB: SELECT * FROM research_reports<br/>WHERE org_id = 'org_1'
    Note over API,DB: If org_id filter is missing → data leak
    DB-->>API: [{id: "r1", query: "NVDA", ...}]
    API-->>User: [{id: "r1", ...}]
```

### RBAC Model

| Role | Access |
|------|--------|
| `admin` | Full access + invite code management + member management |
| `analyst` | Full read/write on research, watchlist, market data (no admin features) |

Enforced via `require_role("admin")` dependency on admin-only routes.

### IDOR Guard

Single-resource endpoints filter by **both** `org_id` AND resource `id`:

```python
rows = db().table("research_reports").select("*").eq(
    "org_id", t.org_id).eq("id", report_id).execute().data
```

This prevents user A (org_1) from accessing user B's (org_2) report even if they guess the UUID.

---

## Database Schema

### Entity Relationship Diagram

```mermaid
erDiagram
    organizations ||--o{ users : contains
    organizations ||--o{ research_reports : has
    organizations ||--o{ watchlist : has
    organizations ||--o{ audit_logs : has
    users ||--o{ research_reports : creates
    users ||--o{ watchlist : owns
    users ||--o{ audit_logs : triggers

    organizations {
        uuid id PK
        text name
        text invite_code UK
        timestamptz created_at
    }

    users {
        uuid id PK "same as auth.users.id"
        uuid org_id FK
        text email
        text role "admin | analyst"
        timestamptz created_at
    }

    research_reports {
        uuid id PK
        uuid org_id FK
        uuid user_id FK
        text query
        jsonb result_json
        text[] tags
        timestamptz created_at
    }

    watchlist {
        uuid id PK
        uuid org_id FK
        uuid user_id FK
        text ticker
        timestamptz created_at
    }

    audit_logs {
        uuid id PK
        uuid org_id FK
        uuid user_id
        text action
        jsonb meta
        timestamptz created_at
    }

    filing_chunks {
        uuid id PK
        text ticker
        text chunk
        text source_ref
        vector embedding
        timestamptz created_at
    }
```

### Key Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| users | `idx_users_org` on `org_id` | Org-scoped user queries |
| research_reports | `idx_reports_org_created` on `(org_id, created_at desc)` | Dashboard listing |
| research_reports | `idx_reports_tags` GIN on `tags` | Tag filtering |
| watchlist | Unique on `(org_id, user_id, ticker)` | Prevent duplicates |
| audit_logs | `idx_audit_org` on `(org_id, created_at desc)` | Audit trail queries |
| filing_chunks | `idx_filing_embedding` IVFFlat on `embedding` | ANN vector search |

---

## Deployment Architecture

```mermaid
graph LR
    subgraph GitHub["GitHub Repository"]
        Code["Source code"]
        CI["CI: ruff + pytest + vitest + tsc + build<br/>gitleaks secret scan"]
    end

    subgraph Vercel["Vercel (Frontend)"]
        Vite["Vite build<br/>npm run build"]
        SPA["Static SPA<br/>dist/"]
        CDN["Edge CDN<br/>SPA rewrites"]
    end

    subgraph Render["Render (Backend)"]
        Python["Python 3.12<br/>uvicorn"]
        Service["Web Service<br/>$PORT auto-assigned"]
        Health["/health endpoint"]
    end

    subgraph Supabase["Supabase (DB + Auth)"]
        PG["Postgres + pgvector"]
        Auth["Auth Service<br/>JWKS + JWT"]
    end

    GitHub -->|"git push"| Vercel
    GitHub -->|"git push"| Render

    Vercel --> SPA --> CDN
    Render --> Service

    Service -->|"service-role key"| PG
    Service -->|"password sign-in"| Auth
    SPA -->|"fetch() + JWT"| Service
    SPA -->|"login via REST"| Auth
```

### Environment Variables

**Frontend (Vercel):**

| Variable | Example | Purpose |
|----------|---------|---------|
| `VITE_API_URL` | `https://api.onrender.com` | Backend base URL |

**Backend (Render):**

| Variable | Example | Purpose |
|----------|---------|---------|
| `SUPABASE_URL` | `https://project.supabase.co` | Supabase project URL |
| `SUPABASE_KEY` | `eyJ...` (service-role key) | Admin access to DB |
| `SUPABASE_JWT_SECRET` | hex string | JWT verification |
| `LLM_PROVIDER` | `gemini` | Primary LLM (`gemini` / `groq`) |
| `GEMINI_API_KEY` | `AIza...` | Gemini access |
| `GROQ_API_KEY` | `gsk_...` | Groq fallback access |
| `CORS_ORIGINS` | `https://app.vercel.app` | Allowed frontend origins |

---

## Response Envelope

Every API response follows a consistent envelope:

**Success:**
```json
{
  "data": { ... },
  "meta": {}
}
```

**Error:**
```json
{
  "error": {
    "code": "internal_error",
    "message": "something went wrong",
    "details": null
  },
  "meta": {
    "request_id": "uuid"
  }
}
```

---

## Project Directory Structure

```
klypup/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI entry point, CORS, router mounting
│   │   ├── core/
│   │   │   ├── auth.py              # JWT verification + tenant resolution
│   │   │   ├── cache.py             # In-process TTL cache decorator
│   │   │   ├── config.py            # pydantic-settings (env vars)
│   │   │   └── responses.py         # Response envelope + error handlers
│   │   ├── models/
│   │   │   └── schemas.py           # Pydantic request/response models
│   │   ├── routes/
│   │   │   ├── auth.py              # Signup/login/logout/me
│   │   │   ├── market.py            # Live market snapshot
│   │   │   ├── orgs.py              # Org invite + member management
│   │   │   ├── research.py          # AI research CRUD + streaming
│   │   │   └── watchlist.py         # User watchlist CRUD
│   │   ├── services/
│   │   │   ├── agent.py             # Router → tools → synthesizer orchestration
│   │   │   ├── db.py                # Supabase service-role client
│   │   │   ├── embeddings.py        # Gemini text embedding wrapper
│   │   │   └── llm.py               # LLM abstraction (Gemini/Groq)
│   │   └── tools/
│   │       ├── filings.py           # pgvector SEC filing search
│   │       ├── market.py            # yfinance quote wrappers
│   │       └── news.py              # DuckDuckGo news + sentiment
│   ├── migrations/
│   │   ├── 001_init.sql             # Core schema + RLS policies
│   │   └── 002_filings.sql          # pgvector + filing_chunks + match RPC
│   ├── scripts/
│   │   ├── ingest.py                # Filing chunking + embedding pipeline
│   │   ├── seed.py                  # 2-org demo data seeder
│   │   └── sample_filings/          # Sample 10-K/10-Q documents
│   └── tests/
│       ├── test_agent.py            # Mocked agent flow tests
│       ├── test_chunker.py          # Document chunking logic
│       ├── test_sentiment.py        # Lexicon sentiment accuracy
│       └── test_tenant_scoping.py   # Static org_id regression guard
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx                 # React entry point
│   │   ├── App.tsx                  # Router + providers
│   │   ├── index.css                # Tailwind + design tokens + animations
│   │   ├── components/
│   │   │   ├── Layout.tsx           # App shell (sidebar, header, ticker)
│   │   │   ├── TickerTape.tsx       # Scrolling market marquee
│   │   │   ├── market.tsx           # Sparkline, LivePrice, Heatmap, etc.
│   │   │   ├── ResearchResult.tsx   # Structured report renderer
│   │   │   ├── ResearchAgentPlan.tsx # Live agent timeline
│   │   │   ├── CommandPalette.tsx   # ⌘K command palette
│   │   │   ├── ui.tsx              # Design primitives (Panel, Badge, etc.)
│   │   │   └── Logo.tsx            # Brand logo SVG
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx        # Home page with market overview
│   │   │   ├── Login.tsx            # Auth page with demo fill
│   │   │   ├── Research.tsx         # NL query + streaming results
│   │   │   ├── Markets.tsx          # Paginated market board
│   │   │   ├── Reports.tsx          # Saved report list
│   │   │   ├── Watchlist.tsx        # User watchlist
│   │   │   ├── StockDetail.tsx      # Price chart + stats
│   │   │   ├── Settings.tsx         # Theme + account
│   │   │   ├── Members.tsx          # Admin: invite + roles
│   │   │   └── Styleguide.tsx       # Dev component reference
│   │   └── lib/
│   │       ├── api.ts              # Fetch wrapper with JWT
│   │       ├── auth.tsx            # Auth context
│   │       ├── market.ts           # Live feed store (useSyncExternalStore)
│   │       └── theme.tsx           # Theme context
│   └── vercel.json                 # SPA rewrites configuration
│
├── docker-compose.yml               # One-command local development
├── render.yaml                      # Render blueprint
├── .github/workflows/ci.yml         # CI (ruff, pytest, vitest, tsc, gitleaks)
└── docs/
    ├── architecture.md              # This file
    ├── api-reference.md             # API endpoint documentation
    └── DECISIONS.md                 # Architecture Decision Records
```
