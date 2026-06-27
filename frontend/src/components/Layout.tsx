import { FormEvent, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { Icon } from "./ui";
import { Logo } from "./Logo";
import CommandPalette from "./CommandPalette";
import TickerTape from "./TickerTape";
import { useMarket, breadth, fmtPrice, EQUITY_SYMBOLS } from "../lib/market";

const NAV = [
  { to: "/", label: "Dashboard", icon: "home" as const, end: true },
  { to: "/markets", label: "Markets", icon: "grid" as const },
  { to: "/watchlist", label: "Watchlist", icon: "star" as const },
];
const NAV_RESEARCH = [
  { to: "/research", label: "Research", icon: "search" as const },
  { to: "/reports", label: "Reports", icon: "list" as const },
];

/** US cash-session heuristic (ET), good enough for the status strip. */
function sessionState(d: Date) {
  const et = new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const mins = et.getHours() * 60 + et.getMinutes();
  const weekday = et.getDay() >= 1 && et.getDay() <= 5;
  if (!weekday) return { label: "Closed", open: false };
  if (mins >= 570 && mins < 960) return { label: "Market open", open: true };
  if (mins >= 240 && mins < 570) return { label: "Pre-market", open: false };
  if (mins >= 960 && mins < 1200) return { label: "After hours", open: false };
  return { label: "Closed", open: false };
}

function StatusBar() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const sess = sessionState(now);
  const market = useMarket();
  const spx = market.find((q) => q.symbol === "SPX");
  const b = breadth(market.filter((q) => EQUITY_SYMBOLS.includes(q.symbol)));
  return (
    <footer className="flex h-8 shrink-0 items-center gap-4 overflow-hidden border-t border-border bg-surface px-5 text-[11px] text-muted">
      <span className="inline-flex items-center gap-1.5">
        <span className="live-dot h-1.5 w-1.5 rounded-full" style={{ background: "var(--amber)" }} />
        <span className="tnum font-medium text-text-2">LIVE</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: sess.open ? "var(--pos)" : "var(--text-muted)" }} />
        {sess.label}
      </span>
      {spx && (
        <span className="hidden tnum items-center gap-1.5 sm:inline-flex">
          <span className="text-muted">SPX</span>
          <span className="text-text-2">{fmtPrice(spx)}</span>
          <span style={{ color: spx.changePct >= 0 ? "var(--pos)" : "var(--neg)" }}>
            {spx.changePct >= 0 ? "+" : ""}{spx.changePct.toFixed(2)}%
          </span>
        </span>
      )}
      <span className="hidden tnum md:inline">
        <span className="text-pos">{b.adv}</span>/<span className="text-neg">{b.dec}</span> a/d
      </span>
      <span className="tnum">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
      <span className="ml-auto tnum whitespace-nowrap opacity-80">Delayed · yfinance</span>
    </footer>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const nav2 = useNavigate();
  const { pathname } = useLocation();
  const [ask, setAsk] = useState("");
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("klypup_nav") === "1");
  const setNav = (c: boolean) => { setCollapsed(c); localStorage.setItem("klypup_nav", c ? "1" : "0"); };
  const openPalette = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  const onAsk = (e: FormEvent) => {
    e.preventDefault();
    const q = ask.trim();
    if (q.length >= 3) { nav2("/research", { state: { q } }); setAsk(""); }
  };

  const navBottom = [
    { to: "/settings", label: "Settings", icon: "settings" as const },
    ...(user?.role === "admin" ? [{ to: "/members", label: "Team", icon: "users" as const }] : []),
  ];

  const NavItem = (n: { to: string; label: string; icon: Parameters<typeof Icon>[0]["name"]; end?: boolean }) => (
    <NavLink key={n.to} to={n.to} end={n.end} title={n.label}
      className={({ isActive }) =>
        `relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ease-terminal ${
          isActive ? "bg-surface-2 text-text" : "text-text-2 hover:bg-surface-2 hover:text-text"
        } ${collapsed ? "justify-center" : ""}`}>
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-accent glow-accent" />}
          <Icon name={n.icon} className={isActive ? "text-accent" : "text-muted"} />{!collapsed && n.label}
        </>
      )}
    </NavLink>
  );

  const GroupLabel = ({ children }: { children: string }) =>
    collapsed ? <div className="mx-2 my-1 border-t border-border" /> : (
      <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted">{children}</p>
    );

  return (
    <div className="flex h-[100dvh] flex-col bg-bg text-text">
      <CommandPalette />
      <TickerTape />

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className={`flex shrink-0 flex-col border-r border-border bg-surface transition-[width] ease-terminal ${collapsed ? "w-[60px]" : "w-[208px]"}`}>
          <div className="flex h-14 items-center border-b border-border px-4">
            {collapsed ? <Logo compact /> : <Logo height={20} />}
          </div>

          <nav className="flex-1 overflow-y-auto p-2">
            <div className="space-y-1">{NAV.map(NavItem)}</div>
            <GroupLabel>Research</GroupLabel>
            <div className="space-y-1">{NAV_RESEARCH.map(NavItem)}</div>
            <GroupLabel>Workspace</GroupLabel>
            <div className="space-y-1">{navBottom.map(NavItem)}</div>
          </nav>

          <button onClick={() => setNav(!collapsed)} title={collapsed ? "Expand" : "Collapse"}
            className="m-2 flex items-center justify-center rounded-md p-2 text-muted transition ease-terminal hover:bg-surface-2 hover:text-text">
            <Icon name="arrow" className={collapsed ? "" : "rotate-180"} />
          </button>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-sticky flex h-14 items-center gap-3 border-b border-border bg-bg/80 px-5 backdrop-blur">
            <form onSubmit={onAsk}
              className="flex min-w-0 max-w-[460px] flex-1 items-center gap-2 rounded-md border border-border bg-surface px-3 transition ease-terminal focus-within:border-accent">
              <Icon name="search" size={14} className="shrink-0 text-muted" />
              <input
                value={ask} onChange={(e) => setAsk(e.target.value)}
                placeholder="Ask the desk: compare NVDA and AMD, risks…"
                aria-label="Ask a research question"
                className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted"
              />
              <button type="button" onClick={openPalette} title="Open command palette" aria-label="Open command palette"
                className="tnum shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted transition ease-terminal hover:border-border-strong hover:text-text-2">⌘K</button>
            </form>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={toggle} title="Toggle theme" aria-label="Toggle theme"
                className="grid h-9 w-9 place-items-center rounded-md text-text-2 transition ease-terminal hover:bg-surface-2 hover:text-text">
                <Icon name={theme === "dark" ? "sun" : "moon"} />
              </button>
              <span className="rounded border border-border bg-surface px-2 py-1 text-xs font-medium text-text-2 capitalize">{user?.role}</span>
              <button onClick={logout} title="Log out" aria-label="Log out"
                className="grid h-9 w-9 place-items-center rounded-md text-text-2 transition ease-terminal hover:bg-surface-2 hover:text-text">
                <Icon name="logout" />
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div key={pathname} className="route-fade mx-auto w-full max-w-[1240px] px-5 py-6"><Outlet /></div>
          </main>

          <StatusBar />
        </div>
      </div>
    </div>
  );
}
