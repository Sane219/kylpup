"""Market data tool — yfinance. Free, no key, no cloud-IP blocks.
Returns JSON-serializable dicts; every record carries source='yfinance'."""
import math

from app.core.cache import ttl_cache

SOURCE = "yfinance"


@ttl_cache(seconds=300)
def get_quote(ticker: str) -> dict:
    """Key metrics + recent close for one ticker."""
    import yfinance as yf  # lazy: heavy import off the cold/test path
    t = yf.Ticker(ticker)
    info = t.info or {}
    hist = t.history(period="3mo")
    prices = [
        {"date": d.strftime("%Y-%m-%d"), "close": round(float(c), 2)}
        for d, c in hist["Close"].items() if not math.isnan(float(c))
    ] if not hist.empty else []
    return {
        "ticker": ticker.upper(),
        "name": info.get("shortName") or info.get("longName"),
        "price": info.get("currentPrice") or info.get("regularMarketPrice"),
        "currency": info.get("currency"),
        "market_cap": info.get("marketCap"),
        "pe_ratio": info.get("trailingPE"),
        "eps": info.get("trailingEps"),
        "revenue": info.get("totalRevenue"),
        "volume": info.get("volume") or info.get("regularMarketVolume"),
        "fifty_two_week_high": info.get("fiftyTwoWeekHigh"),
        "fifty_two_week_low": info.get("fiftyTwoWeekLow"),
        "history": prices,
        "source": SOURCE,
    }


def get_quotes(tickers: list[str]) -> list[dict]:
    out = []
    for tk in tickers:
        try:
            out.append(get_quote(tk))
        except Exception as e:  # one bad ticker must not sink the batch
            out.append({"ticker": tk.upper(), "error": str(e), "source": SOURCE})
    return out


# Friendly tape symbols -> yfinance tickers (indices / rates / crypto).
INDEX_MAP = {
    "SPX": "^GSPC", "NDX": "^NDX", "DJI": "^DJI",
    "VIX": "^VIX", "BTC": "BTC-USD", "US10Y": "^TNX",
}


def _safe_float(v):
    try:
        f = float(v)
        return None if math.isnan(f) or math.isinf(f) else f
    except (TypeError, ValueError):
        return None

def _safe_round(v, dp):
    f = _safe_float(v)
    return round(f, dp) if f is not None else None

@ttl_cache(seconds=120)
def quote_compact(yf_ticker: str) -> dict:
    """Light quote for the live tape: last price, prev close, short history.
    Uses fast_info (no slow .info scrape) so a paginated board stays snappy."""
    import yfinance as yf
    t = yf.Ticker(yf_ticker)
    fi = t.fast_info
    price = _safe_float(fi.last_price)
    prev = _safe_float(fi.previous_close)
    hist = t.history(period="1mo")
    closes = [_safe_round(c, 4) for c in hist["Close"]] if not hist.empty else []
    closes = [c for c in closes if c is not None]
    return {"price": price, "prevClose": prev,
            "history": closes[-40:], "currency": getattr(fi, "currency", None)}


def snapshot(symbols: list[str]) -> list[dict]:
    """Compact quotes for the dashboard tape / markets board. Names come from
    the frontend's universe; this returns price + change + sparkline only.
    One bad symbol returns an {error} entry instead of sinking the batch."""
    out = []
    for s in symbols:
        sym = s.upper()
        try:
            q = quote_compact(INDEX_MAP.get(sym, sym))
            price = q["price"] or q["prevClose"]
            prev = q["prevClose"] or price
            if price is None or prev is None:
                raise ValueError("no price data")
            out.append({
                "symbol": sym, "price": round(price, 4), "prevClose": round(prev, 4),
                "change": round(price - prev, 4),
                "changePct": round((price - prev) / prev * 100, 4) if prev else 0,
                "history": q["history"], "currency": q["currency"], "source": SOURCE,
            })
        except Exception as e:
            out.append({"symbol": sym, "error": str(e), "source": SOURCE})
    return out


if __name__ == "__main__":  # ponytail: smoke check, needs network
    q = get_quote("AAPL")
    assert q["ticker"] == "AAPL" and q["source"] == "yfinance"
    snap = snapshot(["AAPL", "SPX"])
    assert snap[0]["symbol"] == "AAPL" and "price" in snap[0]
    print("ok", q["price"], snap[1])
