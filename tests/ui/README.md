# UI regression checks

Run `npm ci`, then `npx playwright install chromium` and `npm run test:ui`.
For a system browser, use `CHROMIUM_PATH=/usr/bin/chromium npm run test:ui`.

The runner bundles the real client components into a temporary local page and
uses Chromium to exercise them. Next.js navigation and server actions are mocked;
these tests never connect to Supabase or change application data. The temporary
server, browser, and generated bundle are removed after the run.

Coverage includes mobile admin navigation, keyboard sorting and quick edits,
filter/pagination/selection interactions, decimal precision, required wizard
fields, user-list refresh and failed mutations, collapsed document sections,
upload failure recovery, and bulk-action error feedback.

These checks complement live read-only browser checks. They do not validate
Supabase authorization, real uploads, login sessions, or database mutations.
