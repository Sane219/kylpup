import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import ResearchResult from "../components/ResearchResult";
import { ErrorBanner, Spinner, Badge, Icon } from "../components/ui";

export default function ReportDetail() {
  const { id } = useParams();
  const [report, setReport] = useState<any>(null);
  const [err, setErr] = useState("");
  const [tag, setTag] = useState("");

  useEffect(() => { api(`/research/${id}`).then(setReport).catch((e) => setErr(e.message)); }, [id]);

  const addTag = async () => {
    const t = tag.trim();
    if (!t || report.tags?.includes(t)) { setTag(""); return; }
    const tags = [...(report.tags || []), t];
    setReport(await api(`/research/${id}`, { method: "PATCH", body: JSON.stringify({ tags }) }));
    setTag("");
  };

  if (err) return <ErrorBanner message={err} />;
  if (!report) return <Spinner />;

  return (
    <div className="space-y-5">
      <Link to="/reports" className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-text">
        <Icon name="arrow" size={14} className="rotate-180" /> Reports
      </Link>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-balance">{report.query}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {report.tags?.map((t: string) => <Badge key={t} tone="accent">{t}</Badge>)}
          <input className="input max-w-[160px] py-1" placeholder="add tag" value={tag}
            onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()} />
        </div>
      </div>
      <ResearchResult data={report.result_json} />
    </div>
  );
}
