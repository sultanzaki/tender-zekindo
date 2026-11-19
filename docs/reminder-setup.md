# Resend reminder setup

Apply migration 0010 to a development database first. Configure the server variables in .env.example. Use a verified Resend sender, approved internal recipients (comma separated, max 50; To recipients can see each other), a random CRON_SECRET of at least 32 characters, and the HTTPS application URL. Never commit actual credentials.

Configure your hosting scheduler to POST /api/cron/reminders at 08:00 Asia/Jakarta (01:00 UTC), with Authorization: Bearer <CRON_SECRET>. For example, use a trusted scheduler that supports authenticated POST. No scheduler is installed by this change. No emails are sent until configured and invoked. Retry failures within the same Jakarta day; the frozen payload and Resend daily idempotency key handle concurrent calls and provider acceptance before DB acknowledgement. The daily digest is not reissued after successful sending, even if milestones change later that day. No catch-up for missed dates.

Includes every visible, non-archived milestone on active tenders due H-3, H-1 or H-0. No email if none. Email contains internal tender details, so restrict recipients. The digest table retains email contents; define and enforce a retention policy before production.

Test in staging: unauthorized POST returns 401, no deadlines returns no_deadlines, active matching dates produce one message, repeated POST returns already_sent, hidden/archived/finished tenders excluded, failed provider request returns 502. Test simultaneous requests and database failure after provider acceptance. Run npm test, npm run lint and npm run build before merging. Production verification is pending.
