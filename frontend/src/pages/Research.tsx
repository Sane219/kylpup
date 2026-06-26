import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import ResearchResult, { ResearchData, ResultSkeleton } from "../components/ResearchResult";
import { ErrorBanner, Panel } from "../components/ui";

const EXAMPLES = [
  "Quick overview of Tesla: stock performance this quarter, news in the last 30 days, and key risks.",
  "Compare NVIDIA, AMD and Intel revenue growth and recent news sentiment.",
  "Compare the balance sheets of JPMorgan and Goldman Sachs. Which has the strongest capital position?",
];
const STEPS = ["Routing tools", "Fetching market + news", "Searching filings", "Synthesizing"];

export default function Research() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<ResearchData | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const nav = useNavigate();
  const loc = useLocation();

  // Accept a query handed off from the ⌘K command palette.
  useEffect(() => {
    const q = (loc.state as any)?.q;
    if (q) { setQuery(q); nav(loc.pathname, { replace: true, state: null }); }
  }, []); // eslint-disable-line

  // Advance the progress indicator while the request is in flight.
  useEffect(() => {
    if (!busy) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 900);
    return () => clearInterval(t);
  }, [busy]);

  const run = async (e: FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true); setData(null);
    try {
      const report = await api<any>("/research", { method: "POST", body: JSON.stringify({ query }) });
      setData(report.result_json);
      setReportId(report.id);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Research</h1>
        <p className="mt-1 text-sm text-muted">Ask in plain English. The agent picks the tools and returns sourced, structured analysis.</p>
      </div>

      <form onSubmit={run} className="space-y-3">
        <textarea className="input min-h-[96px] resize-y" placeholder="Compare NVIDIA, AMD and Intel: revenue growth, news sentiment, and key risks…"
          value={query} onChange={(e) => setQuery(e.target.value)} required minLength={3} />
        <div className="flex items-center gap-3">
          <button className="btn" disabled={busy || query.trim().length < 3}>Run research</button>
          {reportId && <button type="button" onClick={() => nav(`/reports/${reportId}`)} className="text-sm text-muted transition hover:text-text">View saved report →</button>}
        </div>
      </form>

      {!data && !busy && !err && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => setQuery(ex)}
              className="rounded-md border border-border px-3 py-1.5 text-left text-xs text-text-2 transition ease-terminal hover:border-border-strong hover:bg-surface-2">
              {ex.length > 56 ? ex.slice(0, 56) + "…" : ex}
            </button>
          ))}
        </div>
      )}

      {busy && (
        <>
          <Panel className="flex flex-wrap items-center gap-x-2 gap-y-1 p-4 text-sm">
            {STEPS.map((s, i) => (
              <span key={s} className="flex items-center gap-2">
                <span className={`tnum ${i < step ? "text-pos" : i === step ? "text-accent" : "text-muted"}`}>
                  {i < step ? "✓" : i === step ? "•" : "○"} {s}
                </span>
                {i < STEPS.length - 1 && <span className="text-muted">→</span>}
              </span>
            ))}
          </Panel>
          <ResultSkeleton />
        </>
      )}

      {err && <ErrorBanner message={err} />}
      {data && <ResearchResult data={data} />}
    </div>
  );
}
