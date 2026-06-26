"""SEC filing knowledge base — pgvector similarity search.
Embeds the query with the same model used at ingest, then calls the
match_filing_chunks RPC. Every hit carries source_ref for attribution."""
from app.services.db import db
from app.services.embeddings import embed_one

SOURCE = "sec-filing-kb"


def search_filings(query: str, ticker: str | None = None, k: int = 5) -> list[dict]:
    try:
        vec = embed_one(query)
        res = db().rpc("match_filing_chunks", {
            "query_embedding": vec,
            "match_count": k,
            "filter_ticker": ticker.upper() if ticker else None,
        }).execute()
    except Exception:
        return []
    return [{
        "ticker": r["ticker"],
        "excerpt": r["chunk"],
        "source_ref": r["source_ref"],
        "similarity": round(r["similarity"], 3),
        "source": SOURCE,
    } for r in (res.data or [])]
