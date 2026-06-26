import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Card, Empty, ErrorBanner, Spinner, Badge } from "../components/ui";

export default function Reports() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");

  const load = (search = "") =>
    api<any[]>(`/research${search ? `?q=${encodeURIComponent(search)}` : ""}`).then(setRows).catch((e) => setErr(e.message));

  useEffect(() => { load(); }, []);

  const del = async (id: string) => {
    if (!confirm("Delete this report?")) return;
    await api(`/research/${id}`, { method: "DELETE" });
    setRows((r) => r?.filter((x) => x.id !== id) ?? null);
  };

  if (err) return <ErrorBanner message={err} />;
  if (!rows) return <Spinner />;

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); setRows(null); load(q); }} className="flex gap-2">
        <input className="input" placeholder="Search past research…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn">Search</button>
      </form>
      {rows.length === 0 ? (
        <Empty title="No saved research yet" hint="Run a query from New Research." />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className="flex items-center justify-between">
              <div>
                <Link to={`/reports/${r.id}`} className="font-medium text-blue-600 hover:underline">{r.query}</Link>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                  <span>{new Date(r.created_at).toLocaleString()}</span>
                  {r.tags?.map((t: string) => <Badge key={t}>{t}</Badge>)}
                </div>
              </div>
              <button onClick={() => del(r.id)} className="text-sm text-red-500 hover:underline">Delete</button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
