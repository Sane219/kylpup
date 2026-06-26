import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`;

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          <span className="mr-4 text-lg font-bold">Klypup</span>
          <NavLink to="/" end className={linkCls}>Dashboard</NavLink>
          <NavLink to="/research" className={linkCls}>New Research</NavLink>
          <NavLink to="/reports" className={linkCls}>Reports</NavLink>
          <NavLink to="/watchlist" className={linkCls}>Watchlist</NavLink>
          {user?.role === "admin" && <NavLink to="/members" className={linkCls}>Team</NavLink>}
          <div className="ml-auto flex items-center gap-3 text-sm text-slate-500">
            <span className="rounded bg-slate-100 px-2 py-0.5">{user?.role}</span>
            <button onClick={logout} className="text-slate-600 hover:underline">Logout</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6"><Outlet /></main>
    </div>
  );
}
