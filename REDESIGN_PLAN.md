# Professional tender workspace redesign

Keep Zekindo's blue/white palette, Poppins typography, dense information, existing
upstream/downstream workflows, public reading/export, and admin-only mutations.

## Implementation plan

1. Replace the top navbar/hamburger with a responsive application shell: desktop
   sidebar, mobile bottom navigation, contextual header, accessible account actions.
2. Separate the daily operational overview from analytics. Show actionable deadline
   and follow-up lists, scope metrics, recent updates, and direct tender links.
3. Correct analytics classification and pipeline totals. Add customer analysis,
   known-value coverage, consistent filters, sample sizes, and data tables.
4. Rework tender exploration: URL filters, scoped saved views, status shortcuts,
   mobile cards, column preferences, predictable pagination and export.
5. Organize detail into overview/documents/activity, refresh create/edit form
   hierarchy, improve milestone controls, confirmations, archive/user workflows.
6. Fix confirmed backend defects (decimal parsing, dates, empty milestone orders,
   private fields in public client payloads), retain authorization and cached reads.
7. Verify calculation fixtures, export access/filters, browser interactions and
   responsive layouts, production build, lint/types; push tested changes to main.

## Validation boundaries

Live database checks are read-only. Administration, uploads and destructive actions
are exercised with isolated fixtures rather than mutating the connected project.
No schema changes, production seed/reset, or invented business data are required.
Record actual checks and remaining limitations in REDESIGN_REPORT.md before push.
