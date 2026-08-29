"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { TooltipContentProps } from "recharts";
import { LOSS_CATEGORIES } from "@/lib/tender-logic";
import type { LossReasonPeriodRow } from "@/lib/analytics";
import { CHART_COLORS } from "./chartColors";
import styles from "./charts.module.css";

// Resolved hex per loss category, matching the badge/legend colors used
// elsewhere (LOSS_CATEGORIES.color is a CSS var() string, which SVG fill
// attributes render inconsistently, so we mirror the same families here).
const LOSS_COLOR_HEX: Record<string, string> = {
  "Price Loss": CHART_COLORS.error,
  "Technical Loss": CHART_COLORS.warning,
  "PQ Admin Loss": CHART_COLORS.gray500,
  "Registration Loss": CHART_COLORS.gray400,
};

interface FlatRow {
  period: string;
  totalLoss: number;
  [label: string]: string | number;
}

function toFlatRows(data: LossReasonPeriodRow[]): FlatRow[] {
  return data.map((row) => {
    const flat: FlatRow = { period: row.period, totalLoss: row.totalLoss };
    for (const s of row.shares) flat[s.label] = s.pct;
    return flat;
  });
}

function CustomTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipTitle}>{label}</div>
      {payload
        .filter((p) => (p.value as number) > 0)
        .map((p) => (
          <div className={styles.tooltipRow} key={String(p.dataKey)}>
            <span className={styles.tooltipDot} style={{ background: p.color }} />
            {p.name}: {p.value}%
          </div>
        ))}
    </div>
  );
}

export function LossReasonTrendChart({ data }: { data: LossReasonPeriodRow[] }) {
  if (data.length === 0) {
    return (
      <div className={styles.chartWrap}>
        <div className={styles.emptyChart}>No losses recorded yet.</div>
      </div>
    );
  }
  const flat = toFlatRows(data);
  return (
    <div className={styles.chartWrap}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={flat} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
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
          <Tooltip content={CustomTooltip} cursor={{ fill: CHART_COLORS.grid, opacity: 0.4 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {LOSS_CATEGORIES.map((c) => (
            <Bar key={c.label} dataKey={c.label} name={c.label} stackId="loss" fill={LOSS_COLOR_HEX[c.label]} maxBarSize={40} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
