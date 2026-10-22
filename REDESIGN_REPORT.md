# Tender workspace redesign

Implemented the plan in [REDESIGN_PLAN.md](REDESIGN_PLAN.md). The visual identity
remains Zekindo blue/white with Poppins; navigation and information architecture
have been rebuilt around daily tender work.

## Delivered workflows

- Desktop sidebar, contextual workspace header/search, and mobile bottom
  navigation replace the old navbar/hamburger. Account and administrator actions
  use keyboard-accessible dialogs. Workspace search spans both business tracks.
- An operational Overview prioritizes upcoming milestones, follow-up work,
  recent updates, active opportunities and known pipeline coverage. Its links
  retain the selected track. It does not import the chart library.
- Analytics has its own public route, track/area/period/customer filters, customer
  performance, exact outcome data, sample sizes and known-value coverage.
  RETENDER/NO INFO are no longer counted as losses. Track pipeline includes only
  active tenders and win-rate denominators are consistent. Loss-share charts
  retain precision, avoiding rounded stacks above/below 100%.
- The tender workspace supports both tracks together, URL-based filters, saved
  browser views, remembered columns, quick status filters, customer/entity search,
  readable mobile cards, contextual detail links and predictable pagination.
  Bulk actions start with reversible archive; permanent deletion requires archive
  and typed confirmation. Result is placed next to the package for quicker scanning.
- Excel export remains available without login and respects filters/track.
  Headers are formatted, filters enabled, and identifier/header rows frozen.
  Internal notes remain administrator-only; responses cannot be shared-cached.
  Download links use native anchors so Next.js never prefetches an Excel file.
- Tender detail separates Overview, Documents and administrator Activity.
  Notes no longer reserve large empty panels. Documents load only when requested;
  historical file sections remain reachable after milestones leave the schedule.
- Deadlines provides urgency, week, fortnight and follow-up views, search and
  track filters, scoped counts and an all-day calendar export. Calendar output
  escapes text and folds long UTF-8 lines without splitting characters.
- New tender creation has four stages including review. Editing groups identity,
  value, schedule and outcome into sections, saving schedule order with other
  fields. Unsaved entries are guarded on reload and in-app link navigation;
  custom steps survive moving between form sections.
- Documents have searchable sections, native expandable folders, explicit create/
  rename/delete dialogs, upload progress/timeouts, file-size checks, retryable
  failures and link refresh. Failed-batch cleanup preserves registered files even
  if the registration response was lost. Legacy checklist attachments remain
  accessible. Signed URLs are requested in batches.
- Account administration uses native validation, masked password reset dialogs,
  reliable server-confirmed lists, search, pending states and inline feedback.
  Users cannot remove themselves or change their own administrator role.
- Independent milestone catalogs have track selection and consistent controls.
  Reordering writes both positions in one atomic database statement. An explicit
  empty schedule stays empty instead of silently restoring the defaults.
- Login preserves entries after failure, supports password visibility and safe
  return URLs. Skeleton loading, not-found states, focus indicators, reduced
  motion, muted text contrast and narrow layouts have been improved.

## Data and performance corrections

Canonical decimal amounts are preserved at the server, invalid dates/numbers are
rejected, and deadline calculations use Asia/Jakarta with UTC date arithmetic.
Legacy text IDs such as T0001 remain supported. Cached reads page through the
provider's 1000-row response limit instead of truncating the dataset. Public table
payloads omit internal notes and unused long remarks. Document queries and signed
URLs are deferred/batched; chart animations are disabled. No runtime dependencies
or schema migrations were added.

## Verification

| Check                                             | Result                                                                                                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                                        | 38 tests passed: calculations, dates, validation, real server-action code with isolated persistence, text IDs, pagination and Excel contents                    |
| `CHROMIUM_PATH=/usr/bin/chromium npm run test:ui` | 20 tests passed: navigation, forms/review, unsaved changes, saved views, mobile cards, users, archive, milestones, upload success/failure and calendar download |
| Responsive component checks                       | Nine key screens at 320, 768 and 1440 px, without document-level horizontal overflow                                                                            |
| Production read-only smoke                        | 28 rendered views: six public routes at 375/768/1024/1440 px plus legacy tender Overview/Documents at desktop/phone sizes                                       |
| Access checks                                     | Five protected routes redirect to login; a forged session cookie cannot bypass server authorization; guest activity history is hidden                           |
| Live anonymous exports                            | Valid workbooks containing 212 upstream, 26 downstream and 238 combined records; filtered customer export works; internal notes omitted                         |
| Browser errors / automatic downloads              | Zero JavaScript errors and zero automatic Excel requests during navigation                                                                                      |
| Production build / TypeScript                     | Passed with Next.js 16.3.3 on Node 24.19.0                                                                                                                      |
| ESLint / whitespace                               | Passed without warnings or whitespace errors                                                                                                                    |

The final production smoke run measured cached local responses at 8–12 ms TTFB and
39–42 ms DOMContentLoaded for Overview/Analytics. These measurements cover the
local server and warm caches; deployed network performance depends on hosting.

Run the read-only smoke checks against a running production build with:

```bash
CHROMIUM_PATH=/usr/bin/chromium \
SMOKE_BASE_URL=http://localhost:3002 node tests/live-smoke.mjs
```

## Validation limits

Connected-project checks were read-only: no business records, users, passwords or
storage objects were changed. Administrative writes and real action logic were
verified with fixtures, rather than modifying the live project. Authenticated
end-to-end writes against a dedicated development project and manual Safari/
Firefox/screen-reader checks remain release follow-ups. Source push and local
production verification do not establish that an external deployment completed.
