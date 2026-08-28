import type { LossBreakdownItem } from "@/lib/tender-logic";
import shared from "./shared.module.css";
import styles from "./LossBreakdownCard.module.css";

export function LossBreakdownCard({ items, periodLabel }: { items: LossBreakdownItem[]; periodLabel: string }) {
  const hasData = items.some((i) => i.count > 0);
  return (
    <div className={shared.card}>
      <div className={shared.cardHeader}>
        <h2 className={shared.cardTitle}>Sebaran Alasan Kalah</h2>
        <span className={shared.cardMeta}>Periode {periodLabel}</span>
      </div>
      <div style={{ padding: 20 }}>
        {hasData ? (
          items.map((item) => (
            <div key={item.label} className={styles.row}>
              <div className={styles.label}>{item.label}</div>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: `${item.pct}%`, background: item.color }} />
              </div>
              <div className={styles.count}>{item.count}</div>
            </div>
          ))
        ) : (
          <div className={shared.emptyState} style={{ padding: "12px 0" }}>
            Belum ada tender kalah pada periode ini.
          </div>
        )}
      </div>
    </div>
  );
}
