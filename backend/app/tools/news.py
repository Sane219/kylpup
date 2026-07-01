"""News + sentiment tool — Yahoo Finance news via yfinance (no key, per-ticker,
and NOT IP-blocked on cloud like DuckDuckGo, which 403-ratelimits cloud IPs hard).
Sentiment is one batched LLM pass over all headlines (get_news_multi), with the
lexicon as a keyless offline fallback so a dropped LLM call never nulls it."""
import json
import logging
from datetime import datetime, timezone

from app.core.cache import ttl_cache

log = logging.getLogger("klypup")

SOURCE = "yahoo-finance-news"

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
def get_news(ticker: str, max_results: int = 8) -> list[dict]:
    """Recent articles for a ticker, newest first, with lexicon sentiment (the LLM
    pass in get_news_multi refines it). yfinance nests fields under 'content'."""
    import yfinance as yf  # lazy: heavy import off the cold/test path
    try:
        rows = yf.Ticker(ticker).news or []
    except Exception as e:
        log.warning("yahoo news failed for %s: %s", ticker, e)
        return []
    out = []
    for r in rows[:max_results]:
        c = r.get("content") or r  # newer yfinance nests under 'content'
        title = c.get("title") or ""
        body = c.get("summary") or c.get("description") or ""
        url = (c.get("canonicalUrl") or c.get("clickThroughUrl") or {}).get("url") or c.get("link")
        publisher = (c.get("provider") or {}).get("displayName") or c.get("publisher")
        label, score = _sentiment(f"{title} {body}")
        out.append({
            "title": title,
            "url": url,
            "publisher": publisher,
            "date": c.get("pubDate") or c.get("displayTime"),
            "excerpt": body[:280],
            "sentiment": label,
            "sentiment_score": score,
            "source": SOURCE,
        })
    return out


_SENT_SYSTEM = """You label financial news headlines by sentiment toward the stock.
You are given a JSON array of {"id", "text"}. Return ONLY:
{"labels": [{"id": <int>, "sentiment": "positive|negative|neutral", "score": <float -1..1>}, ...]}
score is signed confidence: strongly positive ~+0.8, mildly negative ~-0.3, neutral 0.
Return one entry per input id, same ids."""

_LABELS = {"positive", "negative", "neutral"}


def _llm_sentiment(articles: list[dict]) -> None:
    """One batched LLM call over every headline; overwrites sentiment in place.
    On any failure the lexicon labels already set by get_news stay untouched."""
    items = [{"id": i, "text": f"{a.get('title','')} {a.get('excerpt','')}"[:300]}
             for i, a in enumerate(articles) if a.get("title")]
    if not items:
        return
    try:
        from app.services.llm import chat_json  # lazy: keeps tool importable without LLM env
        out = chat_json(_SENT_SYSTEM, json.dumps(items))
        for lab in out.get("labels", []):
            i = lab.get("id")
            if isinstance(i, int) and 0 <= i < len(articles) and lab.get("sentiment") in _LABELS:
                articles[i]["sentiment"] = lab["sentiment"]
                s = lab.get("score")
                articles[i]["sentiment_score"] = round(float(s), 2) if isinstance(s, (int, float)) else 0.0
    except Exception as e:  # keep lexicon fallback labels
        log.warning("llm sentiment failed, keeping lexicon labels: %s", e)


def get_news_multi(tickers: list[str]) -> dict[str, list[dict]]:
    by_ticker = {tk.upper(): get_news(tk) for tk in tickers}
    all_articles = [a for arts in by_ticker.values() for a in arts]
    _llm_sentiment(all_articles)  # one batched call for the whole query
    return by_ticker


if __name__ == "__main__":  # ponytail: lexicon self-check, no network
    assert _sentiment("revenue surge and record profit")[0] == "positive"
    assert _sentiment("earnings miss sparks lawsuit and plunge")[0] == "negative"
    assert _sentiment("company holds annual meeting")[0] == "neutral"
    print("ok", datetime.now(timezone.utc).isoformat())
