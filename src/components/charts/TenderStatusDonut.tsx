"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { TooltipContentProps } from "recharts";
import { STATUS_COLORS } from "./chartColors";
import type { StatusBreakdown } from "@/lib/analytics";
import { formatCompactRupiah } from "@/lib/analytics";

function DonutTooltip(props: TooltipContentProps) {
  if (!props.active || !props.payload?.length) return null;
  const row = props.payload[0].payload as StatusBreakdown;
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
      <strong>{row.label}</strong>: {row.count} tender{(row.count ?? 0) !== 1 ? "s" : ""}
    </div>
  );
}

export function TenderStatusDonut({ data }: { data: StatusBreakdown[] }) {
  const total = data.reduce((s, r) => s + r.count, 0);

  if (!total) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", fontSize: 13, color: "#64748b" }}>
        No tenders match the current filters.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
      <ResponsiveContainer width="55%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={82}
            paddingAngle={3}
            stroke="#fff"
            strokeWidth={2}
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={STATUS_COLORS[entry.key] ?? "#94a3b8"} />
            ))}
          </Pie>
          <Tooltip content={DonutTooltip} />
        </PieChart>
      </ResponsiveContainer>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {data.map((entry) => (
          <div key={entry.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: STATUS_COLORS[entry.key] ?? "#94a3b8",
                flexShrink: 0,
              }}
            />
            <span style={{ color: "#475569", minWidth: 70 }}>{entry.label}</span>
            <span style={{ fontWeight: 600, color: "#0f172a", minWidth: 30, textAlign: "right" }}>
              {entry.count}
            </span>
            <span style={{ color: "#94a3b8", fontSize: 11 }}>
              {Math.round((entry.count / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}