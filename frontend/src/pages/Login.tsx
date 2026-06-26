import { FormEvent, useState } from "react";
import { useAuth } from "../lib/auth";
import { Card, ErrorBanner } from "../components/ui";

export default function Login() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [form, setForm] = useState({ email: "", password: "", org_name: "", invite_code: "" });
  const [orgMode, setOrgMode] = useState<"create" | "join">("create");
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
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-bold">Klypup Research</h1>
        <p className="mb-4 text-sm text-slate-500">{mode === "login" ? "Sign in to your workspace" : "Create your account"}</p>
        <form onSubmit={submit} className="space-y-3">
          <input className="input" placeholder="Email" type="email" required value={form.email} onChange={set("email")} />
          <input className="input" placeholder="Password" type="password" required minLength={8} value={form.password} onChange={set("password")} />
          {mode === "signup" && (
            <>
              <div className="flex gap-2 text-sm">
                <button type="button" onClick={() => setOrgMode("create")} className={`flex-1 rounded border py-1 ${orgMode === "create" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"}`}>New org</button>
                <button type="button" onClick={() => setOrgMode("join")} className={`flex-1 rounded border py-1 ${orgMode === "join" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"}`}>Join org</button>
              </div>
              {orgMode === "create"
                ? <input className="input" placeholder="Organization name" required value={form.org_name} onChange={set("org_name")} />
                : <input className="input" placeholder="Invite code" required value={form.invite_code} onChange={set("invite_code")} />}
            </>
          )}
          {err && <ErrorBanner message={err} />}
          <button disabled={busy} className="w-full rounded-md bg-slate-900 py-2 text-white disabled:opacity-50">
            {busy ? "…" : mode === "login" ? "Sign in" : "Sign up"}
          </button>
        </form>
        <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErr(""); }} className="mt-3 w-full text-sm text-slate-500 hover:underline">
          {mode === "login" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
      </Card>
    </div>
  );
}
