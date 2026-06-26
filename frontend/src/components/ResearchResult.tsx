import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { Badge, Panel, SectionLabel, Cite, Empty, Delta, Num, Skeleton } from "./ui";

// The agent's structured UI state (see backend SYNTH_SYSTEM schema).
export type ResearchData = {
  summary?: string;
  company_cards?: any[];
  comparison_table?: { columns: string[]; rows: string[][] };
  news_sentiment?: any[];
  filing_insights?: any[];
  risks?: any[];
  sources_used?: string[];
  _plan?: { tickers?: string[]; fetch_market?: boolean; fetch_news?: boolean; search_filings?: boolean };
};

const fmt = (n: any) => (n == null ? "—" : typeof n === "number" ? n.toLocaleString() : String(n));

// Prefer an explicit change; else derive from price history first→last close.
const changePct = (c: any): number | null => {
  if (typeof c.change_pct === "number") return c.change_pct;
  const h = c.history;
  if (h?.length >= 2 && h[0].close && h[h.length - 1].close)
    return ((h[h.length - 1].close - h[0].close) / h[0].close) * 100;
  return null;
};

export function ResultSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-20 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-44 w-full" />)}
      </div>
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export default function ResearchResult({ data }: { data: ResearchData }) {
  if (!data || Object.keys(data).length === 0)
    return <Empty title="No analysis yet" hint="Run a research query to see results." />;

  return (
    <div className="animate-in space-y-5">
      {data._plan && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Tools used</span>
          {data._plan.fetch_market && <Badge tone="accent">market</Badge>}
          {data._plan.fetch_news && <Badge tone="accent">news</Badge>}
          {data._plan.search_filings && <Badge tone="accent">filings</Badge>}
        </div>
      )}

      {data.summary && (
        <Panel className="p-5">
          <SectionLabel>Summary</SectionLabel>
          <p className="mt-2 leading-relaxed text-text-2 text-pretty">{data.summary}</p>
        </Panel>
      )}

      {!!data.company_cards?.length && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.company_cards.map((c, i) => (
            <Panel key={i} className="flex flex-col p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="tnum text-base font-semibold tracking-tight">{c.ticker}</div>
                  <div className="truncate text-xs text-muted">{c.name}</div>
                </div>
                <div className="text-right">
                  <div className="tnum text-lg font-semibold">{c.price != null ? `$${fmt(c.price)}` : "—"}</div>
                  <Delta value={changePct(c)} />
                </div>
              </div>

              {!!c.history?.length && (
                <div className="-mx-1 mt-3 h-12">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={c.history} margin={{ top: 2, right: 4, bottom: 0, left: 4 }}>
                      <defs>
                        <linearGradient id={`spark${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <YAxis hide domain={["dataMin", "dataMax"]} />
                      <Tooltip contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, color: "var(--text)" }} labelStyle={{ color: "var(--muted)" }} />
                      <Area type="monotone" dataKey="close" stroke="var(--accent)" strokeWidth={1.75} fill={`url(#spark${i})`} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-border pt-3 text-sm">
                <Stat k="Mkt Cap" v={fmt(c.market_cap)} />
                <Stat k="P/E" v={fmt(c.pe_ratio)} />
                <Stat k="EPS" v={fmt(c.eps)} />
                <Stat k="Revenue" v={fmt(c.revenue)} />
              </dl>

              {c.highlight && <p className="mt-3 text-sm text-text-2">{c.highlight}</p>}
              <div className="mt-auto pt-3"><Cite source={c.citation} /></div>
            </Panel>
          ))}
        </div>
      )}

      {!!data.comparison_table?.rows?.length && (
        <Panel className="p-5">
          <SectionLabel>Comparison</SectionLabel>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0">
                <tr className="text-left text-muted">
                  {data.comparison_table.columns.map((c, i) => (
                    <th key={i} className={`border-b border-border py-2 pr-4 font-medium ${i > 0 ? "tnum text-right" : ""}`}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.comparison_table.rows.map((r, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0 hover:bg-surface-2">
                    {r.map((cell, j) => (
                      <td key={j} className={`py-2 pr-4 ${j === 0 ? "font-medium text-text" : "tnum text-right text-text-2"}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {!!data.news_sentiment?.length && (
        <Panel className="p-5">
          <SectionLabel>News &amp; sentiment</SectionLabel>
          <ul className="mt-3 divide-y divide-border">
            {data.news_sentiment.map((n, i) => (
              <li key={i} className="flex items-start gap-3 py-2.5 text-sm first:pt-0">
                <Badge tone={n.sentiment}>{n.sentiment}</Badge>
                <span className="flex-1">
                  <a href={n.url} target="_blank" rel="noreferrer" className="text-text transition hover:text-accent">{n.title}</a>
                  {n.ticker && <span className="tnum text-muted"> · {n.ticker}</span>}
                  <Cite source={n.citation} />
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {!!data.filing_insights?.length && (
        <Panel className="p-5">
          <SectionLabel>From SEC filings</SectionLabel>
          <ul className="mt-3 space-y-2.5 text-sm text-text-2">
            {data.filing_insights.map((f, i) => (
              <li key={i} className="border-l-2 border-border pl-3">
                {f.ticker && <Num className="font-semibold text-text">{f.ticker}: </Num>}{f.insight}
                <Cite source={f.citation || f.source_ref} />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {!!data.risks?.length && (
        <Panel className="p-5">
          <SectionLabel>Risk assessment</SectionLabel>
          <ul className="mt-3 space-y-2 text-sm text-text-2">
            {data.risks.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--neg)" }} />
                <span>{r.ticker && <Num className="font-semibold text-text">{r.ticker}: </Num>}{r.risk}<Cite source={r.citation} /></span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {!!data.sources_used?.length && (
        <p className="tnum text-xs text-muted">Sources: {data.sources_used.join(" · ")}</p>
      )}
    </div>
  );
}

const Stat = ({ k, v }: { k: string; v: string }) => (
  <div className="flex items-baseline justify-between gap-2">
    <dt className="text-muted">{k}</dt>
    <dd className="tnum text-text-2">{v}</dd>
  </div>
);
