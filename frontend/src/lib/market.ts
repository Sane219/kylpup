import { useSyncExternalStore } from "react";
import { api, getToken } from "./api";

/**
 * Live market feed — real quotes from the backend (yfinance), polled.
 *
 * The store hydrates the curated tape (INDEX_SYMBOLS + EQUITY_SYMBOLS) from
 * `GET /market/snapshot` on first subscribe and refreshes every POLL_MS.
 * Prices are delayed (yfinance), not tick-level; `dir` flags real
 * up/down moves between refreshes so the flash animation still fires.
 * Seed prices are used only as a pre-fetch placeholder / offline fallback.
 */
export type Quote = {
  symbol: string;
  name: string;
  price: number;
  prevClose: number;
  change: number;      // absolute, vs prevClose
  changePct: number;   // percent, vs prevClose
  dir: -1 | 0 | 1;     // direction of the latest refresh (for flash)
  history: number[];   // recent close window, for sparklines
};

/** Compact quote as returned by the backend snapshot endpoint. */
export type CompactQuote = {
  symbol: string;
  price?: number;
  prevClose?: number;
  change?: number;
  changePct?: number;
  history?: number[];
  currency?: string;
  error?: string;
};

type Seed = { symbol: string; name: string; price: number; kind: "index" | "equity" };

// Curated tape shown on the dashboard. Seed prices are placeholders until the
// real snapshot lands (and a fallback if the backend is unreachable).
const SEEDS: Seed[] = [
  { symbol: "SPX", name: "S&P 500", price: 5687.4, kind: "index" },
  { symbol: "NDX", name: "Nasdaq 100", price: 20142.8, kind: "index" },
  { symbol: "DJI", name: "Dow Jones", price: 42355.1, kind: "index" },
  { symbol: "VIX", name: "Volatility", price: 14.2, kind: "index" },
  { symbol: "BTC", name: "Bitcoin", price: 71280, kind: "index" },
  { symbol: "US10Y", name: "10Y Yield", price: 4.21, kind: "index" },
  { symbol: "NVDA", name: "NVIDIA", price: 131.4, kind: "equity" },
  { symbol: "AAPL", name: "Apple", price: 226.8, kind: "equity" },
  { symbol: "MSFT", name: "Microsoft", price: 441.2, kind: "equity" },
  { symbol: "TSLA", name: "Tesla", price: 248.9, kind: "equity" },
  { symbol: "AMZN", name: "Amazon", price: 198.3, kind: "equity" },
  { symbol: "GOOGL", name: "Alphabet", price: 176.5, kind: "equity" },
  { symbol: "META", name: "Meta", price: 563.1, kind: "equity" },
  { symbol: "AMD", name: "AMD", price: 159.7, kind: "equity" },
  { symbol: "JPM", name: "JPMorgan", price: 213.4, kind: "equity" },
  { symbol: "GS", name: "Goldman Sachs", price: 498.6, kind: "equity" },
];

const HISTORY = 40;
const POLL_MS = 60_000;
const TICK_MS = 1200;

function round(v: number, ref: number): number {
  const dp = ref >= 1000 ? 1 : ref >= 10 ? 2 : 3;
  return Math.round(v * 10 ** dp) / 10 ** dp;
}

function build(s: Seed): Quote {
  return {
    symbol: s.symbol,
    name: s.name,
    price: s.price,
    prevClose: s.price,
    change: 0,
    changePct: 0,
    dir: 0,
    history: Array.from({ length: HISTORY }, () => s.price),
  };
}

let quotes: Quote[] = SEEDS.map(build);
const seedBy = Object.fromEntries(SEEDS.map((s) => [s.symbol, s]));
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;
let hydrated = false;

// Last real price per symbol — the anchor the cosmetic jitter reverts toward.
const anchorBy: Record<string, number> = {};

