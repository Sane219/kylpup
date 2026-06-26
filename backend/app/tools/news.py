"""News + sentiment tool — DuckDuckGo news (no key, not IP-blocked on cloud
like NewsAPI). Lexicon sentiment keeps it dependency-light.
ponytail: swap _sentiment for VADER or an LLM pass if accuracy matters."""
from datetime import datetime, timezone

from duckduckgo_search import DDGS

from app.core.cache import ttl_cache

SOURCE = "duckduckgo-news"

_POS = {"surge", "beat", "beats", "growth", "record", "profit", "gain", "gains",
        "upgrade", "bullish", "soar", "strong", "rally", "rises", "rose", "jump"}
_NEG = {"miss", "misses", "loss", "drop", "fall", "falls", "fell", "decline",
        "downgrade", "bearish", "plunge", "weak", "lawsuit", "probe", "cuts", "slump"}


def _sentiment(text: str) -> tuple[str, float]:
    words = set(text.lower().replace(",", " ").replace(".", " ").split())
    p, n = len(words & _POS), len(words & _NEG)
    if p == n:
        return "neutral", 0.0
    score = (p - n) / (p + n)
    return ("positive" if score > 0 else "negative"), round(score, 2)


@ttl_cache(seconds=600)
def get_news(ticker: str, max_results: int = 6) -> list[dict]:
    """Recent articles for a ticker/company, newest first, with sentiment."""
    try:
        rows = DDGS().news(f"{ticker} stock", max_results=max_results) or []
    except Exception:
        return []
    out = []
    for r in rows:
        label, score = _sentiment(f"{r.get('title','')} {r.get('body','')}")
        out.append({
            "title": r.get("title"),
            "url": r.get("url"),
            "publisher": r.get("source"),
            "date": r.get("date"),
            "excerpt": (r.get("body") or "")[:280],
            "sentiment": label,
            "sentiment_score": score,
            "source": SOURCE,
        })
    return out


def get_news_multi(tickers: list[str]) -> dict[str, list[dict]]:
    return {tk.upper(): get_news(tk) for tk in tickers}


if __name__ == "__main__":  # ponytail: lexicon self-check, no network
    assert _sentiment("revenue surge and record profit")[0] == "positive"
    assert _sentiment("earnings miss sparks lawsuit and plunge")[0] == "negative"
    assert _sentiment("company holds annual meeting")[0] == "neutral"
    print("ok", datetime.now(timezone.utc).isoformat())
