"use client";
import { useState, useTransition } from "react";
import { ensureMilestoneTypeByName } from "@/lib/milestone-actions";
import { findOutOfOrderMilestones } from "@/lib/tender-logic";
import type { MilestoneType, Track } from "@/lib/types";
import styles from "./NewTenderForm.module.css";
export function MilestoneEditor({
  track,
  catalog,
  order,
  dates,
  onOrder,
  onDates,
  onCreated,
}: {
  track: Track;
  catalog: MilestoneType[];
  order: string[];
  dates: Record<string, string>;
  onOrder: (order: string[]) => void;
  onDates: (dates: Record<string, string>) => void;
  onCreated?: (type: MilestoneType) => void;
}) {
  const [extra, setExtra] = useState<MilestoneType[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const all = [
    ...catalog,
    ...extra.filter((m) => !catalog.some((c) => c.key === m.key)),
  ];
  const selected = order
    .map((key) => all.find((m) => m.key === key))
    .filter((m): m is MilestoneType => !!m);
  const hidden = all.filter((m) => !order.includes(m.key));
  const issues = findOutOfOrderMilestones(dates, selected);
  function move(i: number, offset: number) {
    const next = [...order];
    [next[i], next[i + offset]] = [next[i + offset], next[i]];
    onOrder(next);
  }
  function add() {
    if (!name.trim() || pending) return;
    setError("");
    start(async () => {
      try {
        const result = await ensureMilestoneTypeByName(name.trim(), track);
        if (result.error || !result.key) {
          setError(result.error || "Milestone could not be created.");
          return;
        }
        const key = result.key;
        if (!all.some((m) => m.key === key)) {
          const created = {
            id: key,
            key,
            label: name.trim(),
            track,
            sortOrder: 0,
            showInTable: false,
          };
          setExtra((prev) => [...prev, created]);
          onCreated?.(created);
        }
        if (!order.includes(key)) onOrder([...order, key]);
        setName("");
      } catch {
        setError("Could not create milestone. Please try again.");
      }
    });
  }
  return (
    <div className={styles.fieldColumn}>
      <p className={styles.hint}>
        Set the steps this tender needs. Removing a step hides it from this
        tender; existing dates are retained. Past dates are scheduled history,
        not proof of completion.
      </p>
      {issues.length > 0 && (
        <div className={styles.orderWarning} role="status">
          {issues.map((issue, i) => (
            <div key={i}>
              {issue.laterLabel} is dated before {issue.earlierLabel}. Check
              this sequence.
            </div>
          ))}
        </div>
      )}
      <div className={styles.milestoneList}>
        {selected.map((m, i) => (
          <div key={m.key} className={styles.milestoneRow}>
            <span className={styles.stepNumber}>{i + 1}</span>
            <label className={styles.label}>
              {m.label}
              <input
                type="date"
                className={styles.input}
                value={dates[m.key] || ""}
                onChange={(e) => onDates({ ...dates, [m.key]: e.target.value })}
              />
            </label>
            <div className={styles.milestoneActions}>
              <button
                className="icon-button"
                type="button"
                aria-label={`Move ${m.label} up`}
                disabled={i === 0 || pending}
                onClick={() => move(i, -1)}
              >
                ↑
              </button>
              <button
                className="icon-button"
                type="button"
                aria-label={`Move ${m.label} down`}
                disabled={i === selected.length - 1 || pending}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
              <button
                className="button button-secondary"
                type="button"
                disabled={pending}
                onClick={() => onOrder(order.filter((k) => k !== m.key))}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      {!selected.length && (
        <p className="muted">
          No milestones selected. Add a step below, or save this tender without
          a schedule.
        </p>
      )}
      {hidden.length > 0 && (
        <label className={styles.label}>
          Add an existing step
          <select
            className={styles.input}
            value=""
            onChange={(e) => {
              if (e.target.value) onOrder([...order, e.target.value]);
            }}
          >
            <option value="">Choose a milestone…</option>
            {hidden.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <details className={styles.customMilestone}>
        <summary>Create a custom milestone</summary>
        <p className="muted">
          This adds a named step to the {track} catalog, and selects it for this
          tender.
        </p>
        <div className={styles.fieldRowInline}>
          <input
            aria-label="Custom milestone name"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="e.g. Site visit"
          />
          <button
            className="button button-secondary"
            type="button"
            onClick={add}
            disabled={pending || !name.trim()}
          >
            {pending ? "Creating…" : "Create milestone"}
          </button>
        </div>
        {error && (
          <p role="alert" className="feedback feedback-error">
            {error}
          </p>
        )}
      </details>
    </div>
  );
}