/** Merge a batch of real quotes into the tape, computing tick direction. */
function merge(rows: CompactQuote[]) {
  const by = new Map(rows.map((r) => [r.symbol, r]));
  quotes = quotes.map((q) => {
    const r = by.get(q.symbol);
    if (!r || r.error || r.price == null || r.prevClose == null) return q;
    anchorBy[q.symbol] = r.price; // re-anchor jitter to the fresh real price
    return {
      ...q,
      price: r.price,
      prevClose: r.prevClose,
      change: r.change ?? r.price - r.prevClose,
      changePct: r.changePct ?? (r.prevClose ? ((r.price - r.prevClose) / r.prevClose) * 100 : 0),
      dir: r.price > q.price ? 1 : r.price < q.price ? -1 : 0,
      history: r.history && r.history.length > 1 ? r.history : q.history,
    };
  });
  listeners.forEach((l) => l());
}

/** Cosmetic between-refresh motion: nudge each price by a fraction of a percent
 *  with a strong pull back to the real anchor, so the tape feels live without
 *  ever drifting away from the actual quote. History (real daily closes) is
 *  untouched, so sparklines stay truthful. */
function tick() {
  quotes = quotes.map((q) => {
    const anchor = anchorBy[q.symbol];
    if (anchor == null) return q;
    const shock = (Math.random() - 0.5) * 2 * 0.0006; // ±0.06%
    const pull = ((anchor - q.price) / anchor) * 0.15; // mean-revert to anchor
    const next = round(q.price * (1 + shock + pull), q.prevClose);
    if (next === q.price) return q; // no visible change, no flash
    return {
      ...q,
      price: next,
      change: round(next - q.prevClose, q.prevClose),
      changePct: q.prevClose ? ((next - q.prevClose) / q.prevClose) * 100 : 0,
      dir: next > q.price ? 1 : -1,
    };
  });
  listeners.forEach((l) => l());
}

function refresh() {
  if (!getToken()) return; // not signed in: keep seeds, don't spam 401s
  fetchSnapshot(SEEDS.map((s) => s.symbol))
    .then((rows) => { merge(rows); hydrated = true; })
    .catch(() => { /* keep last good / seed values */ });
}

function start() {
  if (timer) return;
  refresh();
  timer = setInterval(refresh, POLL_MS);
  // cosmetic jitter is pure motion — honor reduced-motion by holding still
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!reduce) tickTimer = setInterval(tick, TICK_MS);
}

const store = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    start();
    if (!hydrated) refresh(); // pick up real data right after login
    return () => {
      listeners.delete(cb);
      if (listeners.size === 0) {
        if (timer) { clearInterval(timer); timer = null; }
        if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
      }
    };
  },
  snapshot: () => quotes,
};

/** One-shot fetch of compact quotes for any symbols (used by the markets board). */
export function fetchSnapshot(symbols: string[]): Promise<CompactQuote[]> {
  return api<CompactQuote[]>(`/market/snapshot?symbols=${encodeURIComponent(symbols.join(","))}`);
}

/** Full curated tape. */
export function useMarket(): Quote[] {
  return useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
}

/** Live quote for a single symbol (undefined if unknown). */
export function useQuote(symbol?: string): Quote | undefined {
  const all = useMarket();
  if (!symbol) return undefined;
  return all.find((q) => q.symbol === symbol.toUpperCase());
}

/** Static metadata (name, kind) for a symbol, available before the store loads. */
export function symbolMeta(symbol: string): { name: string; kind: "index" | "equity" } | undefined {
  const s = seedBy[symbol.toUpperCase()];
  if (s) return { name: s.name, kind: s.kind };
  const u = UNIVERSE_BY[symbol.toUpperCase()];
  return u ? { name: u.name, kind: "equity" } : undefined;
}

/** Quotes for a set of symbols, in the order given (unknown symbols dropped). */
export function useQuotes(symbols: string[]): Quote[] {
  const all = useMarket();
  const by = new Map(all.map((q) => [q.symbol, q]));
  return symbols.map((s) => by.get(s.toUpperCase())).filter(Boolean) as Quote[];
}

/** Advancers / decliners / unchanged across a set of quotes. */
export function breadth(quotes: Quote[]) {
  let adv = 0, dec = 0, unch = 0;
  for (const q of quotes) {
    if (q.changePct > 0.001) adv++;
    else if (q.changePct < -0.001) dec++;
    else unch++;
  }
  return { adv, dec, unch, total: quotes.length };
}

