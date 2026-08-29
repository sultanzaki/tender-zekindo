"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { TooltipContentProps } from "recharts";
import type { PeriodOutcomeRow } from "@/lib/analytics";
import { CHART_COLORS } from "./chartColors";
import styles from "./charts.module.css";

const SERIES = [
  { key: "win", label: "Win", color: CHART_COLORS.success },
  { key: "loss", label: "Loss", color: CHART_COLORS.error },
  { key: "other", label: "Other (withdraw/cancel/retender)", color: CHART_COLORS.gray400 },
] as const;

function CustomTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipTitle}>{label}</div>
      {SERIES.map((s) => {
        const entry = payload.find((p) => p.dataKey === s.key);
        return (
          <div className={styles.tooltipRow} key={s.key}>
            <span className={styles.tooltipDot} style={{ background: s.color }} />
            {s.label}: {entry?.value ?? 0}
          </div>
        );
      })}
    </div>
  );
}

export function OutcomeVolumeChart({ data }: { data: PeriodOutcomeRow[] }) {
  const hasData = data.some((d) => d.win + d.loss + d.other > 0);
  if (!hasData) {
    return (
      <div className={styles.chartWrap}>
        <div className={styles.emptyChart}>No tender outcomes recorded yet.</div>
      </div>
    );
  }
  return (
    <div className={styles.chartWrap}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11, fill: CHART_COLORS.axisText }}
            axisLine={{ stroke: CHART_COLORS.grid }}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 11, fill: CHART_COLORS.axisText }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
          <Tooltip content={CustomTooltip} cursor={{ fill: CHART_COLORS.grid, opacity: 0.4 }} />
          <Legend wrapperStyle={{ fontSize: 11.5 }} />
          {SERIES.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} stackId="outcome" fill={s.color} radius={0} maxBarSize={40} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
