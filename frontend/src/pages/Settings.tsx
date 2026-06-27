import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { Panel, PanelHeader, Icon, Badge, useToast } from "../components/ui";

function CopyRow({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value);
    setCopied(true); toast(`${label} copied`);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <code className="tnum truncate text-xs text-text-2">{value}</code>
        <button onClick={copy} aria-label={`Copy ${label}`}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition ease-terminal hover:bg-surface-2 hover:text-text">
          <Icon name={copied ? "check" : "copy"} size={13} className={copied ? "text-pos" : ""} />
        </button>
      </div>
    </div>
  );
}

export default function Settings() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  const ThemeOption = ({ value, label, icon }: { value: "dark" | "light"; label: string; icon: "moon" | "sun" }) => (
    <button onClick={() => { if (theme !== value) toggle(); }}
      aria-pressed={theme === value}
      className={`flex flex-1 items-center justify-center gap-2 rounded-md border py-2 text-sm font-medium transition ease-terminal ${
        theme === value ? "border-accent bg-surface-2 text-text" : "border-border text-text-2 hover:bg-surface-2"
      }`}>
      <Icon name={icon} size={15} className={theme === value ? "text-accent" : "text-muted"} /> {label}
    </button>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">Appearance, account, and session.</p>
      </div>

      <Panel>
        <PanelHeader code="VIEW" title="Appearance" />
        <div className="space-y-4 p-4">
          <div>
            <p className="mb-2 text-sm font-medium text-text-2">Theme</p>
            <div className="flex gap-2">
              <ThemeOption value="dark" label="Dark" icon="moon" />
              <ThemeOption value="light" label="Light" icon="sun" />
            </div>
          </div>
          <p className="text-xs text-muted">
            Animations (ticker tape, price flashes) follow your system’s “reduce motion” setting automatically.
          </p>
        </div>
      </Panel>

      <Panel>
        <PanelHeader code="ACCT" title="Account" right={<Badge tone="accent">{user?.role}</Badge>} />
        <div className="divide-y divide-border">
          <CopyRow label="User ID" value={user?.user_id ?? "—"} />
          <CopyRow label="Organization ID" value={user?.org_id ?? "—"} />
          {user?.role === "admin" && (
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-muted">Team management</span>
              <Link to="/members" className="text-accent transition hover:text-accent-2">Manage members →</Link>
            </div>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader code="SESS" title="Session" />
        <div className="flex items-center justify-between p-4">
          <p className="text-sm text-muted">Sign out of this workspace on this device.</p>
          <button onClick={logout} className="btn-ghost"><Icon name="logout" size={14} /> Sign out</button>
        </div>
      </Panel>
    </div>
  );
}
