# Zekindo Tender Management

Next.js (App Router) + Supabase implementation of the tender monitoring tool
for PT Zeus Kimiatama Indonesia's internal tender team, built from the
Claude Design handoff bundle described below (`project/`, `chats/`).

## Running the app

```bash
npm install
cp .env.example .env.local   # fill in every value — see below
```

Then, against a Supabase project (local via `supabase start` or hosted):

```bash
supabase db push          # applies supabase/migrations/*.sql, in order
psql "$DATABASE_URL" -f supabase/seed.sql   # or: supabase db reset (applies seed.sql automatically)
npm run dev
```

`supabase/seed.sql` is generated from the 270 tenders extracted from the
source Excel during the design phase (`project/tenders-data.js`). Regenerate
it with `node scripts/generate-seed-sql.mjs` if that source data changes.

### Authentication

This app does **not** use Supabase Auth — it has its own email+password
auth (`src/lib/auth/`), because it already keeps its own `profiles` table
and admin UI, so Supabase Auth would only have been doing password storage,
sessions, and invite emails. Rolling that in-house means **zero Supabase
Dashboard setup** — no email templates, no redirect URLs, no toggling
public signup.

How it works:

- **Passwords**: bcrypt-hashed in `profiles.password_hash`
  (`src/lib/auth/actions.ts`). There's no public signup and no self-service
  "forgot password" email — an **admin sets a new user's initial password
  directly** from `/admin/users`, and resets a forgotten one the same way
  (`resetUserPassword` also revokes that user's existing sessions).
- **Sessions**: a random 32-byte token in an httpOnly, `SameSite=Lax` cookie;
  only its SHA-256 hash is stored server-side, in the `sessions` table
  (`src/lib/auth/session.ts`). Sessions last 30 days and aren't refreshed on
  activity — signing in again after that is expected, not a bug.
- **Route protection**: `src/proxy.ts` (Next.js 16's renamed middleware —
  must live next to `src/app`, not the repo root, or Next silently never
  runs it) does a cheap, cookie-presence-only redirect to `/login`; it's
  deliberately one-directional (never bounces a cookied visitor away from
  `/login`, since cookie presence isn't proof the session is still valid —
  `/login`'s own real check handles that instead, see
  `src/app/login/page.tsx`). The real check — looking the session up,
  loading the profile, checking the role — happens in
  `requireUser()`/`requireAdmin()` (`src/lib/auth/dal.ts`), called at the
  top of every protected page and Server Action. That's the actual security
  boundary, not the proxy.

**Creating the first admin** (there's no bootstrapping problem here, unlike
with Supabase Auth's invite-only flow — just insert the row directly):

```bash
node --env-file=.env.local scripts/create-admin.mjs "Your Name" you@zekindo.co.id "a-strong-password"
```

After that, create/manage every other user from `/admin/users` in the app
itself — no email, no Dashboard, no chicken-and-egg problem.

All data access — tenders, profiles, sessions, everything — uses the
**service role key** server-side only (`src/lib/supabase-server.ts`); this
app has no client-side Supabase usage and no anon key at all. Every table
has RLS enabled with no policies, so nothing is reachable except through
this one server-only key; the Next.js app itself (via `src/lib/auth/dal.ts`)
is the authorization boundary, not Postgres RLS.

### What's tracked, and what isn't

- **Audit trail**: every tender create/update/archive/restore/delete is
  logged to `tender_events` (who, when, and a field-level diff on updates).
  There's no UI to browse it yet — query the table directly for now.
- **Archive, not delete-by-default**: the "Archive Tender" button soft-deletes
  (sets `archived_at`); archived tenders are hidden from the dashboard/table
  and live at `/tenders/archive` (admin-only), where they can be restored or
  permanently deleted (only once archived — a safety net against a
  fat-fingered delete).
- **Area is admin-extendable**: picking "+ Add new area..." in the Area
  dropdown (New/Edit Tender) adds it to `select_options` immediately, no
  redeploy needed. `Result` deliberately stayed a fixed list — the
  dashboard's win-rate/loss-breakdown logic pattern-matches on those exact
  strings.
- **Basic error monitoring**: uncaught errors are logged to the `error_log`
  table (via `src/app/error.tsx` / `global-error.tsx`) — no external service
  (Sentry, etc.) wired up.
- **Document checklist & attachments**: each tender has a checklist of
  document types (4 defaults seeded by migration — PQ Document, Jaminan,
  Company Profile/Legalitas, Technical Proposal — plus admin-addable custom
  types) with optional file upload per item, stored in the private
  `tender-documents` Storage bucket (created by
  `supabase/migrations/0003_documents_notifications.sql`, no manual Dashboard
  step needed). Files are only ever reached through the service-role client
  (short-lived signed URLs for viewing), same authorization model as the rest
  of the app.
- **Notifications page** (`/notifications`, linked from the bell icon in the
  top nav): "Due Soon" (milestones within 14 days, no result yet) and
  "Awaiting Result — No Upcoming Milestone" (active tenders with nothing left
  scheduled — capped to the 20 most recently active in the UI, since old
  never-closed-out tenders from the source data can otherwise flood the
  list). It's a live view recomputed on load, not a stored/dismissable inbox.
- **Analytics dashboard** (`/analytics`): win-rate trend, outcome volume, and
  loss-reason mix by period, plus win-rate and pipeline-value (sum of OE for
  running tenders) breakdowns by area/entity. Built with
  [Recharts](https://recharts.org/); win-rate-by-group bars drop any group
  with fewer than 3 decided tenders and always label both the rate and the
  sample size (`62% (n=13)`) so a thin bar never gets read as a strong
  signal.

The layout is responsive (desktop, tablet, and mobile) — added after the
original desktop-1440-only design; the dense tender table intentionally
scrolls horizontally on narrow screens rather than becoming a card list, and
the top nav's tab strip scrolls horizontally on the narrowest phones rather
than wrapping/overlapping.

---

# CODING AGENTS: READ THIS FIRST

This is a **handoff bundle** from Claude Design (claude.ai/design).

A user mocked up designs in HTML/CSS/JS using an AI design tool, then exported this bundle so a coding agent can implement the designs for real.

## What you should do — IMPORTANT

**Read the chat transcripts first.** There are 1 chat transcript(s) in `chats/`. The transcripts show the full back-and-forth between the user and the design assistant — they tell you **what the user actually wants** and **where they landed** after iterating. Don't skip them. The final HTML files are the output, but the chat is where the intent lives.

**Read `project/Tender Management.dc.html` in full.** The user had this file open when they triggered the handoff, so it's almost certainly the primary design they want built. Read it top to bottom — don't skim. Then **follow its imports**: open every file it pulls in (shared components, CSS, scripts) so you understand how the pieces fit together before you start implementing.

**If anything is ambiguous, ask the user to confirm before you start implementing.** It's much cheaper to clarify scope up front than to build the wrong thing.

## About the design files

The design medium is **HTML/CSS/JS** — these are prototypes, not production code. Your job is to **recreate them pixel-perfectly** in whatever technology makes sense for the target codebase (React, Vue, native, whatever fits). Match the visual output; don't copy the prototype's internal structure unless it happens to fit.

**Don't render these files in a browser or take screenshots unless the user asks you to.** Everything you need — dimensions, colors, layout rules — is spelled out in the source. Read the HTML and CSS directly; a screenshot won't tell you anything they don't.

## Bundle contents

- `README.md` — this file
- `chats/` — conversation transcripts (read these!)
- `project/` — the `Zekindo Tender Management App` project files (HTML prototypes, assets, components)
