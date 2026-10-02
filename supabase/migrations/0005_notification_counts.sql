-- Performance: compute the nav notification badge inside the database.
--
-- Before this, the root layout fetched EVERY tender (`select *`, ~270 rows
-- including the long `remarks` / `catatan_internal` free text) and then ran a
-- second query to resolve created_by/updated_by profile names — on every single
-- request — purely to count two numbers for the bell icon in the nav.
--
-- With the serverless functions in iad1 and the database in ap-southeast-1,
-- that was two cross-continent round trips per page view to render a badge.
--
-- This returns the same two numbers computeDeadlines() and computeStalled()
-- derive in src/lib/tender-logic.ts:
--   due_soon — active tenders whose next upcoming milestone is within 14 days
--   stalled  — active tenders with no upcoming milestone left at all
--
-- "Active" mirrors the TypeScript exactly: not archived, and no result yet.
--
-- The `~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'` guard matters: milestone values live in
-- a jsonb bag, and casting a malformed value to date would raise and take the
-- whole nav down. Anything not shaped like an ISO date is simply ignored, which
-- is also what the TypeScript does (`iso.split("-")` on a non-date yields NaN
-- tones rather than a crash).

create or replace function public.notification_counts()
returns table (due_soon integer, stalled integer)
language sql
stable
set search_path = public
as $$
  with active as (
    select t.id,
           (select min(m.value::date)
              from jsonb_each_text(t.milestones) as m(key, value)
             where m.value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
               and m.value::date >= current_date) as next_date
      from public.tenders t
     where t.archived_at is null
       and t.result is null
  )
  select
    count(*) filter (where next_date is not null and next_date <= current_date + 14)::int as due_soon,
    count(*) filter (where next_date is null)::int as stalled
  from active;
$$;

comment on function public.notification_counts() is
  'Nav badge counts (due soon / stalled) computed in the database — see src/lib/tenders.ts getNotificationCounts().';