export const INDEX_SYMBOLS = SEEDS.filter((s) => s.kind === "index").map((s) => s.symbol);
export const EQUITY_SYMBOLS = SEEDS.filter((s) => s.kind === "equity").map((s) => s.symbol);
export const KNOWN_SYMBOLS = SEEDS.map((s) => s.symbol);

export function fmtPrice(q: Quote): string {
  const dp = q.prevClose >= 1000 ? 1 : q.prevClose >= 10 ? 2 : 3;
  return q.price.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

/**
 * Browsable universe for the markets board. Names are static; quotes are
 * fetched a page at a time (pagination keeps the per-request yfinance load
 * bounded). Large-cap US names across sectors.
 */
export const MARKET_UNIVERSE: { symbol: string; name: string }[] = [
  { symbol: "AAPL", name: "Apple" }, { symbol: "MSFT", name: "Microsoft" },
  { symbol: "NVDA", name: "NVIDIA" }, { symbol: "AMZN", name: "Amazon" },
  { symbol: "GOOGL", name: "Alphabet" }, { symbol: "META", name: "Meta Platforms" },
  { symbol: "TSLA", name: "Tesla" }, { symbol: "AMD", name: "AMD" },
  { symbol: "AVGO", name: "Broadcom" }, { symbol: "ORCL", name: "Oracle" },
  { symbol: "CRM", name: "Salesforce" }, { symbol: "ADBE", name: "Adobe" },
  { symbol: "INTC", name: "Intel" }, { symbol: "QCOM", name: "Qualcomm" },
  { symbol: "CSCO", name: "Cisco" }, { symbol: "IBM", name: "IBM" },
  { symbol: "TXN", name: "Texas Instruments" }, { symbol: "NFLX", name: "Netflix" },
  { symbol: "JPM", name: "JPMorgan Chase" }, { symbol: "BAC", name: "Bank of America" },
  { symbol: "WFC", name: "Wells Fargo" }, { symbol: "GS", name: "Goldman Sachs" },
  { symbol: "MS", name: "Morgan Stanley" }, { symbol: "V", name: "Visa" },
  { symbol: "MA", name: "Mastercard" }, { symbol: "AXP", name: "American Express" },
  { symbol: "BRK-B", name: "Berkshire Hathaway" }, { symbol: "BLK", name: "BlackRock" },
  { symbol: "JNJ", name: "Johnson & Johnson" }, { symbol: "UNH", name: "UnitedHealth" },
  { symbol: "LLY", name: "Eli Lilly" }, { symbol: "PFE", name: "Pfizer" },
  { symbol: "MRK", name: "Merck" }, { symbol: "ABBV", name: "AbbVie" },
  { symbol: "TMO", name: "Thermo Fisher" }, { symbol: "WMT", name: "Walmart" },
  { symbol: "COST", name: "Costco" }, { symbol: "PG", name: "Procter & Gamble" },
  { symbol: "KO", name: "Coca-Cola" }, { symbol: "PEP", name: "PepsiCo" },
  { symbol: "MCD", name: "McDonald's" }, { symbol: "NKE", name: "Nike" },
  { symbol: "SBUX", name: "Starbucks" }, { symbol: "HD", name: "Home Depot" },
  { symbol: "DIS", name: "Walt Disney" }, { symbol: "XOM", name: "Exxon Mobil" },
  { symbol: "CVX", name: "Chevron" }, { symbol: "BA", name: "Boeing" },
  { symbol: "CAT", name: "Caterpillar" }, { symbol: "GE", name: "GE Aerospace" },
  { symbol: "UBER", name: "Uber" }, { symbol: "PYPL", name: "PayPal" },
  { symbol: "T", name: "AT&T" }, { symbol: "VZ", name: "Verizon" },
];

const UNIVERSE_BY = Object.fromEntries(MARKET_UNIVERSE.map((u) => [u.symbol, u]));
