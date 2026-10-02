"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Area + period filter for the analytics dashboard.
 *
 * The selection lives in the URL (not in component state) so the filtered view
 * can be bookmarked, shared, and reached with the Back button — and so the page
 * itself stays a server component that does the filtering. */
export function AnalyticsFilters({
  areas,
  periods,
  area,
  period,
}: {
  areas: string[];
  periods: string[];
  area: string;
  period: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function apply(nextArea: string, nextPeriod: string) {
    const params = new URLSearchParams();
    if (nextArea !== "all") params.set("area", nextArea);
    if (nextPeriod !== "all") params.set("period", nextPeriod);
    const query = params.toString();
    // push, not replace: Back should return to the previous filter, not to the
    // page before the dashboard.
    startTransition(() => router.push(query ? `/?${query}` : "/"));
  }

  const selectStyle = {
    padding: "5px 8px",
    fontSize: 13,
    borderRadius: 6,
    border: "1px solid rgba(0,0,0,0.15)",
    background: "transparent",
    color: "inherit",
  } as const;

  const isFiltered = area !== "all" || period !== "all";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        marginBottom: 18,
        opacity: pending ? 0.6 : 1,
      }}
    >
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
        Area
        <select value={area} style={selectStyle} disabled={pending} onChange={(e) => apply(e.target.value, period)}>
          <option value="all">All areas</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
        Period
        <select value={period} style={selectStyle} disabled={pending} onChange={(e) => apply(area, e.target.value)}>
          <option value="all">All periods</option>
          {periods.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      {isFiltered && (
        <button
          type="button"
          onClick={() => apply("all", "all")}
          disabled={pending}
          style={{
            fontSize: 12.5,
            padding: "5px 10px",
            borderRadius: 6,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          Reset
        </button>
      )}
    </div>
  );
}
