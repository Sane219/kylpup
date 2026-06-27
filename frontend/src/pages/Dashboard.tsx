import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Panel, PanelHeader, SectionLabel, Empty, Spinner, Icon } from "../components/ui";
import { Sparkline, LivePrice, QuoteDelta, Heatmap, BreadthBar } from "../components/market";
import { useQuotes, useMarket, INDEX_SYMBOLS, EQUITY_SYMBOLS, Quote } from "../lib/market";

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** Compact index tile: price, day delta, sparkline. */
function IndexTile({ q, i = 0 }: { q: Quote; i?: number }) {
  return (
    <Link to={`/stock/${q.symbol}`} style={{ ["--i" as any]: i }} className="deal-in block rounded-lg transition ease-terminal hover:opacity-100">
      <Panel className="p-3.5 transition-colors ease-terminal hover:border-border-strong">
        <div className="flex items-baseline justify-between">
          <span className="tnum text-sm font-semibold text-text-2">{q.symbol}</span>
          <span className="truncate pl-2 text-[11px] text-muted">{q.name}</span>
        </div>
        <div className="mt-2 flex items-end justify-between gap-2">
          <LivePrice q={q} className="text-[1.75rem] font-semibold leading-none tracking-[-0.01em]" />
          <Sparkline data={q.history} width={64} height={30} />
        </div>
        <div className="mt-1"><QuoteDelta q={q} /></div>
      </Panel>
    </Link>
  );
}

/** A dense board row (used for the watchlist / market board table). */
function BoardRow({ q }: { q: Quote }) {
  return (
    <Link to={`/stock/${q.symbol}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2.5 transition-colors ease-terminal hover:bg-surface-2">
      <div className="min-w-0">
        <div className="tnum text-sm font-semibold">{q.symbol}</div>
        <div className="truncate text-xs text-muted">{q.name}</div>
      </div>
      <Sparkline data={q.history} width={88} height={26} className="hidden sm:block" />
      <div className="flex flex-col items-end">
        <LivePrice q={q} className="text-sm font-semibold" />
        <QuoteDelta q={q} className="text-xs" />
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [reports, setReports] = useState<any[] | null>(null);
  const [watch, setWatch] = useState<string[] | null>(null);

  useEffect(() => {
    api<any[]>("/research").then(setReports).catch(() => setReports([]));
    api<any[]>("/watchlist").then((r) => setWatch(r.map((w) => w.ticker))).catch(() => setWatch([]));
  }, []);

  const indices = useQuotes(INDEX_SYMBOLS);
  const market = useMarket();
  const equities = useMemo(() => market.filter((q) => EQUITY_SYMBOLS.includes(q.symbol)), [market]);

  // Board = watched tickers that have a live quote; fall back to the default tape.
  const boardSymbols = watch && watch.length ? watch : EQUITY_SYMBOLS;
  const board = useQuotes(boardSymbols);

  const movers = useMemo(() => {
    const eq = market.filter((q) => EQUITY_SYMBOLS.includes(q.symbol));
    const sorted = [...eq].sort((a, b) => b.changePct - a.changePct);
    return { up: sorted.slice(0, 3), down: sorted.slice(-3).reverse() };
  }, [market]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting()}.</h1>
          <p className="mt-1 text-sm text-muted">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} · markets at a glance
          </p>
        </div>
        <Link to="/research" className="btn"><Icon name="plus" size={14} /> New research</Link>
      </div>

      {/* Index strip */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {indices.map((q, i) => <IndexTile key={q.symbol} q={q} i={i} />)}
      </div>

      {/* Market breadth */}
      <Panel className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Breadth</span>
        <div className="flex-1"><BreadthBar quotes={equities} /></div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Market board */}
        <Panel>
          <PanelHeader code="BRD" title={watch && watch.length ? "Your board" : "Market board"}
            right={<Link to="/watchlist" className="text-xs text-muted transition hover:text-accent">Manage →</Link>} />
          {board.length === 0
            ? <div className="p-4"><Empty title="No live symbols" hint="Add tickers to your watchlist to pin them here." action={<Link to="/watchlist" className="btn">Edit watchlist</Link>} /></div>
            : <div className="divide-y divide-border">{board.map((q) => <BoardRow key={q.symbol} q={q} />)}</div>}
        </Panel>

        <div className="space-y-6">
          {/* Movers */}
          <Panel className="p-4">
            <SectionLabel>Top movers</SectionLabel>
            <div className="mt-3 space-y-3">
              <MoverList label="Gainers" rows={movers.up} />
              <MoverList label="Laggards" rows={movers.down} />
            </div>
          </Panel>

          {/* Heatmap */}
          <Panel className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <SectionLabel>Heatmap</SectionLabel>
              <Link to="/markets" className="text-xs text-muted transition hover:text-accent">Markets →</Link>
            </div>
            <Heatmap quotes={equities} />
          </Panel>

          {/* Recent research */}
          <Panel className="p-4">
            <div className="flex items-center justify-between">
              <SectionLabel>Recent research</SectionLabel>
              <Link to="/reports" className="text-xs text-muted transition hover:text-accent">All →</Link>
            </div>
            <div className="mt-3">
              {!reports ? <Spinner /> : reports.length === 0 ? (
                <Empty title="No research yet" hint="Ask a question to get started." action={<Link to="/research" className="btn">New research</Link>} />
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {reports.slice(0, 5).map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-4 py-2.5 first:pt-0">
                      <Link to={`/reports/${r.id}`} className="truncate text-text-2 transition hover:text-accent">{r.query}</Link>
                      <span className="tnum shrink-0 text-xs text-muted">{new Date(r.created_at).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

const MoverList = ({ label, rows }: { label: string; rows: Quote[] }) => (
  <div>
    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
    <ul className="space-y-0.5">
      {rows.map((q) => (
        <li key={q.symbol}>
          <Link to={`/stock/${q.symbol}`} className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-sm transition-colors ease-terminal hover:bg-surface-2">
            <span className="tnum font-medium text-text-2">{q.symbol}</span>
            <QuoteDelta q={q} className="text-xs" />
          </Link>
        </li>
      ))}
    </ul>
  </div>
);
