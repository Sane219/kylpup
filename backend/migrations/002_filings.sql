-- Phase 2: SEC filing vector store. Gemini text-embedding-004 -> 768 dims.
-- Knowledge base is shared reference data (not tenant-scoped) — same filings
-- for every org, so no org_id here.

create table if not exists filing_chunks (
  id         uuid primary key default gen_random_uuid(),
  ticker     text not null,
  chunk      text not null,
  source_ref text not null,            -- e.g. "AAPL 10-K FY2023 — Item 1A Risk Factors"
  embedding  vector(768) not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_filing_ticker on filing_chunks(ticker);
-- IVFFlat ANN index (cosine). ponytail: fine for a few thousand chunks; bump
-- lists / switch to HNSW only if the KB grows large.
create index if not exists idx_filing_embedding
  on filing_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 10);

-- Similarity search RPC, optionally filtered by ticker. Called via supabase.rpc().
create or replace function match_filing_chunks(
  query_embedding vector(768),
  match_count int default 5,
  filter_ticker text default null
)
returns table (ticker text, chunk text, source_ref text, similarity float)
language sql stable as $$
  select fc.ticker, fc.chunk, fc.source_ref,
         1 - (fc.embedding <=> query_embedding) as similarity
  from filing_chunks fc
  where filter_ticker is null or fc.ticker = filter_ticker
  order by fc.embedding <=> query_embedding
  limit match_count
$$;
