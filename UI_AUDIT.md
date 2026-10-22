# UI/UX audit

Historical audit preceding the workspace redesign. See [REDESIGN_REPORT.md](REDESIGN_REPORT.md) for the current implementation and validation.

Reviewed navigation, analytics, upstream/downstream tender tables, tender details,
create/edit forms, notifications, user administration, milestone administration,
and document controls. Existing visual styling and business terminology are retained.

## Fixes

- Mobile navigation now includes user administration and sign-out. Escape closes
  the menu and restores focus; outside clicks dismiss it. Creating a downstream
  tender from the mobile menu preserves its track.
- Table filters return to page one and clear selection so hidden rows are not
  inadvertently included in bulk actions. Pagination uses the displayed page.
  Switching tracks remounts table state.
- Sorting, tender links, result editing, and milestone editing are keyboard
  accessible. Filters have accessible names and sorting exposes its direction.
- Bulk failures display alert feedback rather than the green success message.
- Required area/customer selections are validated before advancing the creation
  wizard. Milestone date warnings follow the tender's selected milestone order.
- Numeric fields preserve decimal fractions and display grouping without losing
  precision through Number conversion.
- User creation refreshes the list. Failed removal/role updates retain the
  server-confirmed user list. Pending actions disable conflicting controls.
  The creation form uses native email validation and supports Enter submission.
- Adding a folder expands its section. Preparation/finalization failures restore
  upload controls; uploads have a timeout. Checklist uploads can retry the same
  file. Document controls and progress expose accessible labels/state.
- Keyboard focus is visible across controls, muted text contrast is increased,
  login supports password-manager autocomplete, and error messages no longer
  claim that logging succeeded. Error content fits narrow screens.
- Tender details return to the correct track. The tender table has a page heading.

## Verification

- Ten isolated Chromium interaction regressions: `npm run test:ui`.
- Live read-only browser checks: analytics, both tender tracks, notifications,
  and login at 1440, 768, and 375 pixels; sample tender detail at 1440 and 375.
  Pages rendered without application errors or document-level horizontal overflow.
  Wide tender tables retain their intended internal horizontal scroll.
- Production build (`NODE_USE_ENV_PROXY=1 npm run build`), TypeScript, and ESLint checks. The existing unused `ctx` warning in
  `src/lib/folder-actions.ts` remains.
- In this cloud environment, Node needs `NODE_USE_ENV_PROXY=1` to reach the
  configured Supabase project through its supplied proxy.

## Limits and follow-up

Administrative mutations use mock responses in regression tests. No live user,
tender, document, password, or database changes were made for this audit.
Authenticated login and actual storage uploads still need a dedicated development
account/project for end-to-end validation. Browser coverage is Chromium; manual
Safari, screen-reader, and real-device checks remain useful before release.
