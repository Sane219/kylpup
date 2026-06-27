import { Link } from "react-router-dom";
import { useMarket, Quote, fmtPrice } from "../lib/market";

function Item({ q }: { q: Quote }) {
  const up = q.changePct >= 0;
  return (
    <Link to={`/stock/${q.symbol}`} tabIndex={-1}
      className="inline-flex items-center gap-2 border-r border-border px-4 py-1.5 text-xs transition-colors hover:bg-surface-2">
      <span className="tnum font-semibold text-text-2">{q.symbol}</span>
      <span key={q.price} className={`tnum text-text ${q.dir === 1 ? "flash-up" : q.dir === -1 ? "flash-down" : ""} rounded px-0.5`}>
        {fmtPrice(q)}
      </span>
      <span className="tnum font-medium" style={{ color: up ? "var(--pos)" : "var(--neg)" }}>
        {up ? "▲" : "▼"}{up ? "+" : ""}{q.changePct.toFixed(2)}%
      </span>
    </Link>
  );
}

/** Ambient market tape across the top of the app. Hover to pause. */
export default function TickerTape() {
  const quotes = useMarket();
  return (
    <div className="ticker-tape relative overflow-hidden border-b border-border bg-surface" aria-hidden="true">
      <div className="ticker-track">
        {[...quotes, ...quotes].map((q, i) => <Item key={`${q.symbol}-${i}`} q={q} />)}
      </div>
      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12" style={{ background: "linear-gradient(90deg, var(--surface), transparent)" }} />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12" style={{ background: "linear-gradient(270deg, var(--surface), transparent)" }} />
    </div>
  );
}
