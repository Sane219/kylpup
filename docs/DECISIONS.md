# Decisions

Filled in over the build; seeded here so choices are captured as they're made.

- **Challenge:** Investment Research Dashboard (Option A).
- **Stack:** FastAPI + React/Vite + Supabase + Gemini. Rationale + alternatives — TBD.
- **LLM:** Gemini 2.0 Flash primary (native JSON mode, large free tier); Groq Llama-3 fallback for speed. Wrapped behind one module so swap is one line.
- **Multi-tenancy:** `org_id` column + FastAPI tenant dependency scopes every query. Supabase service key bypasses RLS, so isolation is enforced in app code; RLS policies added as defense-in-depth.
- **News source:** duckduckgo-search/RSS instead of NewsAPI — NewsAPI free tier blocks cloud server IPs and would crash on Render.
- **Deploy:** Render free tier cold-starts (~50s on first request after idle) — known limitation.
- **Auth flow (Phase 1):** Supabase Auth as IdP. Signup creates a new org (caller→admin) or joins via invite_code (caller→analyst). `org_id`+`role` are written to the user's **`app_metadata`** (server-controlled, not user-editable) so they ride inside the JWT and need no extra DB lookup per request. JWT verified in `core/auth.py` (HS256, `aud=authenticated`).
- **Security review (STRIDE, Phase 1):** tenant boundary checks pass — server-controlled role (no privilege spoofing), audit_logs for repudiation, secret scan clean, RLS as defense-in-depth. **Forward rule for Phase 4 (IDOR):** every single-resource read/update/delete must filter by BOTH `org_id` AND `id`, never `id` alone.
- **5-day trade-offs / 2-more-weeks / hardest part:** TBD.

## TODO (deferred, not blockers)
- Live Supabase project + keys needed to run Phase 1 end-to-end (signup/login). Code is complete; set `SUPABASE_*` in `backend/.env` and run `migrations/001_init.sql` in the Supabase SQL editor.
- Email confirmation disabled (`email_confirm: True` on admin create) for demo simplicity — re-enable for production.
