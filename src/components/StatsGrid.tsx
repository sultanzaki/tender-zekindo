import type { DashboardStats } from "@/lib/tender-logic";
import styles from "./StatsGrid.module.css";

export function StatsGrid({ stats, periodLabel }: { stats: DashboardStats; periodLabel: string }) {
  return (
    <div className={styles.grid}>
      <div className={styles.tile}>
        <div className={styles.label}>Tender Berjalan</div>
        <div className={styles.value}>{stats.running}</div>
      </div>
      <div className={styles.tile}>
        <div className={styles.label}>Menunggu Hasil</div>
        <div className={styles.value}>{stats.awaiting}</div>
      </div>
      <div className={styles.tile}>
        <div className={styles.label}>Win Rate ({periodLabel})</div>
        <div className={styles.value}>{stats.winRatePct}</div>
        <div className={styles.caption}>{stats.winRateCaption}</div>
      </div>
      <div className={styles.tile}>
        <div className={styles.label}>Total Tender ({periodLabel})</div>
        <div className={styles.value}>{stats.periodTotal}</div>
      </div>
    </div>
  );
}
