import { Link } from "react-router-dom";
import { Quote, fmtPrice, breadth } from "../lib/market";

/** Advancers / unchanged / decliners ratio bar with counts. */
export function BreadthBar({ quotes }: { quotes: Quote[] }) {
  const b = breadth(quotes);
  const pct = (n: number) => (b.total ? (n / b.total) * 100 : 0);
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
        <span style={{ width: `${pct(b.adv)}%`, background: "var(--pos)" }} />
        <span style={{ width: `${pct(b.unch)}%`, background: "var(--text-muted)" }} />
        <span style={{ width: `${pct(b.dec)}%`, background: "var(--neg)" }} />
      </div>
      <div className="tnum flex shrink-0 items-center gap-2.5 text-xs">
        <span className="text-pos">{b.adv} adv</span>
        <span className="text-muted">{b.unch} unch</span>
        <span className="text-neg">{b.dec} dec</span>
      </div>
    </div>
  );
}

/** Single heatmap cell, tinted by magnitude of day change, links to the stock. */
export function HeatTile({ q }: { q: Quote }) {
  const up = q.changePct >= 0;
  const mag = Math.min(1, Math.abs(q.changePct) / 2.5); // ±2.5% saturates the tint
  const tint = Math.round(12 + mag * 52);
  const bg = `color-mix(in oklch, var(--${up ? "pos" : "neg"}) ${tint}%, var(--surface))`;
  return (
    <Link to={`/stock/${q.symbol}`} title={`${q.symbol} · ${q.name}`}
      className="flex flex-col justify-between gap-2 rounded-md p-2.5 transition ease-terminal hover:brightness-110 focus-visible:brightness-110"
      style={{ background: bg }}>
      <span className="tnum text-xs font-semibold text-text">{q.symbol}</span>
      <span className="tnum text-[11px] font-medium text-text">{up ? "+" : ""}{q.changePct.toFixed(2)}%</span>
    </Link>
  );
}

/** Responsive heatmap grid. */
export function Heatmap({ quotes, className = "" }: { quotes: Quote[]; className?: string }) {
  return (
    <div className={`grid gap-1.5 ${className}`} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(82px, 1fr))" }}>
      {quotes.map((q) => <HeatTile key={q.symbol} q={q} />)}
    </div>
  );
}

/** Inline SVG sparkline from a price window. Colored by net direction. */
export function Sparkline({ data, width = 72, height = 24, className = "" }: {
  data: number[]; width?: number; height?: number; className?: string;
}) {
  if (data.length < 2) return <svg width={width} height={height} className={className} />;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  const pts = data.map((v, i) => `${(i * stepX).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`);
  const up = data[data.length - 1] >= data[0];
  const stroke = up ? "var(--pos)" : "var(--neg)";
  const id = `sg-${up ? "u" : "d"}-${width}-${height}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts.join(" ")} ${width},${height}`} fill={`url(#${id})`} />
      <polyline points={pts.join(" ")} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Price that flashes green/red on each tick (key remount restarts the animation). */
export function LivePrice({ q, className = "" }: { q: Quote; className?: string }) {
  return (
    <span
      key={q.price}
      className={`tnum rounded px-1 ${q.dir === 1 ? "flash-up" : q.dir === -1 ? "flash-down" : ""} ${className}`}
    >
      {fmtPrice(q)}
    </span>
  );
}

/** Signed day-change for a quote: arrow + abs + pct, colored, never color-only. */
export function QuoteDelta({ q, className = "" }: { q: Quote; className?: string }) {
  const up = q.changePct >= 0;
  const dp = q.prevClose >= 1000 ? 1 : q.prevClose >= 10 ? 2 : 3;
  return (
    <span className={`tnum inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium ${className}`} style={{ color: up ? "var(--pos)" : "var(--neg)" }}>
      {up ? "▲" : "▼"} {up ? "+" : ""}{q.change.toFixed(dp)}
      <span className="opacity-80">({up ? "+" : ""}{q.changePct.toFixed(2)}%)</span>
    </span>
  );
}
