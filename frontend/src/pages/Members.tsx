import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Panel, SectionLabel, ErrorBanner, Spinner, Badge, Icon, useToast } from "../components/ui";

// Admin-only: shows invite code (for onboarding analysts) + org members.
export default function Members() {
  const [members, setMembers] = useState<any[] | null>(null);
  const [invite, setInvite] = useState<any>(null);
  const [err, setErr] = useState("");
  const toast = useToast();

  useEffect(() => {
    api<any[]>("/orgs/members").then(setMembers).catch((e) => setErr(e.message));
    api("/orgs/invite").then(setInvite).catch(() => {});
  }, []);

  if (err) return <ErrorBanner message={err} />;
  if (!members) return <Spinner />;

  const copy = () => { navigator.clipboard?.writeText(invite.invite_code); toast("Invite code copied"); };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="mt-1 text-sm text-muted">Manage who has access to your workspace.</p>
      </div>

      {invite && (
        <Panel className="p-5">
          <SectionLabel>Invite analysts</SectionLabel>
          <p className="mt-2 text-sm text-text-2">Share this code to invite analysts to <span className="font-medium text-text">{invite.org_name}</span>.</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="tnum flex-1 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">{invite.invite_code}</code>
            <button onClick={copy} className="btn-ghost"><Icon name="plus" size={14} /> Copy</button>
          </div>
        </Panel>
      )}

      <Panel className="p-5">
        <SectionLabel>Members</SectionLabel>
        <ul className="mt-3 divide-y divide-border text-sm">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2.5 first:pt-0">
              <span className="text-text-2">{m.email}</span>
              <Badge tone={m.role === "admin" ? "accent" : "neutral"}>{m.role}</Badge>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
