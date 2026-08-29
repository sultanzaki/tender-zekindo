"use client";

import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { TooltipContentProps } from "recharts";
import type { PeriodOutcomeRow } from "@/lib/analytics";
import { CHART_COLORS } from "./chartColors";
import styles from "./charts.module.css";

function CustomTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as PeriodOutcomeRow;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipTitle}>{label}</div>
      <div className={styles.tooltipRow}>{row.winRatePct ?? "—"}% win rate</div>
      <div className={styles.tooltipRow}>
        {row.win} won &middot; {row.loss} lost ({row.decided} decided)
      </div>
    </div>
  );
}

export function WinRateTrendChart({ data }: { data: PeriodOutcomeRow[] }) {
  const hasData = data.some((d) => d.decided > 0);
  if (!hasData) {
    return (
      <div className={styles.chartWrap}>
        <div className={styles.emptyChart}>Not enough decided tenders yet to show a trend.</div>
      </div>
    );
  }
  return (
    <div className={styles.chartWrap}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11, fill: CHART_COLORS.axisText }}
            axisLine={{ stroke: CHART_COLORS.grid }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 11, fill: CHART_COLORS.axisText }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={CustomTooltip} />
          <Line
            type="monotone"
            dataKey="winRatePct"
            stroke={CHART_COLORS.primary}
            strokeWidth={2.5}
            dot={{ r: 4, fill: CHART_COLORS.primary, strokeWidth: 0 }}
            activeDot={{ r: 6 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
