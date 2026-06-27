# Klypup

**Investment research, structured into a terminal.**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Build](https://img.shields.io/github/actions/workflow/status/Sane219/kylpup/ci.yml?branch=main)](https://github.com/Sane219/kylpup/actions)
[![Python](https://img.shields.io/badge/python-3.12+-blue.svg)](backend/requirements.txt)
[![TypeScript](https://img.shields.io/badge/typescript-5.5+-blue.svg)](frontend/package.json)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green.svg)](backend/requirements.txt)
[![React](https://img.shields.io/badge/react-19-blue.svg)](frontend/package.json)

---

Klypup is a multi-tenant investment research dashboard. An analyst types a natural-language query — an agentic LLM flow orchestrates market data, news sentiment analysis, and SEC filing vector search — and the results render as structured UI with cited sources, comparison tables, and charts.

Built as a three-tier architecture: **React/Vite SPA** (Vercel) → **FastAPI backend** (Render) → **Supabase Postgres + pgvector** (DB, auth, vector store).

---

## Features

- **Natural-language research** — Ask "Compare NVDA and AMD: revenue, valuation, and risks" and get a structured, sourced desk note
- **Agentic AI flow** — Router LLM picks which tools to run (market, news, filings); synthesizer LLM writes the analysis; editor LLM self-critiques
- **Live market tape** — Scrolling ticker with real yfinance data, cosmetic price jitter, and flash animations on tick direction changes
- **SEC filing vector search** — pgvector similarity search over 10-K/10-Q passages with Gemini embeddings and source citations
- **News sentiment** — DuckDuckGo news with lexicon-based positive/negative/neutral scoring
- **Multi-tenant with RBAC** — Org-scoped data isolation enforced in app code; admin/analyst roles
- **Dark/light themes** — OKLCH design tokens, terminal aesthetic, reduced-motion support
- **⌘K command palette** — Quick navigation, theme toggle, and direct research queries

---

## Quick Start

### Docker (one command)

```bash
docker-compose up
```

Frontend at `http://localhost:5173`, backend at `http://localhost:8000`.

### Manual setup

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend (separate terminal)
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && uvicorn app.main:app --reload
```

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full setup guide (database migrations, seeding, env vars).

### Demo credentials

```
Email:    admin@acme.test
Password: demo1234
```

---

## Documentation

| Guide | Description |
|-------|-------------|
| [Architecture Guide](docs/architecture.md) | System diagrams, data flow, AI orchestration, embedding pipeline, tenant isolation |
| [API Reference](docs/api-reference.md) | All endpoints, request/response schemas, error codes |
| [Decision Log](docs/DECISIONS.md) | Architecture Decision Records and trade-off rationale |
| [Contributing Guide](CONTRIBUTING.md) | Setup, workflow, conventions, CI/CD |

---

## Architecture at a Glance

```
User query → Router LLM → parallel tools → Synthesizer LLM → structured UI
                │              │
           picks tools      yfinance, DDG news,
           & tickers        pgvector filings
```

The backend runs two LLM calls. The **router** turns a natural-language query into a JSON execution plan. The backend runs only the selected tools concurrently (`asyncio.gather`). The **synthesizer** produces a strict JSON UI state with every data point carrying a source citation. A third **editor** LLM self-critiques the draft and triggers a refine pass if gaps are found.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 5, Tailwind CSS, Recharts |
| Backend | Python 3.12+, FastAPI, Uvicorn |
| Database | Supabase Postgres + pgvector |
| Auth | Supabase Auth (ES256 JWTs) |
| LLM | Google Gemini 2.5 Flash (primary), Groq Llama 3.3 70B (fallback) |
| Market data | yfinance |
| News | DuckDuckGo News |
| Embeddings | Gemini text-embedding-001 (3072-dim) |
| Vector search | pgvector IVFFlat, cosine distance |
| CI/CD | GitHub Actions (ruff, pytest, vitest, tsc, gitleaks) |

---

## Project Status

Klypup is a 5-day take-home assessment. All phases are substantially built. The frontend has undergone a visual redesign (Bloomberg-modern terminal aesthetic). See [`plan.md`](plan.md) for the original build plan and [`docs/DECISIONS.md`](docs/DECISIONS.md) for trade-off rationale.
