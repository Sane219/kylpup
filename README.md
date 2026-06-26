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
1. Create a free Supabase project. In its SQL editor run `backend/migrations/001_init.sql` then `002_filings.sql`.
2. `cp backend/.env.example backend/.env` and `cp frontend/.env.example frontend/.env`, fill in Supabase + Gemini/Groq keys.
3. `docker-compose up` → frontend http://localhost:5173, backend http://localhost:8000/health
4. Seed demo data + filing vectors:
   ```
   cd backend && python scripts/seed.py        # 2 orgs, admin+analyst each, sample reports
   python scripts/ingest.py                     # chunk+embed 4 sample SEC filings into pgvector
   ```
   Then log in as `admin@acme.test` / `demo1234` (or any seeded email).

### Without Docker
- Backend: `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload`
- Frontend: `cd frontend && npm install && npm run dev`

## Deploy (free tier)
- **Backend → Render:** connect repo, it reads `render.yaml`; set the secret env vars (Supabase, Gemini/Groq) + `CORS_ORIGINS` = your Vercel URL. Free tier cold-starts ~50s after idle.
- **Frontend → Vercel:** import `frontend/`, it reads `vercel.json`; set `VITE_API_URL` = Render URL and the `VITE_SUPABASE_*` vars.

## Docs
- `plan.md` — phased build plan + requirement coverage map
- `docs/ARCHITECTURE.md` — diagrams (TBD)
- `docs/DECISIONS.md` — decision log (TBD)
