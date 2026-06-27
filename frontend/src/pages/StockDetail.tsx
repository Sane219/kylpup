import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { api } from "../lib/api";
import { useQuote, symbolMeta, fmtPrice, EQUITY_SYMBOLS } from "../lib/market";
import { Panel, Icon, Empty, useToast } from "../components/ui";
import { QuoteDelta } from "../components/market";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3">
      <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className={`tnum text-sm font-semibold ${tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : "text-text"}`}>{value}</dd>
    </div>
  );
}

export default function StockDetail() {
  const { symbol = "" } = useParams();
  const sym = symbol.toUpperCase();
  const q = useQuote(sym);
  const meta = symbolMeta(sym);
  const nav = useNavigate();
  const toast = useToast();
  const [added, setAdded] = useState(false);

  // intraday stats derived from the live (simulated) price window
  const stats = useMemo(() => {
    if (!q) return null;
    const h = q.history;
    return { open: h[0], high: Math.max(...h), low: Math.min(...h), points: h.length };
  }, [q]);

  if (!meta)
    return (
      <Empty
        title={`Unknown symbol "${sym}"`}
        hint="No live quote is tracked for this ticker."
        action={<Link to="/" className="btn-ghost">Back to dashboard</Link>}
      />
    );

  const reduceMotion = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const chartData = q?.history.map((close, i) => ({ i, close })) ?? [];
  const up = (q?.changePct ?? 0) >= 0;
  const dp = q && q.prevClose >= 1000 ? 1 : q && q.prevClose >= 10 ? 2 : 3;
  const peers = EQUITY_SYMBOLS.filter((s) => s !== sym).slice(0, 6);

  const addToWatchlist = async () => {
    try {
      await api("/watchlist", { method: "POST", body: JSON.stringify({ ticker: sym }) });
      setAdded(true);
      toast(`${sym} added to watchlist`);
    } catch (e: any) {
      toast(e.message || "Could not add to watchlist");
    }
  };

  const research = () =>
    nav("/research", { state: { q: `Give me a full overview of ${meta.name} (${sym}): recent stock performance, latest news and sentiment, and key risks.` } });

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-text">
        <Icon name="arrow" size={14} className="rotate-180" /> Markets
      </Link>

      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="tnum text-3xl font-bold tracking-tight">{sym}</h1>
            <span className="func-tag">{meta.kind}</span>
          </div>
          <p className="mt-1.5 text-sm text-muted">{meta.name}</p>
        </div>
        <div className="text-right">
          <div className="tnum text-[3.25rem] font-semibold leading-[0.95] tracking-[-0.02em]">{q ? fmtPrice(q) : "—"}</div>
          <div className="mt-2 flex justify-end">{q ? <QuoteDelta q={q} className="text-base" /> : <span className="text-muted">—</span>}</div>
        </div>
      </div>

      {/* actions */}
      <div className="flex flex-wrap gap-2.5">
        <button className="btn" onClick={research}><Icon name="search" size={14} /> Research {sym}</button>
        <button className="btn-ghost" onClick={addToWatchlist} disabled={added}>
          <Icon name="star" size={14} /> {added ? "On watchlist" : "Add to watchlist"}
        </button>
      </div>

      {/* chart */}
      <Panel className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Daily close · last {stats?.points ?? 0} sessions</h3>
          <span className="tnum text-[11px] text-muted">delayed · yfinance</span>
        </div>
        <div className="h-64 w-full">
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="detailFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={up ? "var(--pos)" : "var(--neg)"} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={up ? "var(--pos)" : "var(--neg)"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <Tooltip
                  contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, color: "var(--text)" }}
                  labelStyle={{ display: "none" }}
                  formatter={(v: any) => [Number(v).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp }), "Price"]}
                />
                <Area type="monotone" dataKey="close" stroke={up ? "var(--pos)" : "var(--neg)"} strokeWidth={1.75} fill="url(#detailFill)" dot={false} isAnimationActive={!reduceMotion} animationDuration={700} animationEasing="ease-out" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted">Loading price history…</div>
          )}
        </div>
      </Panel>

      {/* stats */}
      <Panel>
        <dl className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4">
          <Stat label="Prev close" value={q ? q.prevClose.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp }) : "—"} />
          <Stat label="Day change" value={q ? `${up ? "+" : ""}${q.change.toFixed(dp)}` : "—"} tone={up ? "pos" : "neg"} />
          <Stat label="Period open" value={stats ? stats.open.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp }) : "—"} />
          <Stat label="Period range" value={stats ? `${stats.low.toFixed(dp)} – ${stats.high.toFixed(dp)}` : "—"} />
        </dl>
      </Panel>

      {/* peers */}
      <div>
        <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Other names</h3>
        <div className="flex flex-wrap gap-2">
          {peers.map((p) => (
            <Link key={p} to={`/stock/${p}`}
              className="tnum rounded-md border border-border px-3 py-1.5 text-sm text-text-2 transition ease-terminal hover:border-border-strong hover:bg-surface-2 hover:text-text">
              {p}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
