# Decisions

Filled in over the build; seeded here so choices are captured as they're made.

- **Challenge:** Investment Research Dashboard (Option A).
- **Stack:** FastAPI + React/Vite + Supabase + Gemini. Rationale + alternatives — TBD.
- **LLM:** Gemini 2.0 Flash primary (native JSON mode, large free tier); Groq Llama-3 fallback for speed. Wrapped behind one module so swap is one line.
- **Multi-tenancy:** `org_id` column + FastAPI tenant dependency scopes every query. Supabase service key bypasses RLS, so isolation is enforced in app code; RLS policies added as defense-in-depth.
- **News source:** duckduckgo-search/RSS instead of NewsAPI — NewsAPI free tier blocks cloud server IPs and would crash on Render.
- **Deploy:** Render free tier cold-starts (~50s on first request after idle) — known limitation.
- **5-day trade-offs / 2-more-weeks / hardest part:** TBD.
