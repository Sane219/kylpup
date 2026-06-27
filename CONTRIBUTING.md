<p align="center">
  <img src="LOGO.png" alt="Klypup" width="240">
</p>

# Contributing

## Prerequisites

- Node.js 20+
- Python 3.12+
- Docker (optional, for one-command setup)
- A Supabase project (free tier works)
- API keys: Gemini (`GEMINI_API_KEY`) and/or Groq (`GROQ_API_KEY`)

## Local Setup

### 1. Clone and install

```bash
git clone https://github.com/your-org/kylpup.git
cd kylpup

# Frontend
cd frontend && npm install && cd ..

# Backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && cd ..
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Fill in `backend/.env` with your Supabase credentials and LLM API keys.
Fill in `frontend/.env` — at minimum `VITE_API_URL=http://localhost:8000`.

### 3. Run database migrations

```bash
# Apply migrations to your Supabase project via the SQL editor:
# Run backend/migrations/001_init.sql
# Run backend/migrations/002_filings.sql
```

### 4. Seed demo data (optional)

```bash
cd backend && source .venv/bin/activate
python scripts/seed.py
python scripts/ingest.py
```

### 5. Start the dev servers

**Option A — Docker (one command):**
```bash
docker-compose up
```
Frontend at `http://localhost:5173`, backend at `http://localhost:8000`.

**Option B — Separate terminals:**

```bash
# Terminal 1: backend
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload

# Terminal 2: frontend
cd frontend && npm run dev
```

### 6. Login

Use the seeded demo credentials: `admin@acme.test` / `demo1234`

## Project Structure

See [`docs/architecture.md`](docs/architecture.md) for the full directory tree and component diagram.

## Development Workflow

1. **Backend:** Edit Python files in `backend/app/`. FastAPI auto-reloads.
2. **Frontend:** Edit TypeScript/React files in `frontend/src/`. Vite HMR updates instantly.
3. **Tests (backend):** `cd backend && source .venv/bin/activate && python -m pytest`
4. **Tests (frontend):** `cd frontend && npm test`
5. **Lint (backend):** `cd backend && source .venv/bin/activate && ruff check .`
6. **Typecheck + build (frontend):** `cd frontend && npm run build`

## Code Conventions

- Python: ruff (FastAPI style), no `print()` in production code
- TypeScript: strict mode, no `any` where types exist
- All API responses use the `{data, meta}` / `{error, meta}` envelope
- Every database query that reads tenant data must filter by `org_id`
- Tool outputs must carry a `source` field for citation attribution
- Mark deliberate simplifications with `# ponytail: <reason>` comments

## CI/CD

The project runs GitHub Actions on every push:
- Backend: ruff linting, tenant scoping guard, pytest
- Frontend: TypeScript check, vitest, Vite build
- Secrets: gitleaks scan

## Deployment

- **Frontend:** Auto-deploys to Vercel from the `main` branch
- **Backend:** Auto-deploys to Render from the `main` branch
- See [`docs/architecture.md`](docs/architecture.md) for env var requirements

## Security Notes

- The backend uses Supabase's **service-role key** which bypasses RLS
- Tenant isolation is enforced in app code: every route depends on `get_current_tenant()` and filters queries by `org_id`
- If you add a route that reads tenant data without scoping by `org_id`, you've created a data leak
- Single-resource endpoints must filter by BOTH `org_id` AND `id` (IDOR guard)
