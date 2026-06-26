import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import ResearchResult, { ResearchData } from "../components/ResearchResult";
import { ErrorBanner, Spinner } from "../components/ui";

const EXAMPLES = [
  "Give me a quick overview of Tesla — stock performance this quarter, news in the last 30 days, and key risks.",
  "Compare NVIDIA, AMD and Intel revenue growth and recent news sentiment.",
  "Compare the balance sheets of JPMorgan and Goldman Sachs. Which has the strongest capital position?",
];

export default function Research() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<ResearchData | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const nav = useNavigate();

  const run = async (e: FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true); setData(null);
    try {
      const report = await api<any>("/research", { method: "POST", body: JSON.stringify({ query }) });
      setData(report.result_json);
      setReportId(report.id);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={run} className="space-y-3">
        <textarea className="input min-h-[90px]" placeholder="Describe what you want to research…"
          value={query} onChange={(e) => setQuery(e.target.value)} required minLength={3} />
        <div className="flex items-center gap-3">
          <button className="btn" disabled={busy || query.length < 3}>Run Research</button>
          {reportId && <button type="button" onClick={() => nav(`/reports/${reportId}`)} className="text-sm text-slate-500 hover:underline">View saved report →</button>}
        </div>
      </form>

      {!data && !busy && !err && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => setQuery(ex)} className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100">{ex.slice(0, 48)}…</button>
          ))}
        </div>
      )}

      {busy && <Spinner label="Planning tools, fetching data, synthesizing…" />}
      {err && <ErrorBanner message={err} />}
      {data && <ResearchResult data={data} />}
    </div>
  );
}
