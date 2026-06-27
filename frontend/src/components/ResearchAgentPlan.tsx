import { useEffect, useRef, useState } from "react";
import { Icon } from "./ui";

export type StepStatus = "pending" | "running" | "done" | "error" | "skipped";
export type PreviewRow = { label?: string; value?: string; sub?: string };
export type AgentStep = {
  key: string;
  title: string;
  kind?: "route" | "tool" | "synth" | "review";
  /** short result line shown next to the title, e.g. "3 quotes" */
  summary?: string;
  /** a prominent inline line (the agent's stated reasoning, a skip reason) */
  note?: string;
  /** the model's thought summary (chain-of-thought), shown collapsibly */
  thinking?: string;
  /** the tool's actual results, rendered inline so the run is legible */
  preview?: PreviewRow[];
  /** extra rows behind a disclosure (inputs, raw detail, errors) */
  detail?: string[];
  status: StepStatus;
};

/** Status node on the timeline rail. */
function Node({ status }: { status: StepStatus }) {
  if (status === "running")
    return (
      <span className="agent-node grid h-5 w-5 place-items-center rounded-full">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
      </span>
    );
  if (status === "done")
    return (
      <span className="grid h-5 w-5 place-items-center rounded-full" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg>
      </span>
    );
  if (status === "error")
    return (
      <span className="grid h-5 w-5 place-items-center rounded-full text-xs font-bold" style={{ background: "color-mix(in oklch, var(--neg) 22%, transparent)", color: "var(--neg)" }}>!</span>
    );
  if (status === "skipped")
    return (
      <span className="grid h-5 w-5 place-items-center rounded-full border border-dashed border-border-strong text-muted">
        <svg width="9" height="9" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
      </span>
    );
  return <span className="grid h-5 w-5 place-items-center rounded-full"><span className="h-2 w-2 rounded-full bg-border-strong" /></span>;
}

/** The model's thought summary — streams live, collapsible, scroll-capped. */
function Thinking({ text, live }: { text: string; live?: boolean }) {
  const [open, setOpen] = useState(true);
  const ref = useRef<HTMLParagraphElement>(null);
  const clean = text.replace(/\*\*(.+?)\*\*/g, "$1").trim(); // drop markdown bold
  // follow the stream: keep the latest tokens in view while it's thinking
  useEffect(() => {
    if (open && live && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [clean, open, live]);
  return (
    <div className="mt-2 overflow-hidden rounded-md border border-border bg-surface-2">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left">
        <span className={`text-accent ${live ? "live-dot" : ""}`} aria-hidden="true">✦</span>
        <span className="text-xs font-medium text-text-2">{live ? "Thinking…" : "Thought process"}</span>
        <Icon name="arrow" size={11} className={`ml-auto text-muted transition-transform ease-terminal ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <p ref={ref} className="max-h-44 overflow-y-auto whitespace-pre-wrap border-t border-border px-3 py-2 text-xs leading-relaxed text-muted">
          {clean}
          {live && <span className="caret-blink ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 bg-accent align-baseline" />}
        </p>
      )}
    </div>
  );
}

/** Inline result rows for a tool step: label · value, with a supporting line. */
function Preview({ rows }: { rows: PreviewRow[] }) {
  if (!rows.length) return null;
  return (
    <ul className="mt-2 overflow-hidden rounded-md border border-border">
      {rows.map((r, i) => (
        <li key={i} className="flex items-center gap-3 border-b border-border/60 px-3 py-1.5 last:border-0">
          {r.label && <span className="tnum w-16 shrink-0 text-xs font-semibold text-text">{r.label}</span>}
          {r.value && <span className="tnum shrink-0 text-xs text-accent">{r.value}</span>}
          {r.sub && <span className="truncate text-xs text-muted">{r.sub}</span>}
        </li>
      ))}
    </ul>
  );
}

function Row({ step, last }: { step: AgentStep; last: boolean }) {
  const [open, setOpen] = useState(false);
  const hasDetail = !!step.detail?.length;
  const active = step.status === "running";
  const muted = step.status === "pending" || step.status === "skipped";
  return (
    <li className="animate-in relative pl-8">
      {!last && <span className="absolute left-[9px] top-6 bottom-[-16px] w-px" style={{ background: "var(--border)" }} aria-hidden="true" />}
      <span className="absolute left-0 top-0.5"><Node status={step.status} /></span>

      <div className="flex items-baseline gap-2">
        <span className={`text-sm font-medium ${active ? "text-accent" : step.status === "error" ? "text-neg" : muted ? "text-muted" : "text-text"}`}>
          {step.title}
        </span>
        {step.summary && <span className="tnum text-xs text-muted">· {step.summary}</span>}
        {step.status === "skipped" && <span className="text-xs text-muted">· not selected</span>}
        {hasDetail && (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
            className="ml-auto inline-flex items-center gap-1 text-xs text-muted transition hover:text-text-2">
            details <Icon name="arrow" size={11} className={`transition-transform ease-terminal ${open ? "rotate-90" : ""}`} />
          </button>
        )}
      </div>

      {step.note && (
        <p className="mt-1.5 max-w-[64ch] text-xs leading-relaxed text-text-2">{step.note}</p>
      )}
      {step.thinking && <Thinking text={step.thinking} live={step.status === "running"} />}
      {!!step.preview?.length && <Preview rows={step.preview} />}

      {hasDetail && open && (
        <ul className="animate-in mt-2 space-y-1 border-l border-border pl-3">
          {step.detail!.map((d, i) => (
            <li key={i} className="tnum text-xs leading-relaxed text-text-2">{d}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** Live trace of the agentic research run: routing, each tool call, synthesis. */
export default function ResearchAgentPlan({ steps, running }: { steps: AgentStep[]; running: boolean }) {
  if (!steps.length) return null;
  const tools = steps.filter((s) => s.kind === "tool");
  const chosen = tools.filter((s) => s.status !== "skipped");
  const ran = chosen.filter((s) => s.status === "done" || s.status === "error").length;

  return (
    <section className="rounded-lg border border-border bg-surface">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
        <span className="func-tag">AGENT</span>
        <h3 className="text-sm font-semibold text-text">Orchestration</h3>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <span className={`live-dot h-1.5 w-1.5 rounded-full ${running ? "" : "opacity-0"}`} style={{ background: "var(--accent)" }} />
          {running ? "working" : "complete"}
        </span>
        {tools.length > 0 && (
          <span className="tnum ml-auto text-xs text-muted">
            <span className="text-text-2">{chosen.length}</span>/{tools.length} tools engaged
            {chosen.length > 0 && <> · <span className="text-text-2">{ran}</span>/{chosen.length} returned</>}
          </span>
        )}
      </header>
      <ol className="space-y-4 p-5">
        {steps.map((s, i) => <Row key={s.key} step={s} last={i === steps.length - 1} />)}
      </ol>
    </section>
  );
}
