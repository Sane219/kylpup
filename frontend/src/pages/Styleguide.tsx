import { Panel, SectionLabel, Badge, Delta, Cite, Skeleton, Field, Num } from "../components/ui";

// Dev-only impeccable reference surface (mounted only when import.meta.env.DEV).
const TOKENS = ["bg", "surface", "surface-2", "border", "border-strong", "text", "text-2", "muted", "accent", "pos", "neg"];

export default function Styleguide() {
  return (
    <div className="mx-auto max-w-[1180px] space-y-8 p-8 text-text">
      <h1 className="text-2xl font-semibold tracking-tight">Styleguide</h1>

      <Panel className="space-y-3 p-5">
        <SectionLabel>Color tokens</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {TOKENS.map((t) => (
            <div key={t} className="space-y-1.5">
              <div className="h-12 rounded-md border border-border" style={{ background: `var(--${t})` }} />
              <code className="tnum text-[11px] text-muted">{t}</code>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="space-y-2 p-5">
        <SectionLabel>Type scale</SectionLabel>
        <p className="text-2xl font-semibold tracking-tight">Display 2xl</p>
        <p className="text-xl font-semibold tracking-tight">Heading xl</p>
        <p className="text-lg">Subhead lg</p>
        <p className="text-base text-text-2">Body base — the quick brown fox.</p>
        <p className="text-sm text-muted">Small muted</p>
        <p className="tnum text-base">1,234,567.89 · +12.34% · AAPL</p>
      </Panel>

      <Panel className="space-y-3 p-5">
        <SectionLabel>Components</SectionLabel>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn">Primary</button>
          <button className="btn-ghost">Ghost</button>
          <button className="btn" disabled>Disabled</button>
          <Badge tone="positive">positive</Badge>
          <Badge tone="negative">negative</Badge>
          <Badge tone="neutral">neutral</Badge>
          <Badge tone="accent">accent</Badge>
          <Delta value={2.41} /><Delta value={-1.88} />
          <Num>$420.69</Num><Cite source="yfinance" />
        </div>
        <div className="grid max-w-md gap-3">
          <Field label="Email" placeholder="you@firm.com" />
          <Field label="Password" type="password" error="Too short." />
        </div>
        <div className="grid gap-2"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-6 w-3/4" /></div>
      </Panel>
    </div>
  );
}
