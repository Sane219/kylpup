import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Panel, Empty, ErrorBanner, Spinner, Num, Icon } from "../components/ui";

export default function Watchlist() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [ticker, setTicker] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => { api<any[]>("/watchlist").then(setRows).catch((e) => setErr(e.message)); }, []);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    const row = await api("/watchlist", { method: "POST", body: JSON.stringify({ ticker: t }) });
    setRows((r) => [...(r || []).filter((x) => x.ticker !== t), row].sort((a, b) => a.ticker.localeCompare(b.ticker)));
    setTicker("");
  };

  const remove = async (t: string) => {
    setRows((r) => r?.filter((x) => x.ticker !== t) ?? null);
    api(`/watchlist/${t}`, { method: "DELETE" }).catch(() => api<any[]>("/watchlist").then(setRows));
  };

  if (err) return <ErrorBanner message={err} />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Watchlist</h1>
        <p className="mt-1 text-sm text-muted">Tickers you are tracking.</p>
      </div>

      <form onSubmit={add} className="flex gap-2">
        <input className="input tnum max-w-[200px] uppercase" placeholder="AAPL" value={ticker} onChange={(e) => setTicker(e.target.value)} />
        <button className="btn" disabled={!ticker.trim()}><Icon name="plus" size={14} /> Add</button>
      </form>

      {!rows ? <Spinner /> : rows.length === 0 ? (
        <Empty title="Watchlist empty" hint="Add a ticker to start tracking it." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <Panel key={r.id} className="flex items-center justify-between p-3">
              <Num className="text-base font-semibold">{r.ticker}</Num>
              <button onClick={() => remove(r.ticker)} aria-label={`Remove ${r.ticker}`}
                className="grid h-8 w-8 place-items-center rounded-md text-muted transition ease-terminal hover:bg-surface-2 hover:text-neg">
                <Icon name="x" size={14} />
              </button>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
