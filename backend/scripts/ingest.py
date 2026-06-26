"""Ingestion pipeline: read sample SEC filings -> chunk -> embed (Gemini) ->
store in Supabase pgvector (filing_chunks). Run once after migrations.

  cd backend && python scripts/ingest.py

Filename convention: <TICKER>_<DOCTYPE>_<PERIOD>.txt  (e.g. AAPL_10K_FY2023.txt)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.db import db                      # noqa: E402
from app.services.embeddings import embed_texts     # noqa: E402

DOCS = Path(__file__).parent / "sample_filings"
CHUNK_CHARS, OVERLAP = 1000, 150


def chunk(text: str) -> list[str]:
    """Fixed-size char windows with overlap (recursive-ish on blank lines)."""
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks, buf = [], ""
    for p in paras:
        if len(buf) + len(p) <= CHUNK_CHARS:
            buf = f"{buf}\n\n{p}".strip()
        else:
            if buf:
                chunks.append(buf)
            buf = (buf[-OVERLAP:] + "\n\n" + p) if buf else p
    if buf:
        chunks.append(buf)
    return chunks


def source_ref(fname: str, idx: int) -> str:
    ticker, doctype, period = (fname.replace(".txt", "").split("_") + ["", ""])[:3]
    return f"{ticker} {doctype} {period} — chunk {idx + 1}"


def main():
    sb = db()
    files = sorted(DOCS.glob("*.txt"))
    if not files:
        print("no sample filings found"); return
    rows = []
    for f in files:
        ticker = f.name.split("_")[0]
        chunks = chunk(f.read_text())
        embeddings = embed_texts(chunks)
        for i, (c, e) in enumerate(zip(chunks, embeddings)):
            rows.append({"ticker": ticker, "chunk": c,
                         "source_ref": source_ref(f.name, i), "embedding": e})
        print(f"  {f.name}: {len(chunks)} chunks")
    # ponytail: clear + reinsert keeps re-runs idempotent for a tiny KB
    sb.table("filing_chunks").delete().neq("ticker", "").execute()
    sb.table("filing_chunks").insert(rows).execute()
    print(f"ingested {len(rows)} chunks from {len(files)} filings")


if __name__ == "__main__":
    main()
