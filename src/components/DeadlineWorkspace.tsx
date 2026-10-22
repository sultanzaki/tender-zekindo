"use client";
import { useState } from "react";
import Link from "next/link";
import type { DeadlineRow, StalledRow } from "@/lib/tender-logic";
import { deadlineCalendar } from "@/lib/calendar";
import { PageHeading } from "./PageHeading";
import { TrackBadge } from "./TrackBadge";
import styles from "./Workspace.module.css";
const VIEWS = [
  ["all", "Next 14 days"],
  ["urgent", "Due in 3 days"],
  ["week", "Due in 7 days"],
  ["followup", "Needs follow-up"],
] as const;
export function DeadlineWorkspace({
  deadlines,
  followups,
  initialView = "all",
  initialTrack = "all",
}: {
  deadlines: DeadlineRow[];
  followups: StalledRow[];
  initialView?: string;
  initialTrack?: string;
}) {
  const [view, setView] = useState(
    VIEWS.some(([key]) => key === initialView) ? initialView : "all",
  );
  const [track, setTrack] = useState(
    ["upstream", "downstream"].includes(initialTrack) ? initialTrack : "all",
  );
  const scopedDeadlines = deadlines.filter(
    (d) => track === "all" || d.track === track,
  );
  const scopedFollowups = followups.filter(
    (d) => track === "all" || d.track === track,
  );
  function updateURL(nextView: string, nextTrack: string) {
    const params = new URLSearchParams({ view: nextView });
    if (nextTrack !== "all") params.set("track", nextTrack);
    history.replaceState(null, "", `/notifications?${params}`);
  }
  const [search, setSearch] = useState("");
  const needle = search.trim().toLowerCase();
  const upcoming = scopedDeadlines.filter(
    (d) =>
      (view !== "urgent" || d.days <= 3) &&
      (view !== "week" || d.days <= 7) &&
      `${d.customer} ${d.product} ${d.milestoneLabel}`
        .toLowerCase()
        .includes(needle),
  );
  const stalled = scopedFollowups.filter((d) =>
    `${d.customer} ${d.product} ${d.area}`.toLowerCase().includes(needle),
  );
  function download() {
    const url = URL.createObjectURL(
      new Blob([deadlineCalendar(upcoming)], {
        type: "text/calendar;charset=utf-8",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "zekindo-deadlines.ics";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow="DEADLINES & FOLLOW-UP"
        title="Stay ahead of the next step."
        description="Milestone dates across both tracks. Calendar entries are all-day events."
        actions={
          view !== "followup" && (
            <button
              className="button button-secondary"
              disabled={!upcoming.length}
              onClick={download}
            >
              Download calendar
            </button>
          )
        }
      />
      <div className={styles.metrics}>
        {[
          ["Due today", scopedDeadlines.filter((d) => d.days === 0).length],
          ["Due in 3 days", scopedDeadlines.filter((d) => d.days <= 3).length],
          ["Next 14 days", scopedDeadlines.length],
          ["Needs follow-up", scopedFollowups.length],
        ].map(([label, value]) => (
          <div className={styles.metric} key={label}>
            <span className={styles.metricLabel}>{label}</span>
            <strong className={styles.metricValue}>{value}</strong>
          </div>
        ))}
      </div>
      <div className={styles.pills} aria-label="Deadline views">
        {VIEWS.map(([key, label]) => (
          <button
            key={key}
            aria-pressed={view === key}
            onClick={() => {
              setView(key);
              updateURL(key, track);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <h2>
              {view === "followup"
                ? "No upcoming milestone"
                : "Scheduled milestones"}
            </h2>
            <p>
              {view === "followup"
                ? "These tenders need a result or an updated schedule; this does not mean they are overdue."
                : "Nearest milestone per active tender, ordered by date."}
            </p>
          </div>
          <select
            aria-label="Deadline track"
            className="control"
            style={{ maxWidth: 180 }}
            value={track}
            onChange={(e) => {
              setTrack(e.target.value);
              updateURL(view, e.target.value);
            }}
          >
            <option value="all">Both tracks</option>
            <option value="upstream">Upstream</option>
            <option value="downstream">Downstream</option>
          </select>
          <input
            type="search"
            aria-label="Search deadlines"
            className="control"
            style={{ maxWidth: 300 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, package, or milestone"
          />
        </div>
        {view === "followup"
          ? stalled.map((d) => (
              <Link
                href={`/tenders/${d.tenderId}`}
                key={d.tenderId}
                className={styles.row}
              >
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>{d.customer}</span>
                  <span className={styles.rowSub}>{d.product}</span>
                </span>
                <span className={styles.rowMeta}>
                  {d.lastMilestoneLabel || "No dates recorded"}
                  <br />
                  {d.lastMilestoneDateFormatted}
                </span>
              </Link>
            ))
          : upcoming.map((d) => (
              <Link
                href={`/tenders/${d.tenderId}`}
                key={d.tenderId}
                className={styles.row}
              >
                <span
                  className={`${styles.day} ${d.urgent ? styles.urgent : ""}`}
                >
                  {d.days}
                  <small>{d.days === 0 ? "TODAY" : "DAYS"}</small>
                </span>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>
                    {d.customer} <TrackBadge track={d.track} />
                  </span>
                  <span className={styles.rowSub}>{d.product}</span>
                </span>
                <span className={styles.rowMeta}>
                  {d.milestoneLabel}
                  <br />
                  {d.dateFormatted}
                </span>
              </Link>
            ))}
        {(view === "followup" ? !stalled.length : !upcoming.length) && (
          <div className={styles.empty}>
            Nothing matches this view. Try another view or clear your search.
          </div>
        )}
      </section>
    </div>
  );
}
