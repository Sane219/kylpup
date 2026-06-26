import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Card, Cite, Empty } from "./ui";

// The agent's structured UI state (see backend SYNTH_SYSTEM schema).
export type ResearchData = {
  summary?: string;
  company_cards?: any[];
  comparison_table?: { columns: string[]; rows: string[][] };
  news_sentiment?: any[];
  filing_insights?: any[];
  risks?: any[];
  sources_used?: string[];
  _plan?: any;
};

const fmt = (n: any) =>
  n == null ? "—" : typeof n === "number" ? n.toLocaleString() : String(n);

export default function ResearchResult({ data }: { data: ResearchData }) {
  if (!data || Object.keys(data).length === 0)
    return <Empty title="No analysis yet" hint="Run a research query to see results." />;

  return (
    <div className="space-y-6">
      {data.summary && (
        <Card>
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">Summary</h3>
          <p className="text-slate-700">{data.summary}</p>
        </Card>
      )}

      {!!data.company_cards?.length && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.company_cards.map((c, i) => (
            <Card key={i}>
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{c.ticker}</span>
                <span className="text-lg">{c.price != null ? `$${fmt(c.price)}` : "—"}</span>
              </div>
              <p className="text-sm text-slate-500">{c.name}</p>
              <dl className="mt-3 space-y-1 text-sm">
                <Row k="Market Cap" v={fmt(c.market_cap)} />
                <Row k="P/E" v={fmt(c.pe_ratio)} />
                <Row k="EPS" v={fmt(c.eps)} />
                <Row k="Revenue" v={fmt(c.revenue)} />
              </dl>
              {c.highlight && <p className="mt-2 text-sm text-slate-600">{c.highlight}</p>}
              <div className="mt-2"><Cite source={c.citation} /></div>
              {!!c.history?.length && (
                <ResponsiveContainer width="100%" height={80}>
                  <LineChart data={c.history}>
                    <XAxis dataKey="date" hide /><YAxis hide domain={["auto", "auto"]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="close" stroke="#2563eb" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>
          ))}
        </div>
      )}

      {!!data.comparison_table?.rows?.length && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  {data.comparison_table.columns.map((c, i) => <th key={i} className="py-2 pr-4">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.comparison_table.rows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {r.map((cell, j) => <td key={j} className="py-2 pr-4">{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!!data.news_sentiment?.length && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">News & Sentiment</h3>
          <ul className="space-y-2">
            {data.news_sentiment.map((n, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Badge tone={n.sentiment}>{n.sentiment}</Badge>
                <span className="flex-1">
                  <a href={n.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{n.title}</a>
                  {n.ticker && <span className="text-slate-400"> · {n.ticker}</span>}
                  <Cite source={n.citation} />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!!data.filing_insights?.length && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">From SEC Filings</h3>
          <ul className="space-y-2 text-sm">
            {data.filing_insights.map((f, i) => (
              <li key={i}>{f.ticker && <b>{f.ticker}: </b>}{f.insight}<Cite source={f.citation} /></li>
            ))}
          </ul>
        </Card>
      )}

      {!!data.risks?.length && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Risk Assessment</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {data.risks.map((r, i) => <li key={i}>{r.ticker && <b>{r.ticker}: </b>}{r.risk}<Cite source={r.citation} /></li>)}
          </ul>
        </Card>
      )}

      {!!data.sources_used?.length && (
        <p className="text-xs text-slate-400">Sources: {data.sources_used.join(", ")}</p>
      )}
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between"><dt className="text-slate-500">{k}</dt><dd>{v}</dd></div>
);
