-- Phase 1: authentication/roles, audit trail, archive, missing source
-- columns, admin-extendable Area options, and basic error logging.
--
-- Auth model: admin-invited users only (no public signup — disable "Allow
-- new users to sign up" in Supabase Dashboard → Authentication → Settings).
-- Two roles: viewer (read-only) and admin (full read/write + user
-- management). All access still goes through the service-role client on the
-- server (see src/lib/supabase-server.ts) — RLS stays enabled with no
-- policies on every table here, exactly like `tenders` in 0001_init.sql.
-- The Next.js app itself is the authorization boundary (checked via
-- src/lib/auth/dal.ts), not Postgres RLS policies keyed to auth.uid().

create type public.user_role as enum ('viewer', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null,
  role public.user_role not null default 'viewer',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Populates `profiles` automatically when an admin invites a user (see
-- inviteUserByEmail in src/lib/auth/actions.ts, which sets these via
-- options.data). Runs as the table owner so it can insert despite RLS.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'viewer')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ── Tenders: new columns ────────────────────────────────────────────────
-- oe_catatan / remark / catatan_internal / pnl map 1:1 onto the source
-- workbook's "OE Catatan", "Remark", "Catatan Internal" and "P&L" columns
-- (see chats/chat1.md follow-up). "Checklist Document" is deliberately NOT
-- migrated as a flat boolean — it's superseded by the document_types /
-- tender_documents tables added in the Phase 3 migration.
alter table public.tenders
  add column oe_catatan text,
  add column remark text,
  add column pnl boolean not null default false,
  add column catatan_internal text,
  add column archived_at timestamptz,
  add column created_by uuid references public.profiles (id) on delete set null,
  add column updated_by uuid references public.profiles (id) on delete set null,
  add column updated_at timestamptz not null default now();

create index tenders_archived_at_idx on public.tenders (archived_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tenders_set_updated_at
  before update on public.tenders
  for each row execute function public.set_updated_at();

-- ── Audit trail ──────────────────────────────────────────────────────────
create table public.tender_events (
  id uuid primary key default gen_random_uuid(),
  tender_id text references public.tenders (id) on delete set null,
  tender_label text not null, -- snapshot (tender_no or product) so history reads fine after a hard delete
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name text not null,
  action text not null check (action in ('create', 'update', 'archive', 'restore', 'delete')),
  changes jsonb,
  created_at timestamptz not null default now()
);

create index tender_events_tender_idx on public.tender_events (tender_id);
create index tender_events_created_idx on public.tender_events (created_at desc);

alter table public.tender_events enable row level security;

-- ── Admin-extendable dropdown options (starting with Area) ──────────────
create table public.select_options (
  id uuid primary key default gen_random_uuid(),
  field text not null,
  value text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (field, value)
);

alter table public.select_options enable row level security;

-- Not seeded here: at migration time `tenders` may still be empty (seed.sql
-- runs separately, after migrations). See the bottom of seed.sql, which
-- populates select_options('area', ...) once tender rows actually exist.

-- ── Basic error logging ───────────────────────────────────────────────────
create table public.error_log (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  stack text,
  path text,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index error_log_created_idx on public.error_log (created_at desc);

alter table public.error_log enable row level security;
