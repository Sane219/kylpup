import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Panel, SectionLabel, Empty, Spinner, Badge, Icon } from "../components/ui";

export default function Dashboard() {
  const { user } = useAuth();
  const [reports, setReports] = useState<any[] | null>(null);
  const [watch, setWatch] = useState<any[]>([]);

  useEffect(() => {
    api<any[]>("/research").then(setReports).catch(() => setReports([]));
    api<any[]>("/watchlist").then(setWatch).catch(() => setWatch([]));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Your workspace at a glance.</p>
        </div>
        <Link to="/research" className="btn"><Icon name="plus" size={14} /> New research</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Saved reports" value={reports?.length ?? "…"} />
        <Stat label="Watchlist" value={watch.length} />
        <Stat label="Role" value={user?.role ?? "—"} mono={false} />
      </div>

      <Panel className="p-5">
        <SectionLabel>Recent research</SectionLabel>
        <div className="mt-3">
          {!reports ? <Spinner /> : reports.length === 0 ? (
            <Empty title="No research yet" hint="Start with a query." action={<Link to="/research" className="btn">New research</Link>} />
          ) : (
            <ul className="divide-y divide-border text-sm">
              {reports.slice(0, 6).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 py-2.5 first:pt-0">
                  <Link to={`/reports/${r.id}`} className="truncate text-text transition hover:text-accent">{r.query}</Link>
                  <span className="tnum shrink-0 text-xs text-muted">{new Date(r.created_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      {watch.length > 0 && (
        <Panel className="p-5">
          <SectionLabel>Watchlist</SectionLabel>
          <div className="mt-3 flex flex-wrap gap-2">{watch.map((w) => <Badge key={w.id} tone="accent">{w.ticker}</Badge>)}</div>
        </Panel>
      )}
    </div>
  );
}

const Stat = ({ label, value, mono = true }: { label: string; value: any; mono?: boolean }) => (
  <Panel className="p-4">
    <p className="text-sm text-muted">{label}</p>
    <p className={`mt-1 text-2xl font-semibold tracking-tight ${mono ? "tnum" : "capitalize"}`}>{value}</p>
  </Panel>
);
