"""Agentic orchestration: router (LLM picks tools) -> parallel tool execution
-> synthesizer (LLM -> structured UI state with citations).

Not a hardcoded sequence: if the router asks only for news, only news runs."""
import asyncio
import json
import logging
import threading

from app.services.llm import chat_json, chat_json_thinking, stream_thinking
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
  "fetch_insider": true|false,       // insider (Form 3/4/5) trades + analyst price targets & ratings
  "search_filings": true|false,      // SEC filing / earnings / fundamentals lookup
  "filing_query": "<what to search filings for, or empty>",
  "reasoning": "<1-2 sentences: why these tickers and these tools for this query>"
}
If the user asks only about news, set fetch_market and search_filings to false.
Set fetch_insider=true whenever the query is directional or forward-looking about the
price (e.g. "will it rise or fall", "is it a buy", "should I buy/sell", "upside",
"price target", "what's it worth") or explicitly asks about insider buying/selling —
analyst targets and insider trades are the core signal for those questions."""

SYNTH_SYSTEM = """You are a senior financial research analyst writing a desk note
for a portfolio manager. Using ONLY the tool data provided, produce a thorough,
specific, structured analysis. Every figure and claim must cite its source using
the 'source' / 'source_ref' / publisher values present in the tool data. Do not
invent numbers. If data is missing, say so plainly rather than guessing.

Write real analytical prose, not fragments. Be quantitative: reference actual
prices, multiples, growth rates and headlines from the data. The reader wants
depth, not a summary of a summary.

Output ONLY this JSON object:
{
  "summary": "<4-6 sentence executive summary that directly answers the query, leading with the conclusion>",
  "key_takeaways": ["<specific, quantified insight>", "..."],
  "company_cards": [
    {"ticker": "", "name": "", "price": null, "market_cap": null, "pe_ratio": null,
     "eps": null, "revenue": null,
     "highlight": "<one punchy headline-style line>",
     "thesis": "<2-3 sentences: the company's position, valuation read, and what the data shows>",
     "citation": "yfinance"}
  ],
  "comparison_table": {
    "columns": ["Metric", "<TICKER>", ...],
    "rows": [["P/E", "..."], ["Market Cap", "..."], ["Revenue", "..."], ["EPS", "..."]]
  },
  "news_sentiment": [
    {"ticker": "", "title": "", "sentiment": "positive|negative|neutral",
     "takeaway": "<why this headline matters in one line>",
     "url": "", "citation": "<publisher>"}
  ],
  "filing_insights": [
    {"ticker": "", "insight": "<a substantive point drawn from the filing text>", "citation": "<source_ref>"}
  ],
  "insider_activity": [
    {"ticker": "", "signal": "<what insider trades + analyst targets imply, e.g. 'net insider buying; mean target $210 (+12%)'>",
     "target_mean": null, "target_high": null, "target_low": null, "citation": "yfinance"}
  ],
  "opportunities": [{"ticker": "", "opportunity": "<a credible upside / catalyst grounded in the data>", "citation": "<source>"}],
  "risks": [{"ticker": "", "risk": "<a concrete, specific risk>", "citation": "<source>"}],
  "outlook": "<2-4 sentence forward-looking synthesis weighing the opportunities against the risks>",
  "sources_used": ["yfinance", "yahoo-finance-news", "sec-filing-kb"]
}
Provide 3-6 key_takeaways. Write full sentences in thesis/outlook/insight/takeaway.
Omit arrays that have no supporting data (use [])."""

CRITIQUE_SYSTEM = """You are a skeptical research editor reviewing a draft analysis
before it ships to a portfolio manager. You are given the analyst's query, the draft
(JSON), and the raw tool_data the draft must be grounded in.

Find substantive, FIXABLE problems: claims or numbers not supported by tool_data,
missing citations, parts of the query left unanswered, vague or generic statements,
or comparisons the query asked for but the draft omitted. Judge only against the
query and the available tool_data; do not invent new requirements or ask for data
that was never fetched.

