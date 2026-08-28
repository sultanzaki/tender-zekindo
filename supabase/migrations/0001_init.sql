-- Zekindo Tender Management — schema for the `tenders` table.
--
-- No end-user auth exists in this app yet (internal tool, ~5-10 users), so
-- RLS is enabled with *no* policies: only a service-role key (used
-- server-side by the Next.js app, see src/lib/supabase-server.ts) can read
-- or write this table. Add policies here if/when a client-side or
-- authenticated access path is introduced.

create table if not exists public.tenders (
  id text primary key,
  row_no integer not null,
  period text not null,
  area text not null,
  tender_no text,
  customer text not null,
  product text,
  entitas text,
  qty numeric,
  oe numeric,
  idr_per_l numeric,
  milestones jsonb not null default '{}'::jsonb,
  result text check (
    result is null or result in (
      'WIN',
      'LOSS PRICE',
      'LOSS TECHNICAL',
      'LOSS TECHNICAL (BOTTLE TEST)',
      'LOSS TECHNICAL (FIELD TRIAL)',
      'LOSS PQ ADMIN',
      'LOSS REGIST',
      'WITHDRAW',
      'CANCELED',
      'RETENDER',
      'NO INFO'
    )
  ),
  carry_over text,
  remarks text,
  nilai_penawaran numeric,
  created_at timestamptz not null default now()
);

create index if not exists tenders_period_idx on public.tenders (period);
create index if not exists tenders_area_idx on public.tenders (area);
create index if not exists tenders_customer_idx on public.tenders (customer);
create index if not exists tenders_entitas_idx on public.tenders (entitas);
create index if not exists tenders_result_idx on public.tenders (result);

alter table public.tenders enable row level security;

-- New rows (added via the "Tender Baru" form) get row_no/id assigned here,
-- atomically, so the app never has to compute "next id" itself. Seeded rows
-- pass row_no/id explicitly (see seed.sql), which this trigger leaves alone;
-- seed.sql advances the sequence past the seeded rows afterwards.
create sequence if not exists public.tenders_row_no_seq;

create or replace function public.set_tender_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.row_no is null then
    new.row_no := nextval('public.tenders_row_no_seq');
  end if;
  if new.id is null then
    new.id := 'T' || lpad(new.row_no::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists tenders_set_defaults on public.tenders;
create trigger tenders_set_defaults
  before insert on public.tenders
  for each row execute function public.set_tender_defaults();
