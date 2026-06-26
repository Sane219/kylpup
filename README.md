# Klypup — Investment Research Dashboard

AI-powered, source-attributed investment research. Analyst types a natural-language
query → agent orchestrates market data, news+sentiment, and SEC filing search →
structured UI (cards, tables, charts, citations). Multi-tenant, RBAC.

> Status: **Phase 0 scaffold** (see `plan.md` for the full build plan).

## Stack
React+TS+Vite+Tailwind (Vercel) · FastAPI (Render) · Supabase Postgres + pgvector ·
Gemini 2.0 Flash (Groq fallback) · yfinance · duckduckgo-search

## Layout
```
backend/   FastAPI app (app/core, routes, services, tools, models), migrations, scripts
frontend/  React + Vite
docs/      ARCHITECTURE.md, DECISIONS.md
```

## Run locally
1. `cp backend/.env.example backend/.env` and `cp frontend/.env.example frontend/.env`, fill in keys.
2. `docker-compose up` → frontend http://localhost:5173, backend http://localhost:8000/health

### Without Docker
- Backend: `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload`
- Frontend: `cd frontend && npm install && npm run dev`

## Docs
- `plan.md` — phased build plan + requirement coverage map
- `docs/ARCHITECTURE.md` — diagrams (TBD)
- `docs/DECISIONS.md` — decision log (TBD)
