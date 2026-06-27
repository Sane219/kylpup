import { createContext, useContext, useState, useCallback, ReactNode, InputHTMLAttributes, TextareaHTMLAttributes, useId } from "react";

/* ---------- icons (curated, single stroke weight 1.75) ---------- */
type IconName = "search" | "chart" | "list" | "star" | "users" | "home" | "sun" | "moon" | "logout" | "x" | "plus" | "command" | "arrow" | "grid" | "settings" | "copy" | "check";
const PATHS: Record<IconName, ReactNode> = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>,
  check: <path d="M5 13l4 4L19 7" />,
  chart: <><path d="M3 3v18h18" /><path d="m7 14 3-4 3 3 4-6" /></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></>,
  star: <path d="m12 3 2.6 5.3 5.9.9-4.3 4.2 1 5.8L12 16.8 6.8 19.4l1-5.8L3.5 9.2l5.9-.9L12 3Z" />,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1M17 20a5.5 5.5 0 0 0-3-4.9" /></>,
  home: <path d="M4 11 12 4l8 7M6 9.5V20h12V9.5" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4" /></>,
  moon: <path d="M20 13.5A8 8 0 1 1 10.5 4 6.5 6.5 0 0 0 20 13.5Z" />,
  logout: <><path d="M9 5H5v14h4M15 8l4 4-4 4M19 12H9" /></>,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  command: <path d="M8 8h8v8H8zM8 8V6a2 2 0 1 0-2 2h2Zm8 0V6a2 2 0 1 1 2 2h-2Zm-8 8v2a2 2 0 1 1-2-2h2Zm8 0v2a2 2 0 1 0 2-2h-2Z" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
};
export const Icon = ({ name, size = 16, className = "" }: { name: IconName; size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {PATHS[name]}
  </svg>
);

/* ---------- containers (single elevation primitive; never nested) ---------- */
export const Panel = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <section className={`rounded-lg border border-border bg-surface ${className}`}>{children}</section>
);

export const SectionLabel = ({ children }: { children: ReactNode }) => (
  <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{children}</h3>
);

/** Terminal panel header bar: amber function-code tag + title + optional right slot. */
export const PanelHeader = ({ code, title, right }: { code?: string; title: ReactNode; right?: ReactNode }) => (
  <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
    <div className="flex min-w-0 items-center gap-2">
      {code && <span className="func-tag shrink-0">{code}</span>}
      <h3 className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-text-2">{title}</h3>
    </div>
    {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
  </div>
);

/* ---------- numerics ---------- */
export const Num = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <span className={`tnum ${className}`}>{children}</span>
);

/** Signed delta with arrow + color + sign — never color alone (colorblind-safe). */
export const Delta = ({ value }: { value?: number | null }) => {
  if (value == null) return <span className="tnum text-muted">—</span>;
  const up = value >= 0;
  return (
    <span className="tnum inline-flex items-center gap-0.5 text-sm font-medium" style={{ color: up ? "var(--pos)" : "var(--neg)" }}>
      {up ? "▲" : "▼"} {up ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
};

/* ---------- badge ---------- */
const TONES: Record<string, string> = {
  positive: "text-pos border-pos/40",
  negative: "text-neg border-neg/40",
  neutral: "text-muted border-border-strong",
  accent: "text-accent border-accent/40",
};
export const Badge = ({ tone = "neutral", children }: { tone?: string; children: ReactNode }) => (
  <span className={`inline-flex items-center rounded border bg-surface-2 px-1.5 py-0.5 text-xs font-medium ${TONES[tone] || TONES.neutral}`}>
    {children}
  </span>
);

/** Source attribution chip — required on every data block. */
export const Cite = ({ source }: { source?: string }) =>
  source
    ? <span className="tnum ml-1 text-[11px] text-muted">· {source}</span>
    : <span className="ml-1 text-[11px] text-neg" title="No source attached">· no source</span>;

/* ---------- states ---------- */
export const Spinner = ({ label }: { label?: string }) => (
  <div className="flex items-center justify-center gap-3 py-8 text-sm text-muted" role="status">
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" />
    {label}
  </div>
);

export const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded bg-surface-2 ${className}`} />
);

export const ErrorBanner = ({ message }: { message: string }) => (
  <div role="alert" className="rounded-lg border border-neg/40 bg-surface px-4 py-3 text-sm" style={{ color: "var(--neg)" }}>
    {message}
  </div>
);

export const Empty = ({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) => (
  <div className="rounded-lg border border-dashed border-border-strong py-12 text-center">
    <p className="font-medium text-text-2">{title}</p>
    {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);

/* ---------- form field (label above, error below, wired with aria-describedby) ---------- */
type FieldBase = { label: string; error?: string; hint?: string };
export function Field({ label, error, hint, ...rest }: FieldBase & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-text-2">{label}</label>
      <input id={id} className="input" aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...rest} />
      {error
        ? <p id={`${id}-err`} className="text-xs" style={{ color: "var(--neg)" }}>{error}</p>
        : hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
export function TextField({ label, ...rest }: { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-text-2">{label}</label>
      <textarea id={id} className="input" {...rest} />
    </div>
  );
}

/* ---------- toast (undo beats confirm dialogs for reversible actions) ---------- */
type Toast = { id: number; msg: string; onUndo?: () => void };
const ToastCtx = createContext<(msg: string, onUndo?: () => void) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
let _tid = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((msg: string, onUndo?: () => void) => {
    const id = _tid++;
    setToasts((t) => [...t, { id, msg, onUndo }]);
    setTimeout(() => dismiss(id), 5000);
  }, [dismiss]);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 left-1/2 z-toast flex -translate-x-1/2 flex-col gap-2" role="region" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} className="animate-in flex items-center gap-4 rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm shadow-card">
            <span className="text-text">{t.msg}</span>
            {t.onUndo && (
              <button onClick={() => { t.onUndo!(); dismiss(t.id); }} className="font-medium text-accent hover:text-accent-2">Undo</button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
