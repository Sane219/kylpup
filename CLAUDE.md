# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A 5-day take-home: an **Investment Research Dashboard** (Klypup assessment, Option A). An analyst types a natural-language query → an agentic LLM flow orchestrates data tools (market data, news+sentiment, SEC-filing vector search) → results render as structured UI (cards, tables, charts, citations). Multi-tenant with RBAC. The full spec is in `goal.md`; the phased build plan and requirement→phase coverage map are in `plan.md`. **Read `plan.md` before starting work — it defines what each phase must deliver.**

Current state: Phase 0 (scaffold) is done. Phases 1–7 are not yet built.

## Commands

Local (one command, both apps — DB is hosted Supabase):
```
docker-compose up           # frontend :5173, backend :8000
```

Backend without Docker:
```
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
```

Frontend without Docker:
```
cd frontend && npm install && npm run dev
npm run build               # tsc + vite build
```

No test runner wired yet. When adding tests (Phase 7), use `pytest` in `backend/` — no frameworks beyond it.

## Architecture (big picture)

Three pieces: **React/Vite frontend** (Vercel) → **FastAPI backend** (Render) → **Supabase Postgres + pgvector** (DB, auth keys, vector store all in one service). External calls (yfinance, DuckDuckGo, Gemini/Groq) happen **only** in the backend — the browser never calls an LLM or data API directly.

### The two load-bearing design decisions

1. **Tenant isolation is enforced in app code, not by RLS.** The backend talks to Supabase with the **service key, which bypasses Row-Level Security**. So isolation lives in `backend/app/core/auth.py`: every protected route depends on `get_current_tenant()` (decodes the Supabase JWT → returns `user_id, org_id, role`), and **every query must filter by that `org_id`**. RLS policies exist only as defense-in-depth. If you add a route that reads tenant data without scoping by `org_id`, you've created a data leak — this is the single highest-risk mistake in the codebase. `require_role("admin")` gates admin-only routes. `org_id`/`role` are expected in the JWT's `app_metadata`.

2. **The AI layer is a two-LLM-call agentic flow, not a chatbot.** (Phase 3, not built yet.) Call 1 = *router*: NL query → JSON plan `{tickers, fetch_market, fetch_news, search_filings}` — tools are chosen by the model, not hardcoded. Backend runs only the selected tools concurrently (`asyncio.gather`). Call 2 = *synthesizer*: raw tool outputs → strict structured JSON UI state (`company_cards[]`, `comparison_table`, `news_sentiment[]`, `risks[]`, `summary`). **Every tool return and every synthesized item must carry a source/citation field** — source attribution is a graded requirement. One tool failing must not fail the whole query.

### Conventions
- Backend layered as `core/` (config, auth, logging) · `routes/` · `services/` · `tools/` (one file per data tool, each returns JSON-serializable data with a `source` field) · `models/`. Migrations in `backend/migrations/`, ingestion/seed scripts in `backend/scripts/`.
- LLM access goes behind a single module so Gemini↔Groq is a one-line swap (`LLM_PROVIDER` env).
- All secrets via env; `.env.example` is committed in both `backend/` and `frontend/`, real `.env` is gitignored.
- Commit frequently with meaningful messages (the assessment grades commit history).

## Docs to keep current
`docs/ARCHITECTURE.md` (diagrams) and `docs/DECISIONS.md` (decision log) are required deliverables — update them as decisions are made, not at the end.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
