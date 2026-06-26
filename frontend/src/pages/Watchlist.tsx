import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Card, Empty, ErrorBanner, Spinner, Badge } from "../components/ui";

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
    await api(`/watchlist/${t}`, { method: "DELETE" });
    setRows((r) => r?.filter((x) => x.ticker !== t) ?? null);
  };

  if (err) return <ErrorBanner message={err} />;
  if (!rows) return <Spinner />;

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="flex gap-2">
        <input className="input max-w-[200px]" placeholder="Ticker (e.g. AAPL)" value={ticker} onChange={(e) => setTicker(e.target.value)} />
        <button className="btn">Add</button>
      </form>
      {rows.length === 0 ? <Empty title="Watchlist empty" hint="Add a ticker to track it." /> : (
        <div className="flex flex-wrap gap-2">
          {rows.map((r) => (
            <Card key={r.id} className="flex items-center gap-3 !p-3">
              <Badge>{r.ticker}</Badge>
              <button onClick={() => remove(r.ticker)} className="text-xs text-red-500 hover:underline">remove</button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
