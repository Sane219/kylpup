"""Agentic orchestration: router (LLM picks tools) -> parallel tool execution
-> synthesizer (LLM -> structured UI state with citations).

Not a hardcoded sequence: if the router asks only for news, only news runs."""
import asyncio
import json
import logging

from app.services.llm import chat_json
from app.tools import filings, market, news

log = logging.getLogger("klypup")

ROUTER_SYSTEM = """You are a financial-research planner. Given an analyst's query,
output a JSON execution plan choosing which data tools to run. Only request tools
the query actually needs.

Output ONLY this JSON object:
{
  "companies": ["<TICKER>", ...],   // resolve names to tickers, e.g. Tesla->TSLA, Apple->AAPL
  "fetch_market": true|false,        // stock price / financial metrics
  "fetch_news": true|false,          // recent news + sentiment
  "search_filings": true|false,      // SEC filing / earnings / fundamentals lookup
  "filing_query": "<what to search filings for, or empty>"
}
If the user asks only about news, set fetch_market and search_filings to false."""

SYNTH_SYSTEM = """You are a financial research analyst. Using ONLY the tool data
provided, produce a structured analysis. Every figure and claim must cite its
source using the 'source' / 'source_ref' values present in the tool data. Do not
invent numbers. If data is missing, say so.

Output ONLY this JSON object:
{
  "summary": "<2-4 sentence executive summary>",
  "company_cards": [
    {"ticker": "", "name": "", "price": null, "market_cap": null, "pe_ratio": null,
     "eps": null, "revenue": null, "highlight": "", "citation": "yfinance"}
  ],
  "comparison_table": {
    "columns": ["Metric", "<TICKER>", ...],
    "rows": [["P/E", "..."], ["Market Cap", "..."]]
  },
  "news_sentiment": [
    {"ticker": "", "title": "", "sentiment": "positive|negative|neutral",
     "url": "", "citation": "<publisher>"}
  ],
  "filing_insights": [
    {"ticker": "", "insight": "", "citation": "<source_ref>"}
  ],
  "risks": [{"ticker": "", "risk": "", "citation": "<source>"}],
  "sources_used": ["yfinance", "duckduckgo-news", "sec-filing-kb"]
}
Omit arrays that have no supporting data (use [])."""


def _router(query: str) -> dict:
    plan = chat_json(ROUTER_SYSTEM, query)
    plan.setdefault("companies", [])
    for k in ("fetch_market", "fetch_news", "search_filings"):
        plan.setdefault(k, False)
    plan.setdefault("filing_query", query)
    return plan


async def _gather_tools(plan: dict) -> dict:
    tickers = [t.upper() for t in plan.get("companies", [])][:6]  # cap fan-out
    jobs, keys = [], []
    if plan.get("fetch_market") and tickers:
        jobs.append(asyncio.to_thread(market.get_quotes, tickers)); keys.append("market")
    if plan.get("fetch_news") and tickers:
        jobs.append(asyncio.to_thread(news.get_news_multi, tickers)); keys.append("news")
    if plan.get("search_filings"):
        fq = plan.get("filing_query") or "business overview and risk factors"
        async def _filings():
            return {tk: await asyncio.to_thread(filings.search_filings, fq, tk)
                    for tk in (tickers or [None])}
        jobs.append(_filings()); keys.append("filings")

    results = await asyncio.gather(*jobs, return_exceptions=True)
    data = {}
    for k, r in zip(keys, results):
        if isinstance(r, Exception):
            log.warning("tool %s failed: %s", k, r)
            data[k] = {"error": str(r)}
        else:
            data[k] = r
    return data


async def run_research(query: str) -> dict:
    """Full flow. Returns the structured UI state + the plan + raw tool data
    (raw kept for debugging/source verification, frontend uses the structured keys)."""
    plan = _router(query)
    tool_data = await _gather_tools(plan)
    synth_input = json.dumps({"query": query, "tool_data": tool_data})[:60000]
    ui_state = chat_json(SYNTH_SYSTEM, synth_input)
    ui_state["_plan"] = plan
    return ui_state