Output ONLY this JSON:
{"issues": ["<specific, actionable problem>", ...], "needs_revision": true|false}
Set needs_revision true only if there is at least one real, fixable issue. If the
draft is solid and well-grounded, return {"issues": [], "needs_revision": false}."""


def _normalize_plan(plan: dict, query: str) -> dict:
    plan.setdefault("companies", [])
    for k in ("fetch_market", "fetch_news", "fetch_insider", "search_filings"):
        plan.setdefault(k, False)
    plan.setdefault("filing_query", query)
    plan.setdefault("reasoning", "")
    return plan


def _router(query: str) -> dict:
    return _normalize_plan(chat_json(ROUTER_SYSTEM, query), query)


def _summary(key: str, r) -> str | None:
    """One-line, human-readable result count for the live agent trace."""
    if isinstance(r, dict) and set(r) == {"error"}:
        return None
    if key == "market" and isinstance(r, list):
        ok = [x for x in r if isinstance(x, dict) and "error" not in x]
        return f"{len(ok)} quote{'s' if len(ok) != 1 else ''}"
    if key == "news" and isinstance(r, dict):
        n = sum(len(v or []) for v in r.values())
        return f"{n} article{'s' if n != 1 else ''}"
    if key == "filings" and isinstance(r, dict):
        n = sum(len(v or []) for v in r.values())
        return f"{n} passage{'s' if n != 1 else ''}"
    if key == "insider" and isinstance(r, dict):
        n = sum(len(v.get("insider_transactions", []) or []) for v in r.values() if isinstance(v, dict))
        return f"{n} insider trade{'s' if n != 1 else ''}"
    if isinstance(r, list):
        return f"{len(r)} record{'s' if len(r) != 1 else ''}"
    if isinstance(r, dict):
        return f"{len(r)} group{'s' if len(r) != 1 else ''}"
    return None


def _preview(key: str, r) -> list[dict]:
    """Render-ready result rows for the live trace, so the UI can show what each
    tool actually returned (ticker -> headline value + supporting line)."""
    if isinstance(r, dict) and set(r) == {"error"}:
        return []
    if key == "market" and isinstance(r, list):
        return [{"label": x.get("ticker"),
                 "value": f"${x['price']:,.2f}" if isinstance(x.get("price"), (int, float)) else "n/a",
                 "sub": x.get("name") or ""}
                for x in r if isinstance(x, dict) and "error" not in x][:6]
    if key == "news" and isinstance(r, dict):
        rows = []
        for tk, arts in r.items():
            arts = arts or []
            top = arts[0].get("title") if arts else "no recent coverage"
            rows.append({"label": tk, "value": f"{len(arts)} article{'s' if len(arts) != 1 else ''}",
                         "sub": (top or "")[:90]})
        return rows[:6]
    if key == "filings" and isinstance(r, dict):
        rows = []
        for tk, hits in r.items():
            hits = hits or []
            ref = hits[0].get("source_ref") if hits else "no matching passages"
            rows.append({"label": tk or "filings", "value": f"{len(hits)} passage{'s' if len(hits) != 1 else ''}",
                         "sub": (ref or "")[:90]})
        return rows[:6]
    if key == "insider" and isinstance(r, dict):
        rows = []
        for tk, d in r.items():
            if not isinstance(d, dict):
                continue
            trades = d.get("insider_transactions", []) or []
            mean = (d.get("price_targets") or {}).get("mean")
            val = f"target ${mean:,.0f}" if isinstance(mean, (int, float)) else f"{len(trades)} trade{'s' if len(trades) != 1 else ''}"
            top = trades[0] if trades else None
            sub = f"{top.get('insider','')} {top.get('transaction','')}".strip() if top else "no recent insider trades"
            rows.append({"label": tk, "value": val, "sub": sub[:90]})
        return rows[:6]
    return []


async def _gather_tools(plan: dict) -> dict:
    tickers = [t.upper() for t in plan.get("companies", [])][:6]  # cap fan-out
    jobs, keys = [], []
    if plan.get("fetch_market") and tickers:
        jobs.append(asyncio.to_thread(market.get_quotes, tickers)); keys.append("market")
    if plan.get("fetch_news") and tickers:
        jobs.append(asyncio.to_thread(news.get_news_multi, tickers)); keys.append("news")
    if plan.get("fetch_insider") and tickers:
        jobs.append(asyncio.to_thread(market.get_insider_multi, tickers)); keys.append("insider")
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


async def _stream_llm(system: str, user: str, budget: int):
    """Bridge the blocking stream_thinking generator into async land via a thread
    + queue, yielding ('thought'|'answer', chunk) and ('error', msg) on failure."""
    loop = asyncio.get_running_loop()
    q: asyncio.Queue = asyncio.Queue()

    def worker():
        try:
            for item in stream_thinking(system, user, budget):
                loop.call_soon_threadsafe(q.put_nowait, item)
        except Exception as e:
            loop.call_soon_threadsafe(q.put_nowait, ("error", str(e)))
        finally:
            loop.call_soon_threadsafe(q.put_nowait, None)

    threading.Thread(target=worker, daemon=True).start()
    while True:
        item = await q.get()
        if item is None:
            break
        yield item


async def _think_and_parse(system: str, user: str, budget: int, stage: str):
    """Stream a reasoning call: forwards live 'thinking' events (with `delta`),
    accumulates the JSON answer, and yields a final {'type':'_parsed'} sentinel.
    Falls back to a single non-streaming call if streaming or JSON parsing fails,
    so a run never dies on a dropped chunk."""
    answer, errored = [], False
    async for kind, chunk in _stream_llm(system, user, budget):
        if kind == "thought":
            yield {"type": "thinking", "stage": stage, "delta": chunk}
        elif kind == "answer":
            answer.append(chunk)
        elif kind == "error":
            errored = True

    parsed = None
    if not errored and answer:
        try:
            parsed = json.loads("".join(answer))
        except Exception:
            parsed = None
    if parsed is None:  # fallback path: non-streaming, emit thoughts in one shot
        parsed, thoughts = await asyncio.to_thread(chat_json_thinking, system, user, budget)
        if thoughts:
            yield {"type": "thinking", "stage": stage, "delta": thoughts}
    yield {"type": "_parsed", "data": parsed}


async def stream_research(query: str):
    """Same flow as run_research, but yields events as the agent works so the
    UI can show the plan, each tool call, and synthesis live. Each event is a
    JSON-serializable dict with a 'type'. The final 'result' carries the UI state."""
    yield {"type": "status", "stage": "routing"}
    raw_plan = None
    async for ev in _think_and_parse(ROUTER_SYSTEM, query, 512, "routing"):
        if ev["type"] == "_parsed":
            raw_plan = ev["data"]
        else:
            yield ev
    plan = _normalize_plan(raw_plan or {}, query)
    yield {"type": "plan", "plan": plan}

    tickers = [t.upper() for t in plan.get("companies", [])][:6]  # cap fan-out
    coros = {}
    if plan.get("fetch_market") and tickers:
        coros["market"] = asyncio.to_thread(market.get_quotes, tickers)
    if plan.get("fetch_news") and tickers:
        coros["news"] = asyncio.to_thread(news.get_news_multi, tickers)
    if plan.get("fetch_insider") and tickers:
        coros["insider"] = asyncio.to_thread(market.get_insider_multi, tickers)
    if plan.get("search_filings"):
        fq = plan.get("filing_query") or "business overview and risk factors"

        async def _filings():
            return {tk: await asyncio.to_thread(filings.search_filings, fq, tk)
                    for tk in (tickers or [None])}
        coros["filings"] = _filings()

    for k in coros:
        yield {"type": "tool", "tool": k, "status": "running"}

    async def _wrap(k, coro):
        try:
            return k, await coro, None
        except Exception as e:  # one tool failing must not fail the query
            log.warning("tool %s failed: %s", k, e)
            return k, {"error": str(e)}, str(e)

    tool_data = {}
    for fut in asyncio.as_completed([_wrap(k, c) for k, c in coros.items()]):
        k, r, err = await fut
        tool_data[k] = r
        yield {"type": "tool", "tool": k, "status": "error" if err else "done",
               "summary": _summary(k, r), "preview": _preview(k, r), "error": err}

    # 1) draft synthesis (thinking streamed live)
    yield {"type": "synth", "status": "running"}
    synth_input = json.dumps({"query": query, "tool_data": tool_data})[:60000]
    draft = None
    async for ev in _think_and_parse(SYNTH_SYSTEM, synth_input, 2048, "synth"):
        if ev["type"] == "_parsed":
            draft = ev["data"]
        else:
            yield ev
    yield {"type": "synth", "status": "done"}

    # 2) self-critique: a skeptical editor pass looks for gaps in the draft
    yield {"type": "review", "status": "running"}
    critique = None
    if draft:
        crit_input = json.dumps({"query": query, "draft": draft, "tool_data": tool_data})[:60000]
        async for ev in _think_and_parse(CRITIQUE_SYSTEM, crit_input, 1024, "critique"):
            if ev["type"] == "_parsed":
                critique = ev["data"]
            else:
                yield ev
    issues = critique.get("issues", []) if isinstance(critique, dict) else []
    needs_revision = bool(isinstance(critique, dict) and critique.get("needs_revision") and issues)
    yield {"type": "review", "status": "done",
           "summary": f"{len(issues)} gap{'s' if len(issues) != 1 else ''} found" if issues else "no major gaps",
           "detail": issues}

    # 3) conditional refine loop: re-synthesize once, addressing the editor's notes
    final = draft
    if needs_revision and draft:
        yield {"type": "refine", "status": "running"}
        refine_input = json.dumps({
            "query": query, "tool_data": tool_data, "prior_draft": draft,
            "editor_feedback": issues,
            "instruction": ("Revise prior_draft to fix EVERY editor_feedback point using ONLY "
                            "tool_data. Keep the exact same JSON schema. Be more specific, "
                            "quantitative and complete; do not drop content that was already good."),
        })[:60000]
        revised = None
        async for ev in _think_and_parse(SYNTH_SYSTEM, refine_input, 2048, "refine"):
            if ev["type"] == "_parsed":
                revised = ev["data"]
            else:
                yield ev
        if isinstance(revised, dict):
            final = revised
        yield {"type": "refine", "status": "done", "summary": "draft revised"}

    final = final or {}
    final["_plan"] = plan
    final["_review"] = {"issues": issues, "revised": bool(needs_revision and final is not draft)}
    yield {"type": "result", "result": final}
