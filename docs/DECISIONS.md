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

- **Data tools (Phase 2):** market=`yfinance` (no key), news=`duckduckgo-search` (avoids NewsAPI cloud-IP blocks) with lexicon sentiment (upgrade path: VADER/LLM noted in code), filings=pgvector via Gemini `text-embedding-004` (768-dim). Chunking = 1000-char windows w/ 150 overlap on paragraph boundaries. Every tool return carries a `source`/`source_ref` field. TTL cache (5–10 min) on market/news for rate-limit + cost relief. One bad ticker never sinks a batch.
- **KB is shared reference data**, not tenant-scoped — same sample filings for all orgs (4 companies: AAPL, TSLA, NVDA, JPM), so `filing_chunks` has no `org_id`.

- **AI orchestration (Phase 3):** two-call agentic flow. (1) **Router** LLM → JSON plan choosing tools per query (not hardcoded — verified that a news-only query skips market/filings). (2) Selected tools run concurrently via `asyncio.to_thread` + `gather` (sync libs, capped at 6 tickers; one tool failing degrades gracefully, doesn't crash). (3) **Synthesizer** LLM → structured UI JSON (`company_cards`, `comparison_table`, `news_sentiment`, `filing_insights`, `risks`, `sources_used`) with a `citation` on every item. **Prompt-engineering decisions:** schema-first, native JSON mode (Gemini `response_mime_type`, Groq `json_object`) instead of "respond only in JSON" hacks; low temperature (0.2); "use ONLY provided tool data, do not invent numbers" grounding rule. Provider abstraction in `services/llm.py` retries x2 then fails over Gemini↔Groq.

## TODO (deferred, not blockers)
- Run `migrations/002_filings.sql` then `python scripts/ingest.py` (needs `GEMINI_API_KEY` + Supabase creds) to populate the vector store. Filing search returns [] gracefully until then.
- Live Supabase project + keys needed to run Phase 1 end-to-end (signup/login). Code is complete; set `SUPABASE_*` in `backend/.env` and run `migrations/001_init.sql` in the Supabase SQL editor.
- Email confirmation disabled (`email_confirm: True` on admin create) for demo simplicity — re-enable for production.
