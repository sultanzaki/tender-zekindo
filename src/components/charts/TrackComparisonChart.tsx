"use client";

import type { TrackComparisonRow } from "@/lib/analytics";
import { formatCompactRupiah } from "@/lib/analytics";
import { CHART_COLORS } from "./chartColors";

const TRACK_META: Record<string, { label: string; color: string }> = {
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

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const maxPv = Math.max(...data.map((d) => d.pipelineValue), 1);
  const maxWv = Math.max(...data.map((d) => d.winValue), 1);

  return (
    <div style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Metric: Tender Count */}
      <div>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 500 }}>TENDER COUNT</div>
        {data.map((row) => {
          const meta = TRACK_META[row.track];
          return (
            <div key={row.track} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                <span style={{ color: "#475569" }}>{meta?.label ?? row.track}</span>
                <span style={{ fontWeight: 600, color: "#0f172a" }}>{row.count}</span>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 4,
                  background: "#e2e8f0",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(row.count / maxCount) * 100}%`,
                    borderRadius: 4,
                    background: meta?.color ?? "#94a3b8",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Metric: Pipeline Value */}
      <div>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 500 }}>PIPELINE VALUE</div>
        {data.map((row) => {
          const meta = TRACK_META[row.track];
          return (
            <div key={row.track} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                <span style={{ color: "#475569" }}>{meta?.label ?? row.track}</span>
                <span style={{ fontWeight: 600, color: "#0f172a" }}>{formatCompactRupiah(row.pipelineValue)}</span>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 4,
                  background: "#e2e8f0",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(row.pipelineValue / maxPv) * 100}%`,
                    borderRadius: 4,
                    background: meta?.color ?? "#94a3b8",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Metric: Win Value */}
      <div>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 500 }}>WIN VALUE</div>
        {data.map((row) => {
          const meta = TRACK_META[row.track];
          return (
            <div key={row.track} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                <span style={{ color: "#475569" }}>{meta?.label ?? row.track}</span>
                <span style={{ fontWeight: 600, color: "#0f172a" }}>{formatCompactRupiah(row.winValue)}</span>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 4,
                  background: "#e2e8f0",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(row.winValue / maxWv) * 100}%`,
                    borderRadius: 4,
                    background: meta?.color ?? "#94a3b8",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Win Rate summary */}
      <div>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 500 }}>WIN RATE</div>
        <div style={{ display: "flex", gap: 20 }}>
          {data.map((row) => {
            const meta = TRACK_META[row.track];
            return (
              <div key={row.track} style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#475569", marginBottom: 2 }}>{meta?.label ?? row.track}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: meta?.color ?? "#0f172a" }}>
                  {row.winRate !== null ? `${row.winRate}%` : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}