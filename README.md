# Zekindo Tender Management

Next.js (App Router) + Supabase implementation of the tender monitoring tool
for PT Zeus Kimiatama Indonesia's internal tender team, built from the
Claude Design handoff bundle described below (`project/`, `chats/`).

## Running the app

```bash
npm install
cp .env.example .env.local   # fill in SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
```

Then, against a Supabase project (local via `supabase start` or hosted):

```bash
supabase db push          # applies supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -f supabase/seed.sql   # or: supabase db reset (applies seed.sql automatically)
npm run dev
```

`supabase/seed.sql` is generated from the 270 tenders extracted from the
source Excel during the design phase (`project/tenders-data.js`). Regenerate
it with `node scripts/generate-seed-sql.mjs` if that source data changes.

There is no end-user auth: `SUPABASE_SERVICE_ROLE_KEY` is used server-side
only (see `src/lib/supabase-server.ts`), and the `tenders` table has RLS
enabled with no policies, so it isn't readable via the public anon key.

`/tenders/new` (multi-step) and `/tenders/[id]/edit` (single page) write to
Supabase via Server Actions in `src/lib/actions.ts`. New rows get their `id`
(`T0271`, ...) and `row_no` assigned by a Postgres trigger + sequence (see
`supabase/migrations/0001_init.sql`) so the app never computes "next id"
itself; `period` is auto-assigned to the most recent existing period since
there's no Period field in the form. Edit is a screen added beyond the
original design (only a read-only Detail view was specified) — it exposes
every mutable field, including `result`/`carry_over`/`remarks`, which the
new-tender form doesn't touch.

The layout is responsive (desktop, tablet, and mobile) — added after the
original desktop-1440-only design; the dense tender table intentionally
scrolls horizontally on narrow screens rather than becoming a card list.

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
