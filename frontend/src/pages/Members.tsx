import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Card, ErrorBanner, Spinner, Badge } from "../components/ui";

// Admin-only: shows invite code (for onboarding analysts) + org members.
export default function Members() {
  const [members, setMembers] = useState<any[] | null>(null);
  const [invite, setInvite] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api<any[]>("/orgs/members").then(setMembers).catch((e) => setErr(e.message));
    api("/orgs/invite").then(setInvite).catch(() => {});
  }, []);

  if (err) return <ErrorBanner message={err} />;
  if (!members) return <Spinner />;

  return (
    <div className="space-y-4">
      {invite && (
        <Card>
          <p className="text-sm text-slate-500">Invite analysts to <b>{invite.org_name}</b> with this code:</p>
          <code className="mt-1 inline-block rounded bg-slate-100 px-3 py-1 font-mono">{invite.invite_code}</code>
        </Card>
      )}
      <Card>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Team members</h3>
        <ul className="divide-y text-sm">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2">
              <span>{m.email}</span><Badge>{m.role}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
