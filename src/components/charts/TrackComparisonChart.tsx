"use client";

import type { TrackComparisonRow } from "@/lib/analytics";
import { formatCompactRupiah } from "@/lib/analytics";
import { CHART_COLORS } from "./chartColors";

const META: Record<string, { label: string; color: string }> = {
  upstream: { label: "Upstream", color: CHART_COLORS.primary },
  downstream: { label: "Downstream", color: CHART_COLORS.success },
};

export function TrackComparisonChart({ data }: { data: TrackComparisonRow[] }) {
  if (!data.length) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", fontSize: 13, color: "#64748b" }}>
        No tender data available.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 16, padding: "4px 20px 20px" }}>
      {data.map((row) => {
        const meta = META[row.track];
        return (
          <div
            key={row.track}
            style={{ flex: 1 }}
          >
            {/* Track label with dot */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: meta?.color ?? "#94a3b8",
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                {meta?.label ?? row.track}
              </span>
            </div>

            {/* Metrics */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <MetricRow label="Tenders" value={`${row.count}`} />
              <MetricRow label="Pipeline Value" value={formatCompactRupiah(row.pipelineValue)} />
              <MetricRow label="Win Value" value={formatCompactRupiah(row.winValue)} />
            </div>

            {/* Win rate — large number */}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>Win Rate</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: meta?.color ?? "#0f172a" }}>
                {row.winRate !== null ? `${row.winRate}%` : "—"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ fontWeight: 500, color: "#0f172a" }}>{value}</span>
    </div>
  );
}