"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import { CHART_COLORS } from "./chartColors";
import type { TrackComparisonRow } from "@/lib/analytics";
import { formatCompactRupiah } from "@/lib/analytics";

const METRICS = [
  { key: "count", label: "Tenders", color: CHART_COLORS.primary },
  { key: "pipelineValue", label: "Pipeline Value", color: CHART_COLORS.primaryDark },
  { key: "winValue", label: "Win Value", color: CHART_COLORS.success },
] as const;

function TrackTooltip(props: TooltipContentProps) {
  if (!props.active || !props.payload?.length) return null;
  const label = props.label;
  const payload = props.payload;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 12.5,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      }}
    >
      <strong style={{ display: "block", marginBottom: 4 }}>{label}</strong>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: {p.name === "Tenders" ? p.value : formatCompactRupiah(p.value as number)}
        </div>
      ))}
    </div>
  );
}

export function TrackComparisonChart({ data }: { data: TrackComparisonRow[] }) {
  if (!data.length) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", fontSize: 13, color: "#64748b" }}>
        No tender data available.
      </div>
    );
  }

  // The chart needs one row per track, but BarChart wants each bar as a separate
  // series. Transform: one row with track as categories, metrics as series.
  const chartRow: Record<string, string | number> = {};
  for (const tr of data) {
    chartRow[`${tr.label} Tenders`] = tr.count;
    chartRow[`${tr.label} Pipeline`] = tr.pipelineValue;
    chartRow[`${tr.label} Win Value`] = tr.winValue;
    chartRow[`${tr.label} Win Rate`] = tr.winRate ?? 0;
  }
  const rows = [chartRow];

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ marginBottom: 12, display: "flex", gap: 20, fontSize: 12.5 }}>
        {data.map((tr) => (
          <div key={tr.track} style={{ flex: 1 }}>
            <strong>{tr.label}</strong>
            <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2, color: "#475569" }}>
              <span>
                {tr.count} tender{tr.count !== 1 ? "s" : ""}
              </span>
              <span>Win rate: {tr.winRate !== null ? `${tr.winRate}%` : "—"}</span>
            </div>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={rows} layout="vertical" barCategoryGap="30%" barGap={4}>
          <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12, fill: CHART_COLORS.axisText }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            tick={false}
            axisLine={false}
            tickLine={false}
            width={0}
          />
          <Tooltip content={TrackTooltip} />
          {data.map((tr) => (
            <Bar
              key={tr.track}
              dataKey={`${tr.label} Tenders`}
              name={`${tr.label}`}
              fill={tr.track === "upstream" ? CHART_COLORS.primary : CHART_COLORS.success}
              radius={[0, 4, 4, 0]}
              maxBarSize={28}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}