"""Gemini text embeddings (text-embedding-004, 768-dim) for the filing store.
Used by both the ingestion script and query-time search so vectors match."""
from app.core.config import settings

MODEL = "gemini-embedding-001"
DIM = 3072

_client = None


def _c():
    global _client
    if _client is None:
        from google import genai
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


def embed_texts(texts: list[str]) -> list[list[float]]:
    res = _c().models.embed_content(model=MODEL, contents=texts)
    return [e.values for e in res.embeddings]


def embed_one(text: str) -> list[float]:
    return embed_texts([text])[0]
