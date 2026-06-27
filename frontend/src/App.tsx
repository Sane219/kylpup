import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { ThemeProvider } from "./lib/theme";
import Layout from "./components/Layout";
import { Spinner, ToastProvider } from "./components/ui";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Reports from "./pages/Reports";
import Watchlist from "./pages/Watchlist";
import Markets from "./pages/Markets";
import Settings from "./pages/Settings";
import Members from "./pages/Members";
import Styleguide from "./pages/Styleguide";

// Recharts-heavy routes are split out so it stays off the initial bundle.
const Research = lazy(() => import("./pages/Research"));
const ReportDetail = lazy(() => import("./pages/ReportDetail"));
const StockDetail = lazy(() => import("./pages/StockDetail"));

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-[100dvh] place-items-center bg-bg"><Spinner /></div>;
  return user ? <Layout /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              {import.meta.env.DEV && <Route path="/styleguide" element={<Styleguide />} />}
              <Route element={<Protected />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/markets" element={<Markets />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/research" element={<Suspense fallback={<Spinner />}><Research /></Suspense>} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/reports/:id" element={<Suspense fallback={<Spinner />}><ReportDetail /></Suspense>} />
                <Route path="/watchlist" element={<Watchlist />} />
                <Route path="/stock/:symbol" element={<Suspense fallback={<Spinner />}><StockDetail /></Suspense>} />
                <Route path="/members" element={<Members />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
