import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { Icon } from "./ui";
import CommandPalette from "./CommandPalette";

const NAV = [
  { to: "/", label: "Dashboard", icon: "home" as const, end: true },
  { to: "/research", label: "Research", icon: "search" as const },
  { to: "/reports", label: "Reports", icon: "list" as const },
  { to: "/watchlist", label: "Watchlist", icon: "star" as const },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("klypup_nav") === "1");
  const setNav = (c: boolean) => { setCollapsed(c); localStorage.setItem("klypup_nav", c ? "1" : "0"); };

  const nav = [...NAV, ...(user?.role === "admin" ? [{ to: "/members", label: "Team", icon: "users" as const }] : [])];

  return (
    <div className="flex min-h-[100dvh] bg-bg text-text">
      <CommandPalette />

      {/* Sidebar */}
      <aside className={`sticky top-0 flex h-[100dvh] shrink-0 flex-col border-r border-border bg-surface transition-[width] ease-terminal ${collapsed ? "w-[60px]" : "w-[208px]"}`}>
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-accent text-on-accent">
            <Icon name="chart" size={16} />
          </span>
          {!collapsed && <span className="text-base font-semibold tracking-tight">Klypup</span>}
        </div>

        <nav className="flex-1 space-y-1 p-2">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={(n as any).end} title={n.label}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ease-terminal ${
                  isActive ? "bg-surface-2 text-text" : "text-text-2 hover:bg-surface-2 hover:text-text"
                } ${collapsed ? "justify-center" : ""}`}>
              {({ isActive }) => (<><Icon name={n.icon} className={isActive ? "text-accent" : "text-muted"} />{!collapsed && n.label}</>)}
            </NavLink>
          ))}
        </nav>

        <button onClick={() => setNav(!collapsed)} title={collapsed ? "Expand" : "Collapse"}
          className="m-2 flex items-center justify-center rounded-md p-2 text-muted transition ease-terminal hover:bg-surface-2 hover:text-text">
          <Icon name="arrow" className={collapsed ? "" : "rotate-180"} />
        </button>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-sticky flex h-14 items-center gap-3 border-b border-border bg-bg/80 px-5 backdrop-blur">
          <button onClick={() => { const e = new KeyboardEvent("keydown", { key: "k", metaKey: true }); window.dispatchEvent(e); }}
            className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-muted transition ease-terminal hover:border-border-strong hover:text-text-2">
            <Icon name="search" size={14} /> Search
            <kbd className="tnum ml-2 rounded border border-border px-1 text-[10px]">⌘K</kbd>
          </button>
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

        <main className="mx-auto w-full max-w-[1180px] flex-1 px-5 py-6"><Outlet /></main>
      </div>
    </div>
  );
}
