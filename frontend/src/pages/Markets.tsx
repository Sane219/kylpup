import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMarket, fetchSnapshot, MARKET_UNIVERSE, EQUITY_SYMBOLS, CompactQuote, Quote } from "../lib/market";
import { Panel, PanelHeader, Icon, Spinner } from "../components/ui";
import { Sparkline, QuoteDelta, Heatmap, BreadthBar } from "../components/market";

type SortKey = "symbol" | "name" | "price" | "changePct";
const PAGE_SIZES = [25, 50];

/** Build a Quote-shaped object from a compact backend quote + a static name. */
function toQuote(symbol: string, name: string, c?: CompactQuote): Quote | undefined {
  if (!c || c.error || c.price == null || c.prevClose == null) return undefined;
  return {
    symbol, name, price: c.price, prevClose: c.prevClose,
    change: c.change ?? c.price - c.prevClose,
    changePct: c.changePct ?? (c.prevClose ? ((c.price - c.prevClose) / c.prevClose) * 100 : 0),
    dir: 0, history: c.history ?? [],
  };
}

export default function Markets() {
  const tape = useMarket();
  const equities = tape.filter((q) => EQUITY_SYMBOLS.includes(q.symbol));

  const [search, setSearch] = useState("");
  const [size, setSize] = useState(PAGE_SIZES[0]);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "symbol", dir: 1 });

  // Symbol/name sort is global (no quotes needed); price/% sort runs on the loaded page.
  const filtered = useMemo(() => {
    const needle = search.trim().toUpperCase();
    let u = MARKET_UNIVERSE;
    if (needle) u = u.filter((x) => x.symbol.includes(needle) || x.name.toUpperCase().includes(needle));
    if (sort.key === "symbol" || sort.key === "name") {
      const k = sort.key;
      u = [...u].sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * sort.dir);
    }
    return u;
  }, [search, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(clampedPage * size, clampedPage * size + size);
  const pageKey = pageItems.map((i) => i.symbol).join(",");

  // reset to first page when the result set changes
  useEffect(() => { setPage(0); }, [search, size]);

  const [data, setData] = useState<Map<string, CompactQuote> | null>(null);
  useEffect(() => {
    let cancel = false;
    setData(null);
    if (!pageKey) { setData(new Map()); return; }
    fetchSnapshot(pageItems.map((i) => i.symbol))
      .then((rows) => !cancel && setData(new Map(rows.map((r) => [r.symbol, r]))))
      .catch(() => !cancel && setData(new Map()));
    return () => { cancel = true; };
  }, [pageKey]);

  const rows = useMemo(() => {
    const built = pageItems.map((i) => ({ ...i, q: data ? toQuote(i.symbol, i.name, data.get(i.symbol)) : undefined }));
    if (sort.key === "price" || sort.key === "changePct") {
      const k = sort.key;
      built.sort((a, b) => {
        const av = a.q?.[k] ?? -Infinity, bv = b.q?.[k] ?? -Infinity;
        return (av > bv ? 1 : av < bv ? -1 : 0) * sort.dir;
      });
    }
    return built;
  }, [pageItems, data, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "changePct" || key === "price" ? -1 : 1 }));

  const Arrow = ({ k }: { k: SortKey }) =>
    sort.key === k ? <span className="text-accent">{sort.dir === 1 ? " ↑" : " ↓"}</span> : null;

  const from = filtered.length ? clampedPage * size + 1 : 0;
  const to = Math.min(filtered.length, clampedPage * size + size);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Markets</h1>
        <p className="mt-1 text-sm text-muted">Live quotes across {MARKET_UNIVERSE.length} large-cap names. Click any symbol for detail.</p>
      </div>

      {/* breadth + heatmap of the curated tape */}
      <Panel>
        <PanelHeader code="HEAT" title="Equity heatmap" right={<span className="tnum text-[11px] text-muted">{equities.length} names</span>} />
        <div className="space-y-4 p-4">
          <BreadthBar quotes={equities} />
          <Heatmap quotes={equities} />
        </div>
      </Panel>

      {/* paginated, sortable board */}
      <Panel>
        <PanelHeader
          code="MKT"
          title="Market board"
          right={
            <div className="relative">
              <Icon name="search" size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter name or ticker"
                className="tnum w-44 rounded-md border border-border bg-surface py-1 pl-7 pr-2 text-xs outline-none transition ease-terminal focus:border-accent" />
            </div>
          }
        />
        <div className="min-h-[12rem] overflow-x-auto">
          <table className="term-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => toggleSort("symbol")}>Symbol<Arrow k="symbol" /></th>
                <th className="sortable hidden lg:table-cell" onClick={() => toggleSort("name")}>Name<Arrow k="name" /></th>
                <th className="hidden md:table-cell">Trend</th>
                <th className="col-num sortable" onClick={() => toggleSort("price")}>Last<Arrow k="price" /></th>
                <th className="col-num sortable" onClick={() => toggleSort("changePct")}>Chg %<Arrow k="changePct" /></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ symbol, name, q }) => (
                <tr key={symbol}>
                  <td>
                    <Link to={`/stock/${symbol}`} className="group flex items-center gap-2.5">
                      <span className="tnum text-sm font-semibold text-text transition group-hover:text-accent">{symbol}</span>
                      <span className="truncate text-xs text-muted lg:hidden">{name}</span>
                    </Link>
                  </td>
                  <td className="hidden truncate text-xs text-muted lg:table-cell">{name}</td>
                  <td className="hidden md:table-cell">{q && q.history.length > 1 ? <Sparkline data={q.history} width={84} height={22} /> : <span className="text-muted">—</span>}</td>
                  <td className="col-num text-sm font-medium">{q ? q.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : <span className="text-muted">—</span>}</td>
                  <td className="col-num">{q ? <QuoteDelta q={q} className="justify-end text-xs" /> : <span className="text-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data && <div className="grid place-items-center py-10"><Spinner /></div>}
          {data && rows.length === 0 && <div className="py-10 text-center text-sm text-muted">No symbols match “{search}”.</div>}
        </div>

        {/* pagination footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted">
          <span className="tnum">{from}–{to} of {filtered.length}</span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5">
              <span>Rows</span>
              <select value={size} onChange={(e) => setSize(Number(e.target.value))}
                className="tnum rounded border border-border bg-surface px-1.5 py-1 text-xs outline-none focus:border-accent">
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <div className="flex items-center gap-1">
              <button disabled={clampedPage === 0} onClick={() => setPage(clampedPage - 1)}
                className="rounded border border-border px-2 py-1 transition ease-terminal hover:border-border-strong hover:text-text disabled:opacity-40 disabled:hover:border-border">Prev</button>
              <span className="tnum px-1">{clampedPage + 1}/{pageCount}</span>
              <button disabled={clampedPage >= pageCount - 1} onClick={() => setPage(clampedPage + 1)}
                className="rounded border border-border px-2 py-1 transition ease-terminal hover:border-border-strong hover:text-text disabled:opacity-40 disabled:hover:border-border">Next</button>
            </div>
          </div>
        </div>
      </Panel>
      <p className="text-[11px] text-muted">Quotes are delayed (yfinance) and fetched a page at a time. Price / % sort orders the loaded page.</p>
    </div>
  );
}
