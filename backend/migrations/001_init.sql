-- Phase 1: core multi-tenant schema + RLS (defense-in-depth).
-- Backend uses the service key (bypasses RLS); isolation is ALSO enforced in
-- app code via org_id scoping. RLS here guards any anon/auth-key access path.

create extension if not exists vector;       

create table if not exists organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text not null unique,
  created_at  timestamptz not null default now()
);

-- users.id == Supabase auth.users.id
create table if not exists users (
  id         uuid primary key,
  org_id     uuid not null references organizations(id) on delete cascade,
  email      text not null,
  role       text not null default 'analyst' check (role in ('admin','analyst')),
  created_at timestamptz not null default now()
);
create index if not exists idx_users_org on users(org_id);

create table if not exists research_reports (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  query       text not null,
  result_json jsonb,
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists idx_reports_org on research_reports(org_id);
create index if not exists idx_reports_org_created on research_reports(org_id, created_at desc);
create index if not exists idx_reports_tags on research_reports using gin(tags);

create table if not exists watchlist (
  id      uuid primary key default gen_random_uuid(),
  org_id  uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  ticker  text not null,
  created_at timestamptz not null default now(),
  unique (org_id, user_id, ticker)
);
create index if not exists idx_watchlist_org on watchlist(org_id);

create table if not exists audit_logs (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  user_id    uuid,
  action     text not null,
  meta       jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_org on audit_logs(org_id, created_at desc);

-- RLS (defense-in-depth). Helper: an auth'd user's org_id.
alter table organizations    enable row level security;
alter table users            enable row level security;
alter table research_reports enable row level security;
alter table watchlist        enable row level security;
alter table audit_logs       enable row level security;

create or replace function current_org_id() returns uuid
  language sql stable as $$ select org_id from users where id = auth.uid() $$;

drop policy if exists tenant_users on users;
create policy tenant_users on users for all
  using (org_id = current_org_id());

drop policy if exists tenant_org on organizations;
create policy tenant_org on organizations for all
  using (id = current_org_id());

drop policy if exists tenant_reports on research_reports;
create policy tenant_reports on research_reports for all
  using (org_id = current_org_id());

drop policy if exists tenant_watchlist on watchlist;
create policy tenant_watchlist on watchlist for all
  using (org_id = current_org_id());

drop policy if exists tenant_audit on audit_logs;
create policy tenant_audit on audit_logs for all
  using (org_id = current_org_id());
