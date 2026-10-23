# UI regression checks

Run `npm ci`, `npx playwright install chromium`, then `npm run test:ui`.
For a system browser, use `CHROMIUM_PATH=/usr/bin/chromium npm run test:ui`.

The runner bundles real client components into a temporary local page. Chromium
exercises navigation, filters, saved views, forms/review, unsaved changes, access
management, archive confirmations, milestone catalogs, document upload success/
failure, calendar export, guest monetary masks versus signed-in viewer access,
and responsive layouts. Next.js navigation and server
actions are mocked; no connected application data is modified. The temporary
server, browser and generated bundles are removed after the run.

`npm test` separately checks calculations and actual server-action/read-model/
Excel code with isolated persistence. For read-only checks of a running app, use
`SMOKE_BASE_URL=http://localhost:3002 CHROMIUM_PATH=/usr/bin/chromium node tests/live-smoke.mjs`.
See [REDESIGN_REPORT.md](../../REDESIGN_REPORT.md) for verification and limits.

After `npm run build`, run `CHROMIUM_PATH=/usr/bin/chromium npm run test:security`
for production HTTP, real login/logout, role, Server Action, CSRF and download
checks. This starts a production Next.js server against loopback-only Supabase
fixtures, including fixture session writes. It never uses the hosted database.
`tests/live-smoke.mjs` now checks the closed access policy against a running app;
it no longer expects public tender pages or anonymous workbooks.
