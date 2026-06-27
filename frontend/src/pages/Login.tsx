import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Field, ErrorBanner } from "../components/ui";
import { Logo } from "../components/Logo";
import { useMarket, useQuotes, fmtPrice, EQUITY_SYMBOLS } from "../lib/market";
import { Heatmap, QuoteDelta } from "../components/market";

/** Live mini board — proves the tape is moving before you even sign in. */
function CockpitBoard() {
  const rows = useQuotes(["NVDA", "AAPL", "MSFT", "TSLA", "META", "AMD"]);
  return (
    <div className="rounded-lg border border-border bg-surface/70">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="func-tag">TAPE</span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
          <span className="live-dot h-1.5 w-1.5 rounded-full" style={{ background: "var(--amber)" }} /> live
        </span>
      </div>
      <ul className="divide-y divide-border/70">
        {rows.map((q) => (
          <li key={q.symbol} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
            <span className="tnum font-semibold text-text-2">{q.symbol}</span>
            <span className="flex items-baseline gap-2.5 whitespace-nowrap">
              <span className="tnum text-text">{fmtPrice(q)}</span>
              <QuoteDelta q={q} className="text-xs" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Login() {
  const nav = useNavigate();
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [orgMode, setOrgMode] = useState<"create" | "join">("create");
  const [form, setForm] = useState({ email: "", password: "", org_name: "", invite_code: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });
  const equities = useMarket().filter((q) => EQUITY_SYMBOLS.includes(q.symbol));

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      if (mode === "login") { await login(form.email, form.password); nav("/"); }
      else await signup({
        email: form.email, password: form.password,
        ...(orgMode === "create" ? { org_name: form.org_name } : { invite_code: form.invite_code }),
      });
    } catch (e: any) {
      const m = e.message || "Something went wrong.";
      setErr(/409|exist/i.test(m) ? "That email is already registered. Try signing in." : m);
    } finally { setBusy(false); }
  };

  const tab = (active: boolean) =>
    `flex-1 rounded-md border py-1.5 text-sm font-medium transition ease-terminal ${
      active ? "border-accent bg-accent text-on-accent" : "border-border text-text-2 hover:bg-surface-2"
    }`;

  return (
    <div className="grid min-h-[100dvh] bg-bg lg:grid-cols-[1.05fr_1fr]">
      {/* Cockpit panel */}
      <div className="term-grid relative hidden overflow-hidden border-r border-border bg-surface lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div className="flex items-center justify-between">
          <Logo height={24} />
          <span className="tnum text-[11px] text-muted">v1 · simulated feed</span>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="max-w-lg text-[2.75rem] font-bold leading-[1.04] tracking-[-0.02em] text-balance">
              The market, structured into a terminal.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-text-2">
              Live tape, news sentiment, and SEC filings, orchestrated by an agent. Ask in plain English; get sourced answers as cards, tables, and charts.
            </p>
          </div>
          <div className="grid max-w-md gap-4 sm:grid-cols-2">
            <CockpitBoard />
            <Heatmap quotes={equities.slice(0, 8)} className="self-start" />
          </div>
        </div>

        <div className="tnum flex items-center gap-2 text-sm text-muted">
          <span className="text-amber">KLYP&gt;</span>
          <span className="truncate text-text-2">compare NVDA and AMD: growth, risks</span>
          <span className="caret-blink inline-block h-4 w-[7px] shrink-0 bg-accent align-middle" />
        </div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo height={22} /></div>
          <h1 className="text-xl font-semibold tracking-tight">{mode === "login" ? "Sign in" : "Create your account"}</h1>
          <p className="mt-1 text-sm text-muted">{mode === "login" ? "Welcome back to your workspace." : "Start a new org or join one with an invite."}</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Email" type="email" required autoComplete="email" value={form.email} onChange={set("email")} placeholder="you@firm.com" />
            <Field label="Password" type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} value={form.password} onChange={set("password")} hint={mode === "signup" ? "At least 8 characters." : undefined} />

            {mode === "signup" && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button type="button" onClick={() => setOrgMode("create")} className={tab(orgMode === "create")}>New org</button>
                  <button type="button" onClick={() => setOrgMode("join")} className={tab(orgMode === "join")}>Join org</button>
                </div>
                {orgMode === "create"
                  ? <Field label="Organization name" required value={form.org_name} onChange={set("org_name")} placeholder="Acme Capital" />
                  : <Field label="Invite code" required value={form.invite_code} onChange={set("invite_code")} placeholder="Paste your code" />}
              </div>
            )}

            {err && <ErrorBanner message={err} />}
            <button disabled={busy} className="btn w-full">
              {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-accent/40 border-t-on-accent" /> : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErr(""); }} className="mt-4 text-sm text-muted transition hover:text-text">
            {mode === "login" ? "Need an account? Sign up" : "Have an account? Sign in"}
          </button>

          {mode === "login" && (
            <div className="mt-8 rounded-lg border border-border bg-surface p-3.5">
              <p className="text-xs font-medium text-text-2">Demo access</p>
              <p className="mt-1 text-xs text-muted">Explore with a seeded workspace, no signup needed.</p>
              <button type="button"
                onClick={() => setForm({ ...form, email: "admin@acme.test", password: "demo1234" })}
                className="tnum mt-2.5 flex w-full items-center justify-between gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-left text-xs text-text-2 transition ease-terminal hover:border-border-strong hover:text-text">
                <span>admin@acme.test · demo1234</span><span className="text-accent">Fill →</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
