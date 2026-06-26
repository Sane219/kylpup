"""Market data tool — yfinance. Free, no key, no cloud-IP blocks.
Returns JSON-serializable dicts; every record carries source='yfinance'."""
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
        for d, c in hist["Close"].items()
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


if __name__ == "__main__":  # ponytail: smoke check, needs network
    q = get_quote("AAPL")
    assert q["ticker"] == "AAPL" and q["source"] == "yfinance"
    print("ok", q["price"])
