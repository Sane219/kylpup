import { FormEvent, useState } from "react";
import { useAuth } from "../lib/auth";
import { Field, ErrorBanner, Icon } from "../components/ui";

export default function Login() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [orgMode, setOrgMode] = useState<"create" | "join">("create");
  const [form, setForm] = useState({ email: "", password: "", org_name: "", invite_code: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      if (mode === "login") await login(form.email, form.password);
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
    <div className="grid min-h-[100dvh] bg-bg lg:grid-cols-2">
      {/* Brand panel — quiet grid motif, not a gradient blob */}
      <div className="relative hidden overflow-hidden border-r border-border bg-surface lg:block">
        <div className="absolute inset-0 opacity-[0.6]"
          style={{ backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded bg-accent text-on-accent"><Icon name="chart" /></span>
            <span className="text-lg font-semibold tracking-tight">Klypup</span>
          </div>
          <div>
            <h2 className="max-w-md text-2xl font-semibold leading-tight tracking-tight text-balance">
              Natural-language research, structured into a terminal.
            </h2>
            <p className="mt-3 max-w-md text-sm text-muted">
              Market data, news sentiment, and SEC filings. One query, sourced answers.
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
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
        </div>
      </div>
    </div>
  );
}
