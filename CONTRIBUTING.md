<p align="center">
  <img src="LOGO.png" alt="Klypup" width="240">
</p>

# Contributing

Thanks for your interest in Klypup. This document covers how to set up the project locally, the codebase conventions, and the development workflow.

## Prerequisites

- **Node.js** 18+ and **npm** 9+
- **Python** 3.11+ and **pip**
- **Docker** + **Docker Compose** (optional, for containerized dev)
- A **Supabase** project (free tier) — [supabase.com](https://supabase.com)
- A **Gemini API key** — [aistudio.google.com](https://aistudio.google.com) (free tier)
- A **Groq API key** (optional, fallback) — [console.groq.com](https://console.groq.com)

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/your-org/klypup
cd klypup

# Backend
cd backend
pip install -r requirements.txt
cd ..

# Frontend
cd frontend
npm install
cd ..
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env` with your Supabase project URL, service role key, JWT secret, and LLM API keys. Edit `frontend/.env` with your Supabase anon key and project URL.

### 3. Run database migrations

Open your Supabase project's SQL Editor and run:

1. `backend/migrations/001_init.sql` — core schema (orgs, users, reports, watchlist, audit_logs) + RLS
2. `backend/migrations/002_filings.sql` — pgvector extension, filing_chunks table, similarity search RPC

### 4. Start the app

**With Docker (recommended):**
```bash
docker-compose up
```

Frontend at `http://localhost:5173`, backend at `http://localhost:8000`.

**Without Docker:**
```bash
# Terminal 1 — backend
cd backend && uvicorn app.main:app --reload

# Terminal 2 — frontend
cd frontend && npm run dev
```

### 5. Seed demo data

```bash
cd backend
python scripts/seed.py       # 2 orgs, admin+analyst each, sample reports
python scripts/ingest.py     # chunk + embed SEC filings into pgvector
```

Log in as `admin@acme.test` / `demo1234` (admin) or `analyst@acme.test` / `demo1234` (analyst).

## Project Layout

```
backend/
  app/
    core/          config, auth (JWT/tenant), cache, error handling
    models/        Pydantic schemas
    routes/        auth, orgs, research, watchlist
    services/      agent orchestrator, DB client, LLM abstraction, embeddings
    tools/         market data (yfinance), news (DuckDuckGo), filings (pgvector)
  migrations/      SQL schema + indexes + RLS
  scripts/         seed data + filing ingestion
  tests/           pytest suite
frontend/
  src/
    components/    Layout, ResearchResult, UI primitives
    lib/           API client, auth context
    pages/         Dashboard, Research, Reports, ReportDetail, Watchlist, Login, Members
```

## Development Conventions

### Backend

- **Python 3.11+** with FastAPI. Use `async def` for routes that call the agent; sync for simple CRUD.
- **Pydantic v2** for all request/response models in `models/schemas.py`.
- **Every query must filter by `org_id`** — tenant isolation is enforced in app code because the backend uses the Supabase service key (bypasses RLS).
- **One file per tool** in `tools/`. Each tool returns JSON-serializable data with a `source` field.
- **LLM access** goes through `services/llm.py` only — swapping Gemini↔Groq is the `LLM_PROVIDER` env var.
- **Imports**: lazy import heavy modules (yfinance, duckduckgo_search, google.genai) inside function bodies, not at module top level.
- Formatting: `ruff` with the project's `ruff.toml`.

### Frontend

- **React 18** with **TypeScript strict mode**. No `any` types.
- **Tailwind CSS** for styling. Custom CSS in `index.css` only for global resets and a few utility classes.
- **Component per page** in `pages/`. Reusable UI in `components/`.
- **API calls** go through `lib/api.ts` which handles auth token injection and the response envelope.
- **Build**: `npm run build` runs `tsc -b && vite build` — both type-checking and bundling.

## Code Quality

Run these before committing:

```bash
# Backend
cd backend && ruff check app/ tests/

# Frontend
cd frontend && npm run build
```

### Testing

```bash
cd backend && pytest -v
```

Key tests:
- `test_agent.py` — full router→tools→synthesizer flow with mock LLM
- `test_tenant_scoping.py` — static guard that fails if any route queries a tenant table without `org_id` filter
- `test_chunker.py` — document chunking logic
- `test_sentiment.py` — lexicon-based sentiment analyzer

## Pull Request Process

1. Create a feature branch from `main`.
2. Make changes with meaningful commits.
3. Run lint + tests — they must pass.
4. Open a PR using the [pull request template](.github/PULL_REQUEST_TEMPLATE.md) — fill in the description, testing steps, and checklist.
5. Use [bug report](.github/ISSUE_TEMPLATE/bug_report.md) or [feature request](.github/ISSUE_TEMPLATE/feature_request.md) templates for issues.

## Architecture Decisions

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the system architecture, data flow, ER diagram, AI orchestration flow, multi-tenant isolation flow, and API design. Major decisions are recorded in [docs/DECISIONS.md](docs/DECISIONS.md).
