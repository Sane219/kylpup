import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Panel, Empty, ErrorBanner, Spinner, Badge, Icon, useToast } from "../components/ui";

export default function Reports() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const toast = useToast();
  const pending = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = (search = "") =>
    api<any[]>(`/research${search ? `?q=${encodeURIComponent(search)}` : ""}`).then(setRows).catch((e) => setErr(e.message));

  useEffect(() => { load(); }, []);

  // Optimistic delete: remove from view, defer the server call, let Undo cancel it.
  const del = (row: any) => {
    setRows((r) => r?.filter((x) => x.id !== row.id) ?? null);
    pending.current[row.id] = setTimeout(() => {
      api(`/research/${row.id}`, { method: "DELETE" }).catch(() => load(q));
      delete pending.current[row.id];
    }, 5000);
    toast("Report deleted", () => {
      clearTimeout(pending.current[row.id]); delete pending.current[row.id];
      setRows((r) => (r ? [row, ...r].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)) : r));
    });
  };

  if (err) return <ErrorBanner message={err} />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted">Your saved research.</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setRows(null); load(q); }} className="flex gap-2">
        <input className="input max-w-md" placeholder="Search past research…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-ghost"><Icon name="search" size={14} /> Search</button>
      </form>

      {!rows ? <Spinner /> : rows.length === 0 ? (
        <Empty title="No saved research yet" hint="Run a query to save a report." action={<Link to="/research" className="btn">New research</Link>} />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <Panel key={r.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <Link to={`/reports/${r.id}`} className="block truncate font-medium text-text transition hover:text-accent">{r.query}</Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="tnum">{new Date(r.created_at).toLocaleString()}</span>
                  {r.tags?.map((t: string) => <Badge key={t}>{t}</Badge>)}
                </div>
              </div>
              <button onClick={() => del(r)} aria-label="Delete report"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted transition ease-terminal hover:bg-surface-2 hover:text-neg">
                <Icon name="x" />
              </button>
            </Panel>
          ))}
        </ul>
      )}
    </div>
  );
}
