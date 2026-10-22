"use client";
import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import { TRACKS, TRACK_LABELS, type Track } from "@/lib/types";
import styles from "./Workspace.module.css";
export function AnalyticsFilters({
  areas,
  periods,
  customers = [],
  area,
  period,
  customer = "all",
  track,
}: {
  areas: string[];
  periods: string[];
  customers?: string[];
  area: string;
  period: string;
  customer?: string;
  track: Track | "all";
}) {
  const router = useRouter();
  const path = usePathname();
  const [pending, start] = useTransition();
  function apply(
    patch: Partial<{
      track: string;
      area: string;
      period: string;
      customer: string;
    }>,
  ) {
    const selected = { track, area, period, customer, ...patch };
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(selected))
      if (value !== "all") query.set(key, value);
    start(() => router.push(query.size ? `${path}?${query}` : path));
  }
  return (
    <div className={styles.filterBar} aria-busy={pending}>
      <label>
        Track
        <select
          className="control"
          value={track}
          disabled={pending}
          onChange={(e) => apply({ track: e.target.value })}
        >
          <option value="all">Both tracks</option>
          {TRACKS.map((t) => (
            <option key={t} value={t}>
              {TRACK_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      {(
        [
          { key: "area", label: "Area", value: area, options: areas },
          { key: "period", label: "Period", value: period, options: periods },
          {
            key: "customer",
            label: "Customer",
            value: customer,
            options: customers,
          },
        ] as const
      ).map((field) => (
        <label key={field.key}>
          {field.label}
          <select
            className="control"
            value={field.value}
            disabled={pending}
            onChange={(e) => apply({ [field.key]: e.target.value })}
          >
            <option value="all">All {field.label.toLowerCase()}s</option>
            {field.options.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      ))}
      <button
        className="button button-secondary"
        disabled={
          pending ||
          (track === "all" &&
            area === "all" &&
            period === "all" &&
            customer === "all")
        }
        onClick={() =>
          apply({ track: "all", area: "all", period: "all", customer: "all" })
        }
      >
        {pending ? "Applying…" : "Reset filters"}
      </button>
    </div>
  );
}
