import { formatRupiah } from "@/lib/tender-logic";
import styles from "./charts.module.css";

export interface KpiData {
  pipelineValue: number;
  winValue: number;
  runningCount: number;
  winRatePct: number | null;
  winCount: number;
  lossCount: number;
  decidedCount: number;
}

export function KpiCards({ data }: { data: KpiData }) {
  return (
    <div className={styles.kpiGrid}>
      <div className={styles.kpiCard}>
        <div className={styles.kpiLabel}>Pipeline Value</div>
        <div className={styles.kpiValue}>{formatRupiah(data.pipelineValue)}</div>
        <div className={styles.kpiCaption}>Sum of OE for running tenders</div>
      </div>
      <div className={styles.kpiCard}>
        <div className={styles.kpiLabel}>Win Value</div>
        <div className={styles.kpiValue}>{formatRupiah(data.winValue)}</div>
        <div className={styles.kpiCaption}>Sum of bid value for WIN tenders</div>
      </div>
      <div className={styles.kpiCard}>
        <div className={styles.kpiLabel}>Running Tenders</div>
        <div className={styles.kpiValue}>{data.runningCount}</div>
        <div className={styles.kpiCaption}>No result recorded yet</div>
      </div>
      <div className={styles.kpiCard}>
        <div className={styles.kpiLabel}>Win Rate (All-Time)</div>
        <div className={styles.kpiValue}>{data.winRatePct !== null ? `${data.winRatePct}%` : "—"}</div>
        <div className={styles.kpiCaption}>
          {data.winCount} won of {data.decidedCount} decided
        </div>
      </div>
    </div>
  );
}
