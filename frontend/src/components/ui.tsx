import { ReactNode } from "react";

export const Spinner = ({ label = "Loading…" }: { label?: string }) => (
  <div className="flex items-center gap-3 text-slate-500 py-8 justify-center">
    <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
    {label}
  </div>
);

export const ErrorBanner = ({ message }: { message: string }) => (
  <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
    {message}
  </div>
);

export const Empty = ({ title, hint }: { title: string; hint?: string }) => (
  <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center text-slate-500">
    <p className="font-medium text-slate-600">{title}</p>
    {hint && <p className="mt-1 text-sm">{hint}</p>}
  </div>
);

export const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>
);

export const Badge = ({ tone = "slate", children }: { tone?: string; children: ReactNode }) => {
  const tones: Record<string, string> = {
    positive: "bg-green-100 text-green-700",
    negative: "bg-red-100 text-red-700",
    neutral: "bg-slate-100 text-slate-600",
    slate: "bg-slate-100 text-slate-600",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone] || tones.slate}`}>{children}</span>;
};

/** Source attribution chip — every data point shows where it came from. */
export const Cite = ({ source }: { source?: string }) =>
  source ? <span className="ml-1 text-[11px] text-slate-400">· {source}</span> : null;
