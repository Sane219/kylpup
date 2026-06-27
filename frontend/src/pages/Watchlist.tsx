import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Panel, PanelHeader, Empty, ErrorBanner, Spinner, Icon } from "../components/ui";
import { Sparkline, LivePrice, QuoteDelta } from "../components/market";
import { useMarket, KNOWN_SYMBOLS, EQUITY_SYMBOLS } from "../lib/market";

export default function Watchlist() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [ticker, setTicker] = useState("");
  const [err, setErr] = useState("");
  const market = useMarket();
  const bySym = new Map(market.map((q) => [q.symbol, q]));

  useEffect(() => { api<any[]>("/watchlist").then(setRows).catch((e) => setErr(e.message)); }, []);

  const addTicker = async (raw: string) => {
    const t = raw.trim().toUpperCase();
    if (!t) return;
    const row = await api("/watchlist", { method: "POST", body: JSON.stringify({ ticker: t }) });
    setRows((r) => [...(r || []).filter((x) => x.ticker !== t), row].sort((a, b) => a.ticker.localeCompare(b.ticker)));
    setTicker("");
  };

  const add = (e: FormEvent) => { e.preventDefault(); addTicker(ticker); };

  const remove = async (t: string) => {
    setRows((r) => r?.filter((x) => x.ticker !== t) ?? null);
    api(`/watchlist/${t}`, { method: "DELETE" }).catch(() => api<any[]>("/watchlist").then(setRows));
  };

  if (err) return <ErrorBanner message={err} />;

  const tracked = new Set((rows ?? []).map((r) => r.ticker));
  const suggestions = EQUITY_SYMBOLS.filter((s) => !tracked.has(s)).slice(0, 6);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Watchlist</h1>
        <p className="mt-1 text-sm text-muted">Live quotes for the tickers you track.</p>
      </div>

      <form onSubmit={add} className="flex gap-2">
        <input className="input tnum max-w-[200px] uppercase" placeholder="AAPL" value={ticker} onChange={(e) => setTicker(e.target.value)} list="known-symbols" />
        <datalist id="known-symbols">{KNOWN_SYMBOLS.map((s) => <option key={s} value={s} />)}</datalist>
        <button className="btn" disabled={!ticker.trim()}><Icon name="plus" size={14} /> Add</button>
      </form>

      {!rows ? <Spinner /> : rows.length === 0 ? (
        <Empty
          title="Watchlist empty"
          hint="Add a ticker above, or start with one of these."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => addTicker(s)}
                  className="tnum rounded-md border border-border px-3 py-1.5 text-sm text-text-2 transition ease-terminal hover:border-border-strong hover:bg-surface-2 hover:text-text">
                  + {s}
                </button>
              ))}
            </div>
          }
        />
      ) : (
        <Panel>
          <PanelHeader code="WL" title="Tracking" right={<span className="tnum text-[11px] text-muted">{rows.length} {rows.length === 1 ? "name" : "names"}</span>} />
          <div className="overflow-x-auto">
            <table className="term-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th className="hidden sm:table-cell">Trend</th>
                  <th className="col-num">Last</th>
                  <th className="col-num">Chg %</th>
                  <th className="col-num" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const q = bySym.get(r.ticker);
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link to={`/stock/${r.ticker}`} className="group flex flex-col">
                          <span className="tnum text-sm font-semibold transition group-hover:text-accent">{r.ticker}</span>
                          <span className="truncate text-xs text-muted">{q?.name ?? "No live quote"}</span>
                        </Link>
                      </td>
                      <td className="hidden sm:table-cell">{q ? <Sparkline data={q.history} width={88} height={24} /> : <span className="text-muted">—</span>}</td>
                      <td className="col-num">{q ? <LivePrice q={q} className="text-sm font-semibold" /> : <span className="tnum text-sm text-muted">—</span>}</td>
                      <td className="col-num">{q ? <QuoteDelta q={q} className="justify-end text-xs" /> : <span className="tnum text-sm text-muted">—</span>}</td>
                      <td className="col-num">
                        <button onClick={() => remove(r.ticker)} aria-label={`Remove ${r.ticker}`}
                          className="grid h-8 w-8 place-items-center rounded-md text-muted transition ease-terminal hover:bg-surface-2 hover:text-neg">
                          <Icon name="x" size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
