"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Cell } from "recharts";
import type { TooltipContentProps } from "recharts";
import type { GroupWinRateRow } from "@/lib/analytics";
import { CATEGORICAL, CHART_COLORS } from "./chartColors";
import styles from "./charts.module.css";

function CustomTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as GroupWinRateRow;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipTitle}>{row.group}</div>
      <div className={styles.tooltipRow}>{row.winRatePct}% win rate</div>
      <div className={styles.tooltipRow}>
        {row.win} won &middot; {row.loss} lost ({row.decided} decided)
      </div>
    </div>
  );
}

/** Horizontal win-rate leaderboard for a group dimension (area / entitas).
 * Every bar is directly labeled with both the rate and its sample size
 * ("62% (n=13)") so a reader never has to guess how much to trust a bar —
 * winRateByGroup() has already dropped groups below the min sample size. */
export function GroupWinRateChart({ data, emptyMessage }: { data: GroupWinRateRow[]; emptyMessage: string }) {
  if (data.length === 0) {
    return (
      <div className={styles.chartWrap}>
        <div className={styles.emptyChart}>{emptyMessage}</div>
      </div>
    );
  }
  const sorted = [...data].sort((a, b) => b.winRatePct - a.winRatePct);
  const height = Math.max(240, sorted.length * 40);
  return (
    <div className={styles.chartWrap} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 64, left: 4, bottom: 4 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
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
          <Bar dataKey="winRatePct" fill={CHART_COLORS.primary} maxBarSize={22} radius={[0, 4, 4, 0]}>
            {data.map((entry, idx) => (
              <Cell key={entry.group} fill={CATEGORICAL[idx % CATEGORICAL.length]} />
            ))}
            <LabelList
              dataKey="winRatePct"
              position="right"
              content={(props) => {
                const { x, y, width, height, index } = props;
                const row = sorted[index as number];
                if (!row) return null;
                return (
                  <text
                    x={(x as number) + (width as number) + 6}
                    y={(y as number) + (height as number) / 2}
                    dy={4}
                    fontSize={11}
                    fill={CHART_COLORS.fg2}
                  >
                    {row.winRatePct}% (n={row.decided})
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
