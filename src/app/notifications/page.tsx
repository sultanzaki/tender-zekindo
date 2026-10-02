import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { getAllTenders } from "@/lib/tenders";
import { getMilestoneTypes } from "@/lib/milestones";
import { computeDeadlines, computeStalled, formatDateID, todayISO, REMINDER_DAYS } from "@/lib/tender-logic";
import shared from "@/components/shared.module.css";
import styles from "./notifications.module.css";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await requireUser();
  const [tenders, catalog] = await Promise.all([getAllTenders(), getMilestoneTypes()]);
  const anchor = todayISO();

  const deadlines = computeDeadlines(tenders, anchor, catalog);
  const stalledAll = computeStalled(tenders, anchor, catalog);
  const STALLED_LIMIT = 20;
  const stalled = stalledAll.slice(0, STALLED_LIMIT);

  // Split into two lists rather than one 14-day list, so a reminder can never
  // hide inside a longer list. Split, not repeated: the reminder rows are
  // excluded from the second list.
  const reminders = deadlines.filter((row) => row.days <= REMINDER_DAYS);
  const dueSoon = deadlines.filter((row) => row.days > REMINDER_DAYS);

  return (
    <div className={shared.pagePad} style={{ maxWidth: 1000, margin: "0 auto" }}>
      <h1 className={styles.pageTitle}>Notifications</h1>
      <p className={styles.pageSubtitle}>
        As of {formatDateID(anchor)}
        {reminders.length > 0 && (
          <>
            {" · "}
            <strong>
              {reminders.length} milestone{reminders.length === 1 ? "" : "s"} need attention within {REMINDER_DAYS} days
            </strong>
          </>
        )}
      </p>

      <div className={shared.card} style={{ marginBottom: 24, overflow: "hidden" }}>
        <div className={shared.cardHeader}>
          <h2 className={shared.cardTitle}>Reminder — within {REMINDER_DAYS} days</h2>
          <span className={shared.cardMeta}>Needs action now, not later</span>
        </div>
        {reminders.length > 0 ? (
          <div className={styles.list}>
            {reminders.map((row) => (
              <Link key={row.tenderId} href={`/tenders/${row.tenderId}`} className={styles.row}>
                <span className={`${shared.badge} ${shared.badgeError}`}>{row.daysLabel}</span>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{row.customer}</span>
                  <span className={styles.rowSub} title={row.product}>
                    {row.product}
                  </span>
                </span>
                <span className={styles.rowMeta}>
                  {row.milestoneLabel} &middot; {row.dateFormatted}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className={shared.emptyState}>Nothing due within the next {REMINDER_DAYS} days.</div>
        )}
      </div>

      <div className={shared.card} style={{ marginBottom: 24, overflow: "hidden" }}>
        <div className={shared.cardHeader}>
          <h2 className={shared.cardTitle}>Due Soon</h2>
          <span className={shared.cardMeta}>
            {REMINDER_DAYS + 1}–14 days out, no result yet — for planning, not yet urgent
          </span>
        </div>
        {dueSoon.length > 0 ? (
          <div className={styles.list}>
            {dueSoon.map((row) => (
              <Link key={row.tenderId} href={`/tenders/${row.tenderId}`} className={styles.row}>
                <span className={`${shared.badge} ${shared.badgeWarning}`}>{row.daysLabel}</span>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{row.customer}</span>
                  <span className={styles.rowSub} title={row.product}>
                    {row.product}
                  </span>
                </span>
                <span className={styles.rowMeta}>
                  {row.milestoneLabel} &middot; {row.dateFormatted}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className={shared.emptyState}>
            Nothing in the {REMINDER_DAYS + 1}–14 day window.
          </div>
        )}
      </div>

      <div className={shared.card} style={{ overflow: "hidden" }}>
        <div className={shared.cardHeader}>
          <h2 className={shared.cardTitle}>Awaiting Result — No Upcoming Milestone</h2>
          <span className={shared.cardMeta}>
            {stalledAll.length > STALLED_LIMIT
              ? `Showing the ${STALLED_LIMIT} most recently active of ${stalledAll.length}`
              : "Still running, but nothing scheduled ahead"}
          </span>
        </div>
        {stalled.length > 0 ? (
          <div className={styles.list}>
            {stalled.map((row) => (
              <Link key={row.tenderId} href={`/tenders/${row.tenderId}`} className={styles.row}>
                <span className={`${shared.badge} ${shared.badgeNeutral}`}>{row.area}</span>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{row.customer}</span>
                  <span className={styles.rowSub} title={row.product}>
                    {row.product}
                  </span>
                </span>
                <span className={styles.rowMeta}>
                  {row.lastMilestoneLabel ? `Last: ${row.lastMilestoneLabel} · ${row.lastMilestoneDateFormatted}` : "No milestones set"}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className={shared.emptyState}>No stalled tenders — everything active has an upcoming milestone.</div>
        )}
      </div>
    </div>
  );
}
