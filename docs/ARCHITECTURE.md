# Architecture

> Diagrams added during the build. Placeholders below mark required sections (per goal.md §4.2).

## System Architecture
_TBD — Mermaid: frontend (Vercel) → backend (Render/FastAPI) → Supabase (Postgres+pgvector); external: yfinance, DuckDuckGo, Gemini/Groq._

## Data Flow
_TBD — UI input → API → auth/tenant middleware → AI router → tool execution → synthesizer → DB write → rendered structured output._

## Database Schema / ER
_TBD — organizations, users(role), research_reports, watchlist, audit_logs, filing_chunks(pgvector)._

## AI Orchestration Flow
_TBD — router LLM call → parallel tools → synthesizer LLM call → structured JSON UI state with citations._

## Multi-Tenant Data Flow
_TBD — JWT → org_id resolution → org-scoped queries; RLS as defense-in-depth._

## API Design

All responses use a consistent envelope — success: `{data, meta}`, error: `{error:{code,message,details}, meta}`. Protected routes require `Authorization: Bearer <jwt>` and resolve `org_id`/`role` from the token; every query is org-scoped.

| Method | Path | Auth | Role | Body / Notes |
|---|---|---|---|---|
| GET | `/health` | none | — | liveness |
| POST | `/auth/signup` | none | — | `{email,password, org_name | invite_code}` → creates org (admin) or joins (analyst) |
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
