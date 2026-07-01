import { Link } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { Badge, Panel, SectionLabel, Cite, Empty, Delta, Num, Skeleton } from "./ui";

// The agent's structured UI state (see backend SYNTH_SYSTEM schema).
export type ResearchData = {
  summary?: string;
  key_takeaways?: string[];
  company_cards?: any[];
  comparison_table?: { columns: string[]; rows: string[][] };
  news_sentiment?: any[];
  filing_insights?: any[];
  insider_activity?: any[];
  opportunities?: any[];
  risks?: any[];
  outlook?: string;
  sources_used?: string[];
  _plan?: { tickers?: string[]; fetch_market?: boolean; fetch_news?: boolean; fetch_insider?: boolean; search_filings?: boolean };
  _review?: { issues?: string[]; revised?: boolean };
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
          {data._plan.fetch_insider && <Badge tone="accent">insider</Badge>}
          {data._plan.search_filings && <Badge tone="accent">filings</Badge>}
          {data._review?.revised && (
            <span className="ml-1 inline-flex items-center gap-1 text-muted">
              <span aria-hidden="true">✦</span> revised after editor review{data._review.issues?.length ? ` · ${data._review.issues.length} gap${data._review.issues.length !== 1 ? "s" : ""} addressed` : ""}
            </span>
          )}
        </div>
      )}

      {(data.summary || data.key_takeaways?.length) && (
        <Panel className="p-5">
          <SectionLabel>Executive summary</SectionLabel>
          {data.summary && <p className="mt-2 max-w-[72ch] leading-relaxed text-text-2 text-pretty">{data.summary}</p>}
          {!!data.key_takeaways?.length && (
            <ul className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-2">
              {data.key_takeaways.map((k, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-text-2">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg>
                  <span>{k}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {!!data.company_cards?.length && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.company_cards.map((c, i) => (
            <Panel key={i} className="flex flex-col p-4">
              <div className="flex items-start justify-between">
                <div>
                  <Link to={`/stock/${c.ticker}`} className="tnum text-base font-semibold tracking-tight transition hover:text-accent">{c.ticker}</Link>
                  <div className="truncate text-xs text-muted">{c.name}</div>
                </div>
                <div className="text-right">
                  <div className="tnum text-2xl font-semibold leading-none tracking-[-0.01em]">{c.price != null ? `$${fmt(c.price)}` : "—"}</div>
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

              {c.highlight && <p className="mt-3 text-sm font-medium text-text">{c.highlight}</p>}
              {c.thesis && <p className="mt-1.5 text-sm leading-relaxed text-text-2 text-pretty">{c.thesis}</p>}
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
                  {n.takeaway && <span className="mt-0.5 block text-xs leading-relaxed text-muted">{n.takeaway}</span>}
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
              <li key={i} className="flex gap-2 leading-relaxed">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
                <span>{f.ticker && <Num className="font-semibold text-text">{f.ticker}: </Num>}{f.insight}<Cite source={f.citation || f.source_ref} /></span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {!!data.insider_activity?.length && (
        <Panel className="p-5">
          <SectionLabel>Insider &amp; analyst activity</SectionLabel>
          <ul className="mt-3 space-y-2.5 text-sm text-text-2">
            {data.insider_activity.map((a, i) => (
              <li key={i} className="flex gap-2 leading-relaxed">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
                <span>
                  {a.ticker && <Num className="font-semibold text-text">{a.ticker}: </Num>}{a.signal}
                  {(a.target_mean != null || a.target_high != null || a.target_low != null) && (
                    <span className="tnum text-muted">
                      {" ·"}{a.target_low != null && ` low $${fmt(a.target_low)}`}
                      {a.target_mean != null && ` · mean $${fmt(a.target_mean)}`}
                      {a.target_high != null && ` · high $${fmt(a.target_high)}`}
                    </span>
                  )}
                  <Cite source={a.citation} />
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {(!!data.opportunities?.length || !!data.risks?.length) && (
        <div className="grid gap-5 lg:grid-cols-2">
          {!!data.opportunities?.length && (
            <Panel className="p-5">
              <SectionLabel>Opportunities</SectionLabel>
              <ul className="mt-3 space-y-2.5 text-sm text-text-2">
                {data.opportunities.map((o, i) => (
                  <li key={i} className="flex gap-2 leading-relaxed">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--pos)" }} />
                    <span>{o.ticker && <Num className="font-semibold text-text">{o.ticker}: </Num>}{o.opportunity}<Cite source={o.citation} /></span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {!!data.risks?.length && (
            <Panel className="p-5">
              <SectionLabel>Risks</SectionLabel>
              <ul className="mt-3 space-y-2.5 text-sm text-text-2">
                {data.risks.map((r, i) => (
                  <li key={i} className="flex gap-2 leading-relaxed">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--neg)" }} />
                    <span>{r.ticker && <Num className="font-semibold text-text">{r.ticker}: </Num>}{r.risk}<Cite source={r.citation} /></span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}

      {data.outlook && (
        <Panel className="p-5">
          <SectionLabel>Outlook</SectionLabel>
          <p className="mt-2 max-w-[72ch] leading-relaxed text-text-2 text-pretty">{data.outlook}</p>
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
