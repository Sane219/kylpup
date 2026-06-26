import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Card, Empty, Spinner, Badge } from "../components/ui";

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
      <div className="flex gap-3">
        <Link to="/research" className="btn">+ New Research</Link>
        <Link to="/reports" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100">View Reports</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><Stat label="Saved reports" value={reports?.length ?? "…"} /></Card>
        <Card><Stat label="Watchlist" value={watch.length} /></Card>
        <Card><Stat label="Role" value={user?.role ?? "—"} /></Card>
      </div>

      <Card>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Recent research</h3>
        {!reports ? <Spinner /> : reports.length === 0 ? (
          <Empty title="No research yet" hint="Start with New Research." />
        ) : (
          <ul className="divide-y text-sm">
            {reports.slice(0, 6).map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <Link to={`/reports/${r.id}`} className="text-blue-600 hover:underline">{r.query}</Link>
                <span className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {watch.length > 0 && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Watchlist</h3>
          <div className="flex flex-wrap gap-2">{watch.map((w) => <Badge key={w.id}>{w.ticker}</Badge>)}</div>
        </Card>
      )}
    </div>
  );
}

const Stat = ({ label, value }: { label: string; value: any }) => (
  <div><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-semibold">{value}</p></div>
);
