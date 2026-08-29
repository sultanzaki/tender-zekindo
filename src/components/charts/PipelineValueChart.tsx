"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import type { TooltipContentProps } from "recharts";
import type { GroupValueRow } from "@/lib/analytics";
import { formatCompactRupiah } from "@/lib/analytics";
import { formatRupiah } from "@/lib/tender-logic";
import { CHART_COLORS } from "./chartColors";
import styles from "./charts.module.css";

function CustomTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as GroupValueRow;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipTitle}>{row.group}</div>
      <div className={styles.tooltipRow}>{formatRupiah(row.value)}</div>
      <div className={styles.tooltipRow}>{row.count} running tender{row.count === 1 ? "" : "s"}</div>
    </div>
  );
}

export function PipelineValueChart({ data, emptyMessage }: { data: GroupValueRow[]; emptyMessage: string }) {
  if (data.length === 0) {
    return (
      <div className={styles.chartWrap}>
        <div className={styles.emptyChart}>{emptyMessage}</div>
      </div>
    );
  }
  const top = data.filter((d) => d.value > 0).slice(0, 8);
  if (top.length === 0) {
    return (
      <div className={styles.chartWrap}>
        <div className={styles.emptyChart}>{emptyMessage}</div>
      </div>
    );
  }
  const maxValue = Math.max(...top.map((d) => d.value));
  const height = Math.max(240, top.length * 40);
  return (
    <div className={styles.chartWrap} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={top} layout="vertical" margin={{ top: 4, right: 72, left: 4, bottom: 4 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
          <XAxis
            type="number"
            domain={[0, maxValue * 1.15]}
            tickFormatter={(v: number) => formatCompactRupiah(v)}
            tick={{ fontSize: 11, fill: CHART_COLORS.axisText }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="group"
            width={130}
            tick={{ fontSize: 12, fill: CHART_COLORS.fg1 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={CustomTooltip} cursor={{ fill: CHART_COLORS.grid, opacity: 0.4 }} />
          <Bar dataKey="value" fill={CHART_COLORS.primaryDark} maxBarSize={22} radius={[0, 4, 4, 0]}>
            <LabelList
              dataKey="value"
              position="right"
              content={(props) => {
                const { x, y, width, height, value } = props;
                if (value === undefined) return null;
                return (
                  <text
                    x={(x as number) + (width as number) + 6}
                    y={(y as number) + (height as number) / 2}
                    dy={4}
                    fontSize={11}
                    fill={CHART_COLORS.fg2}
                  >
                    {formatCompactRupiah(value as number)}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
