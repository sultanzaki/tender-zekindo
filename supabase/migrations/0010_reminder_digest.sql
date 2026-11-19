-- One immutable email digest per Jakarta calendar day; server-only access.
create table public.reminder_digest (
  day date primary key,
  payload jsonb not null,
  sent_at timestamptz,
  provider_id text
);
alter table public.reminder_digest enable row level security;
revoke all on public.reminder_digest from anon, authenticated;
grant select, insert, update on public.reminder_digest to service_role;
