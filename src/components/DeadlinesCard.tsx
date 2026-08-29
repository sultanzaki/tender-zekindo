"use client";

import { useRouter } from "next/navigation";
import type { DeadlineRow } from "@/lib/tender-logic";
import shared from "./shared.module.css";
import styles from "./DeadlinesCard.module.css";

export function DeadlinesCard({ deadlines, anchorFormatted }: { deadlines: DeadlineRow[]; anchorFormatted: string }) {
  const router = useRouter();

  return (
    <div className={shared.card} style={{ marginBottom: 24, overflow: "hidden" }}>
      <div className={shared.cardHeader}>
        <h2 className={shared.cardTitle}>Upcoming Deadlines</h2>
        <span className={shared.cardMeta}>Milestones due within 14 days &middot; as of {anchorFormatted}</span>
      </div>
      {deadlines.length > 0 ? (
        <div className={styles.scrollWrap}>
          <table className={styles.table}>
            <tbody>
              {deadlines.map((row) => (
                <tr
                  key={row.tenderId}
                  className={styles.row}
                  onClick={() => router.push(`/tenders/${row.tenderId}`)}
                >
                  <td className={styles.dayCell}>
                    <span className={`${shared.badge} ${row.urgent ? shared.badgeError : shared.badgeWarning}`}>
                      {row.daysLabel}
                    </span>
                  </td>
                  <td className={styles.customerCell}>{row.customer}</td>
                  <td className={styles.productCell} title={row.product}>
                    {row.product}
                  </td>
                  <td className={styles.milestoneCell}>{row.milestoneLabel}</td>
                  <td className={styles.dateCell}>{row.dateFormatted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={shared.emptyState}>No milestones due within the next 14 days.</div>
      )}
    </div>
  );
}
