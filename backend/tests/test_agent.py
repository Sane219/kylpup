"""Agent orchestration: the router must select only the tools the query needs,
and the two-call flow must thread citations through. External LLM + tools mocked."""
import asyncio

import app.services.agent as agent


def _patch(monkeypatch, plan):
    calls = []

    def fake_chat(system, user):
        calls.append("router" if "planner" in system else "synth")
        if "planner" in system:
            return plan
        return {"summary": "ok", "company_cards": [{"ticker": "TSLA", "citation": "yfinance"}],
                "sources_used": ["yfinance"]}

    monkeypatch.setattr(agent, "chat_json", fake_chat)
    monkeypatch.setattr(agent.market, "get_quotes", lambda t: [{"ticker": x, "source": "yfinance"} for x in t])
    monkeypatch.setattr(agent.news, "get_news_multi", lambda t: {x: [] for x in t})
    monkeypatch.setattr(agent.filings, "search_filings", lambda q, tk=None, k=5: [])
    return calls


def test_news_only_query_skips_market_and_filings(monkeypatch):
    _patch(monkeypatch, {"companies": ["TSLA"], "fetch_market": False,
                         "fetch_news": True, "search_filings": False})
    out = asyncio.run(agent.run_research("any recent news on Tesla?"))
    assert out["_plan"]["fetch_news"] is True
    assert out["_plan"]["fetch_market"] is False
    assert out["_plan"]["search_filings"] is False


def test_two_llm_calls_and_citation_threaded(monkeypatch):
    calls = _patch(monkeypatch, {"companies": ["TSLA", "F"], "fetch_market": True,
                                 "fetch_news": True, "search_filings": False})
    out = asyncio.run(agent.run_research("compare Tesla and Ford"))
    assert calls == ["router", "synth"]  # exactly router + synthesizer
    assert out["company_cards"][0]["citation"] == "yfinance"


def test_router_defaults_fill_missing_keys(monkeypatch):
    _patch(monkeypatch, {"companies": ["AAPL"]})  # router returned a sparse plan
    out = asyncio.run(agent.run_research("Apple"))
    for k in ("fetch_market", "fetch_news", "search_filings"):
        assert k in out["_plan"]
