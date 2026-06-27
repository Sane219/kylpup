import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Panel, PanelHeader, Empty, ErrorBanner, Spinner, Badge, Icon, useToast } from "../components/ui";

export default function Reports() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const toast = useToast();
  const pending = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = (search = "") =>
    api<any[]>(`/research${search ? `?q=${encodeURIComponent(search)}` : ""}`).then(setRows).catch((e) => setErr(e.message));

  useEffect(() => { load(); }, []);

  const tags = useMemo(() => [...new Set((rows ?? []).flatMap((r) => r.tags ?? []))] as string[], [rows]);
  const visible = useMemo(() => (tag ? (rows ?? []).filter((r) => r.tags?.includes(tag)) : rows ?? []), [rows, tag]);

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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-muted">Your saved research, newest first.</p>
        </div>
        <Link to="/research" className="btn"><Icon name="plus" size={14} /> New research</Link>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setRows(null); setTag(null); load(q); }} className="flex gap-2">
        <input className="input max-w-md" placeholder="Search past research…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-ghost"><Icon name="search" size={14} /> Search</button>
      </form>

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setTag(null)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ease-terminal ${tag === null ? "border-accent text-text" : "border-border text-muted hover:text-text-2"}`}>
            All
          </button>
          {tags.map((t) => (
            <button key={t} onClick={() => setTag(t)}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ease-terminal ${tag === t ? "border-accent text-text" : "border-border text-muted hover:text-text-2"}`}>
              {t}
            </button>
          ))}
        </div>
      )}

      {!rows ? <Spinner /> : visible.length === 0 ? (
        <Empty title="No saved research yet" hint="Run a query to save a report." action={<Link to="/research" className="btn">New research</Link>} />
      ) : (
        <Panel>
          <PanelHeader code="RES" title="Saved reports" right={<span className="tnum text-[11px] text-muted">{visible.length} of {rows.length}</span>} />
          <div className="overflow-x-auto">
            <table className="term-table">
              <thead>
                <tr>
                  <th>Query</th>
                  <th className="hidden sm:table-cell">Tags</th>
                  <th className="col-num hidden md:table-cell">Saved</th>
                  <th className="col-num" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td className="max-w-0">
                      <Link to={`/reports/${r.id}`} className="block truncate font-medium text-text transition hover:text-accent">{r.query}</Link>
                    </td>
                    <td className="hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1.5">{r.tags?.map((t: string) => <Badge key={t}>{t}</Badge>)}</div>
                    </td>
                    <td className="col-num hidden whitespace-nowrap text-xs text-muted md:table-cell">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="col-num">
                      <button onClick={() => del(r)} aria-label="Delete report"
                        className="grid h-8 w-8 place-items-center rounded-md text-muted transition ease-terminal hover:bg-surface-2 hover:text-neg">
                        <Icon name="x" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
