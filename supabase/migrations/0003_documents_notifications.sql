-- Phase 3: admin-manageable document checklist + file attachments per
-- tender. There is no schema change needed for the Notifications page —
-- it's a live view computed from existing `tenders` data (see
-- src/app/notifications/page.tsx), not a stored inbox.

create table public.document_types (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  is_default boolean not null default false,
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.document_types enable row level security;

insert into public.document_types (label, is_default) values
  ('PQ Document', true),
  ('Jaminan (Bid Bond / Performance Bond)', true),
  ('Company Profile / Legalitas', true),
  ('Technical Proposal', true);

create table public.tender_documents (
  id uuid primary key default gen_random_uuid(),
  tender_id text not null references public.tenders (id) on delete cascade,
  document_type_id uuid not null references public.document_types (id) on delete cascade,
  checked boolean not null default false,
  file_path text,
  file_name text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  unique (tender_id, document_type_id)
);

create index tender_documents_tender_idx on public.tender_documents (tender_id);

alter table public.tender_documents enable row level security;

-- Private bucket for attached documents. Like every table above, only the
-- service-role client (server-side) can read/write it — see
-- src/lib/documents.ts. Safe to re-run: `on conflict do nothing`.
insert into storage.buckets (id, name, public)
values ('tender-documents', 'tender-documents', false)
on conflict (id) do nothing;
