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
_TBD — endpoint table (method, path, auth, role, req/resp)._
