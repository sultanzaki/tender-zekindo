# Access control review — 23 October 2026

The entire workspace requires a valid application session. This policy supersedes
earlier public browsing, public Excel export and guest monetary masking.

## Changes

- Only `/login`, the logo/favicon and Next.js technical assets are public.
  Overview, analytics, deadlines, tender lists/details, files and Excel exports
  validate the database-backed session before reading business data.
- The proxy redirects missing-cookie requests and overwrites the workspace-path
  header. Cookie presence is never trusted as authentication: pages, data entry
  points, downloads and Server Actions enforce `requireUser`/`requireAdmin`.
  Checks run outside shared caches; cache keys also separate Supabase projects.
- Unknown roles, malformed tokens, invalid expiry timestamps, expired/revoked
  sessions and deleted profiles are rejected. Sessions store SHA-256 token hashes;
  production cookies are HttpOnly, Secure and SameSite=Lax. Failed session
  revocation is surfaced, including during administrator password resets.
- Viewers can read active tender data and amounts. Administration, mutations,
  archives, internal notes and activity history remain administrator-only.
  Viewer tender DTOs remove internal notes before serialization.
- Files now download through `/tenders/:id/download`, which checks the session,
  tender visibility and the file/checklist record's ownership. It streams private
  storage bytes instead of redirecting to a bearer signed URL. Attachments use
  sanitized filenames, `application/octet-stream` and `nosniff`.
- Business responses and downloads use `private, no-store`. Frame embedding is
  denied; referrers are suppressed; object embedding and base-URL overrides are
  restricted. The Next.js branding header is disabled. Server Action bodies are
  limited to 6 MB; the main explorer uploads file bytes directly to private storage.
- Login uses generic errors and bcrypt work for unknown accounts, input-length
  limits and a bounded per-process throttle (10 attempts/email/15 minutes).
  Client error logging now requires login and bounds its stored input lengths.

## Dependencies

The initial production audit reported six affected packages, including critical
Next.js advisories. Next.js and its ESLint configuration were updated from 16.3.3
to 16.4.2; affected compatible transitive dependencies were updated. ExcelJS stays
at 4.4.0 with its UUID dependency overridden to 11.1.1; real workbook tests verify
compatibility instead of applying the audit tool's suggested ExcelJS downgrade.

`npm audit --omit=dev` reports **0 known production vulnerabilities**. The full
audit still reports five high-severity dependency entries arising from one
upstream `braces <=3.0.3` advisory in the ESLint glob dependency chain. The registry
currently provides no patched `braces` release. This development-only chain is
not in the production runtime and processes repository-controlled lint patterns.
It remains an upstream follow-up; do not downgrade Next's lint configuration to
the unrelated older major suggested by the audit tool.

## Verification

Final results: **48 unit/server/auth/Excel tests, 22 UI tests and 11 production
security integration tests passed (81 total)**. The build, TypeScript, ESLint and
whitespace checks passed. The hosted-project smoke blocked all 84 unauthorized
attempts, checked four login viewports and recorded zero JavaScript errors.

- `npm test`: business/server-action, read-model, Excel and authentication tests.
  Includes rejection before business queries, authorization before shared-cache
  reads, role separation, malformed expiry handling and revocation failures.
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:ui`: component/browser regressions.
  The defensive money-mask component tests do not imply that guest pages exist.
- After `npm run build`, `CHROMIUM_PATH=/usr/bin/chromium npm run test:security`
  runs the actual production server against loopback-only Supabase fixtures.
  It checks anonymous/invalid/expired/revoked sessions across 17 routes, GET/HEAD/
  RSC requests, spoofed headers, viewer/admin separation, archived records,
  workbook privacy, scoped file access, all 30 exposed administrator Server
  Actions, cross-origin action rejection, real login/logout, production cookie
  flags, safe return paths and revocation while the browser remains open.
- The read-only live smoke checks the running hosted-project build, without real
  logins or mutations: 84 access attempts across 14 routes and three cookie states,
  four login-page viewports and response security headers.
- A read-only hosted Supabase check confirmed the document bucket is private.
  REST access without an API key returned 401; public and unauthenticated storage
  access to an existing object returned 400 without returning its bytes.
- Production build/TypeScript, ESLint and whitespace checks are required gates.

Next.js can emit an HTTP 200 shell followed by a streamed login redirect. Tests
accept this only when an explicit redirect is present and business payloads are
absent; separate assertions verify that rejected requests never query business
tables. Real-browser tests confirm that these responses arrive at login.

## Scope and remaining limits

No live accounts, passwords, records, policies or storage objects were changed.
Authenticated writes and login/logout tests use isolated fixtures. Hosted database
RLS definitions were reviewed in migrations; direct SQL inspection of the live
policies was unavailable with the current connection credentials.

The local login throttle is a backstop, not a distributed rate limiter. Configure
an edge/WAF or shared-store login limit for multi-instance hosting and retain HTTPS.
The CSP added here controls frames/objects/base URLs; it is not a full nonce-based
script policy. This review does not constitute a comprehensive penetration test.

Previously issued signed download URLs retain their original expiry (at most five
minutes after issuance). New document reads issue no signed download URLs. Files
already downloaded or data copied by an authorized user cannot be revoked by an
application update. The repository also contains seed/design tender data; its
GitHub access policy is separate from website authentication.

These source changes take effect when the new build is deployed. A Git push and
local production verification do not establish that an external deployment is active.
