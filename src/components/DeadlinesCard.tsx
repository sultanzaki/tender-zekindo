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
        <h2 className={shared.cardTitle}>Tenggat Terdekat</h2>
        <span className={shared.cardMeta}>Milestone jatuh tempo dalam 14 hari &middot; per {anchorFormatted}</span>
      </div>
      {deadlines.length > 0 ? (
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
      ) : (
        <div className={shared.emptyState}>Tidak ada milestone yang jatuh tempo dalam 14 hari ke depan.</div>
      )}
    </div>
  );
}
