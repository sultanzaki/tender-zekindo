import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { getAllTenders } from "@/lib/tenders";
import { computeDeadlines, computeStalled, formatDateID, todayISO } from "@/lib/tender-logic";
import shared from "@/components/shared.module.css";
import styles from "./notifications.module.css";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await requireUser();
  const tenders = await getAllTenders();
  const anchor = todayISO();

  const deadlines = computeDeadlines(tenders, anchor);
  const stalledAll = computeStalled(tenders, anchor);
  const STALLED_LIMIT = 20;
  const stalled = stalledAll.slice(0, STALLED_LIMIT);

  return (
    <div className={shared.pagePad} style={{ maxWidth: 1000, margin: "0 auto" }}>
      <h1 className={styles.pageTitle}>Notifications</h1>
      <p className={styles.pageSubtitle}>As of {formatDateID(anchor)}</p>

      <div className={shared.card} style={{ marginBottom: 24, overflow: "hidden" }}>
        <div className={shared.cardHeader}>
          <h2 className={shared.cardTitle}>Due Soon</h2>
          <span className={shared.cardMeta}>Milestones due within 14 days, no result yet</span>
        </div>
        {deadlines.length > 0 ? (
          <div className={styles.list}>
            {deadlines.map((row) => (
              <Link key={row.tenderId} href={`/tenders/${row.tenderId}`} className={styles.row}>
                <span className={`${shared.badge} ${row.urgent ? shared.badgeError : shared.badgeWarning}`}>
                  {row.daysLabel}
                </span>
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
          <div className={shared.emptyState}>No milestones due within the next 14 days.</div>
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
