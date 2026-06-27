import { FormEvent, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API_BASE, getToken, setToken } from "../lib/api";
import ResearchResult, { ResearchData } from "../components/ResearchResult";
import ResearchAgentPlan, { AgentStep } from "../components/ResearchAgentPlan";
import { ErrorBanner, Panel, PanelHeader } from "../components/ui";

const EXAMPLES = [
  "Give me a full overview of Tesla: stock performance, recent news and sentiment, and key risks.",
  "Compare NVIDIA, AMD and Intel on revenue, valuation, and recent news sentiment.",
  "Compare the balance sheets of JPMorgan and Goldman Sachs. Which has the stronger capital position?",
  "What are the biggest risks facing Apple right now, citing recent filings and news?",
];

// The full tool catalog the router chooses from. `flag` is the router-plan key.
const TOOL_CATALOG = [
  { key: "market", title: "Market data", flag: "fetch_market", desc: "Live quotes, valuation multiples and price history." },
  { key: "news", title: "News & sentiment", flag: "fetch_news", desc: "Recent headlines scored for sentiment." },
  { key: "filings", title: "SEC filings", flag: "search_filings", desc: "Vector search over 10-K / 10-Q passages." },
] as const;

export default function Research() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<ResearchData | null>(null);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [reportId, setReportId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const nav = useNavigate();
  const loc = useLocation();
  const ran = useRef(false);

  const patch = (key: string, next: Partial<AgentStep>) =>
    setSteps((s) => s.map((st) => (st.key === key ? { ...st, ...next } : st)));

  // backend reasoning stages → timeline step keys
  const STAGE_KEY: Record<string, string> = { routing: "route", synth: "synth", critique: "review", refine: "refine" };

  const handle = (ev: any) => {
    switch (ev.type) {
      case "plan": {
        const p = ev.plan || {};
        const chosen = TOOL_CATALOG.filter((t) => p[t.flag]);
        const detail: string[] = [];
        if (p.companies?.length) detail.push(`Resolved tickers → ${p.companies.join(", ")}`);
        detail.push(`Tools chosen → ${chosen.length ? chosen.map((t) => t.key).join(", ") : "none"}`);
        if (p.filing_query && p.search_filings) detail.push(`Filing query → "${p.filing_query}"`);
        patch("route", {
          status: "done",
          summary: `${chosen.length} of ${TOOL_CATALOG.length} tools`,
          note: p.reasoning || undefined,
          detail,
        });
        setSteps((s) => [
          ...s,
          ...TOOL_CATALOG.map((t): AgentStep => ({
            key: t.key, kind: "tool", title: `Run · ${t.title}`,
            status: p[t.flag] ? "pending" : "skipped",
          })),
          { key: "synth", kind: "synth", title: "Synthesize desk note", status: "pending" },
          { key: "review", kind: "review", title: "Review draft", status: "pending" },
        ]);
        break;
      }
      case "tool":
        if (ev.status === "running") patch(ev.tool, { status: "running" });
        else
          patch(ev.tool, {
            status: ev.status === "error" ? "error" : "done",
            summary: ev.error ? "failed" : ev.summary || undefined,
            preview: ev.preview || undefined,
            detail: ev.error ? [`Error → ${ev.error}`] : undefined,
          });
        break;
      case "thinking": {
        const key = STAGE_KEY[ev.stage] || ev.stage;
        if (ev.delta) setSteps((s) => s.map((st) => (st.key === key ? { ...st, thinking: (st.thinking || "") + ev.delta } : st)));
        else if (ev.text) patch(key, { thinking: ev.text });
        break;
      }
      case "synth":
        patch("synth", ev.status === "done" ? { status: "done", summary: "draft ready" } : { status: "running" });
        break;
      case "review":
        if (ev.status === "running") patch("review", { status: "running" });
        else
          patch("review", {
            status: "done",
            summary: ev.summary,
            detail: ev.detail?.length ? ev.detail : undefined,
            note: ev.detail?.length ? undefined : "Draft is well-grounded; no revision needed.",
          });
        break;
      case "refine":
        if (ev.status === "running")
          setSteps((s) => (s.some((x) => x.key === "refine") ? s : [...s, { key: "refine", kind: "review", title: "Refine desk note", status: "running" }]));
        else patch("refine", { status: "done", summary: ev.summary || "revised" });
        break;
      case "result":
        setData(ev.result);
        break;
      case "saved":
        setReportId(ev.report?.id ?? null);
        break;
      case "error":
        setErr(ev.message);
        setSteps((s) => s.map((st) => (st.status === "running" ? { ...st, status: "error" } : st)));
        break;
    }
  };

  const run = async (q: string) => {
    setErr(""); setData(null); setReportId(null); setBusy(true);
    setSteps([{ key: "route", kind: "route", title: "Route query", status: "running" }]);
    try {
      const res = await fetch(`${API_BASE}/research/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ query: q }),
      });
      if (res.status === 401) { setToken(null); throw new Error("Session expired. Please log in again."); }
      if (!res.ok || !res.body) throw new Error(res.statusText || "Research engine unavailable.");

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line) handle(JSON.parse(line));
        }
      }
    } catch (e: any) {
      setErr(e.message || "Something went wrong.");
      setSteps((s) => s.map((st) => (st.status === "running" ? { ...st, status: "error" } : st)));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim().length >= 3 && !busy) run(query.trim());
  };

  // Accept a query handed off from the ⌘K palette / global ask bar and auto-run it.
  useEffect(() => {
    const q = (loc.state as any)?.q;
    if (q && !ran.current) {
      ran.current = true;
      setQuery(q);
      nav(loc.pathname, { replace: true, state: null });
      run(q);
    }
  }, []); // eslint-disable-line

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Research</h1>
        <p className="mt-1 max-w-[68ch] text-sm text-muted">
          Ask in plain English. The agent picks its tools, runs them live, and returns sourced, structured analysis.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <textarea
          className="input min-h-[96px] resize-y"
          placeholder="Compare NVIDIA, AMD and Intel: revenue growth, news sentiment, and key risks…"
          value={query} onChange={(e) => setQuery(e.target.value)} required minLength={3}
        />
        <div className="flex items-center gap-3">
          <button className="btn" disabled={busy || query.trim().length < 3}>
            {busy ? "Running…" : "Run research"}
          </button>
          {reportId && (
            <button type="button" onClick={() => nav(`/reports/${reportId}`)} className="text-sm text-muted transition hover:text-text">
              View saved report →
            </button>
          )}
        </div>
      </form>

      {!steps.length && !err && (
        <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr]">
          <Panel>
            <PanelHeader code="TOOLS" title="What the agent can call" right={<span className="tnum text-[11px] text-muted">{TOOL_CATALOG.length} available</span>} />
            <ul className="divide-y divide-border">
              {TOOL_CATALOG.map((t) => (
                <li key={t.key} className="flex gap-3 px-4 py-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text">{t.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{t.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="border-t border-border px-4 py-3 text-xs leading-relaxed text-muted">
              A router model reads your question and picks only the tools it needs. They run in parallel; a second model then synthesizes a sourced desk note from whatever returned.
            </p>
          </Panel>
          <Panel>
            <PanelHeader code="ASK" title="Try a question" />
            <ul className="divide-y divide-border">
              {EXAMPLES.map((ex) => (
                <li key={ex}>
                  <button onClick={() => setQuery(ex)}
                    className="block w-full px-4 py-3 text-left text-sm text-text-2 transition ease-terminal hover:bg-surface-2 hover:text-text">
                    {ex}
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      {!!steps.length && <ResearchAgentPlan steps={steps} running={busy} />}
      {err && <ErrorBanner message={err} />}
      {data && <ResearchResult data={data} />}
    </div>
  );
}
