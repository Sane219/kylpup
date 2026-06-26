import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import ResearchResult from "../components/ResearchResult";
import { ErrorBanner, Spinner, Badge } from "../components/ui";

export default function ReportDetail() {
  const { id } = useParams();
  const [report, setReport] = useState<any>(null);
  const [err, setErr] = useState("");
  const [tag, setTag] = useState("");

  useEffect(() => { api(`/research/${id}`).then(setReport).catch((e) => setErr(e.message)); }, [id]);

  const addTag = async () => {
    if (!tag.trim()) return;
    const tags = [...(report.tags || []), tag.trim()];
    const updated = await api(`/research/${id}`, { method: "PATCH", body: JSON.stringify({ tags }) });
    setReport(updated); setTag("");
  };

  if (err) return <ErrorBanner message={err} />;
  if (!report) return <Spinner />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">{report.query}</h1>
        <div className="mt-2 flex items-center gap-2">
          {report.tags?.map((t: string) => <Badge key={t}>{t}</Badge>)}
          <input className="input max-w-[160px] py-1" placeholder="add tag" value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()} />
        </div>
      </div>
      <ResearchResult data={report.result_json} />
    </div>
  );
}
