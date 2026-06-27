import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { Icon } from "./ui";

type Cmd = { label: string; hint?: string; run: () => void; icon: Parameters<typeof Icon>[0]["name"] };

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDialogElement>(null);
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) { d.showModal(); setQ(""); } else if (d.open) d.close();
  }, [open]);

  const go = (fn: () => void) => () => { setOpen(false); fn(); };
  const cmds: Cmd[] = [
    { label: "Dashboard", icon: "home", run: go(() => nav("/")) },
    { label: "Markets", icon: "grid", run: go(() => nav("/markets")) },
    { label: "New research", icon: "search", run: go(() => nav("/research")) },
    { label: "Reports", icon: "list", run: go(() => nav("/reports")) },
    { label: "Watchlist", icon: "star", run: go(() => nav("/watchlist")) },
    { label: "Settings", icon: "settings", run: go(() => nav("/settings")) },
    ...(user?.role === "admin" ? [{ label: "Team", icon: "users" as const, run: go(() => nav("/members")) }] : []),
    { label: `Switch to ${theme === "dark" ? "light" : "dark"} theme`, icon: theme === "dark" ? "sun" : "moon", run: go(toggle) },
    { label: "Log out", icon: "logout", run: go(logout) },
  ];

  const ql = q.trim().toLowerCase();
  const filtered = ql ? cmds.filter((c) => c.label.toLowerCase().includes(ql)) : cmds;
  const canRun = ql.length >= 3;

  return (
    <dialog
      ref={ref}
      onClose={() => setOpen(false)}
      onClick={(e) => { if (e.target === ref.current) setOpen(false); }}
      className="z-modal mt-[12vh] w-[min(560px,92vw)] rounded-lg border border-border bg-surface p-0 text-text shadow-card backdrop:bg-black/50"
    >
      <div className="animate-pop">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Icon name="search" className="text-muted" />
          <input
            autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search or type a research query…"
            className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted"
            onKeyDown={(e) => { if (e.key === "Enter" && canRun && filtered.length === 0) { setOpen(false); nav("/research", { state: { q } }); } }}
          />
          <kbd className="tnum rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">ESC</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-1.5">
          {filtered.map((c) => (
            <li key={c.label}>
              <button onClick={c.run} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-text-2 transition ease-terminal hover:bg-surface-2 hover:text-text">
                <Icon name={c.icon} className="text-muted" />
                {c.label}
              </button>
            </li>
          ))}
          {canRun && (
            <li>
              <button onClick={() => { setOpen(false); nav("/research", { state: { q } }); }}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-text-2 transition ease-terminal hover:bg-surface-2 hover:text-text">
                <Icon name="search" className="text-accent" />
                Run research: <span className="text-text">“{q}”</span>
              </button>
            </li>
          )}
          {!filtered.length && !canRun && <li className="px-3 py-6 text-center text-sm text-muted">No matches. Type 3+ chars to run a query.</li>}
        </ul>
      </div>
    </dialog>
  );
}
