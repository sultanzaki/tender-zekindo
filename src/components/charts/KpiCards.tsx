import { MoneyValue } from "../MoneyValue";
import styles from "./charts.module.css";

export interface KpiData {
  pipelineValue: number;
  hidePipeline?: boolean;
  winValue: number;
  runningCount: number;
  winRatePct: number | null;
  winCount: number;
  lossCount: number;
  decidedCount: number;
}

export function KpiCards({
  data,
  canViewMoney = false,
}: {
  data: KpiData;
  canViewMoney?: boolean;
}) {
  return (
    <div className={styles.kpiGrid}>
      {!data.hidePipeline && (
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Pipeline Value</div>
          <div className={styles.kpiValue}>
            <MoneyValue
              value={data.pipelineValue}
              canView={canViewMoney}
              compact
            />
          </div>
          <div className={styles.kpiCaption}>Known OE of active tenders</div>
        </div>
      )}
      <div className={styles.kpiCard}>
        <div className={styles.kpiLabel}>Win Value</div>
        <div className={styles.kpiValue}>
          <MoneyValue value={data.winValue} canView={canViewMoney} compact />
        </div>
        <div className={styles.kpiCaption}>Known bid value of won tenders</div>
      </div>
      <div className={styles.kpiCard}>
        <div className={styles.kpiLabel}>Running Tenders</div>
        <div className={styles.kpiValue}>{data.runningCount}</div>
        <div className={styles.kpiCaption}>No result recorded yet</div>
      </div>
      <div className={styles.kpiCard}>
        <div className={styles.kpiLabel}>Win Rate</div>
        <div className={styles.kpiValue}>
          {data.winRatePct !== null ? `${data.winRatePct}%` : "—"}
        </div>
        <div className={styles.kpiCaption}>
          {data.winCount} won of {data.decidedCount} decided
        </div>
      </div>
    </div>
  );
}
