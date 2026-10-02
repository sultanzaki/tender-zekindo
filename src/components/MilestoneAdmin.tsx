"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addMilestoneType,
  archiveMilestoneType,
  moveMilestoneType,
  renameMilestoneType,
  restoreMilestoneType,
  setMilestoneTableVisibility,
} from "@/lib/milestone-actions";
import type { MilestoneTypeAdmin } from "@/lib/types";
import shared from "./shared.module.css";
import styles from "./MilestoneAdmin.module.css";

/** Global milestone catalog management: add, rename, reorder, archive.
 * The per-tender order lives in the tender edit form (it writes
 * `tenders.milestone_order`). */
export function MilestoneAdmin({
  milestoneTypes,
  loadError = null,
}: {
  milestoneTypes: MilestoneTypeAdmin[];
  loadError?: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const active = milestoneTypes.filter((m) => !m.archivedAt);
  const archived = milestoneTypes.filter((m) => m.archivedAt);

  function run(id: string, fn: () => Promise<{ error?: string }>) {
    setBusyId(id);
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      setBusyId(null);
      if (result?.error) setMessage(result.error);
      else router.refresh();
    });
  }

  function handleAdd() {
    const label = newLabel.trim();
    if (!label) return;
    setBusyId("__new__");
    setMessage(null);
    startTransition(async () => {
      const result = await addMilestoneType(label);
      setBusyId(null);
      if (result?.error) setMessage(result.error);
      else {
        setNewLabel("");
        router.refresh();
      }
    });
  }

  function row(m: MilestoneTypeAdmin, index: number, list: MilestoneTypeAdmin[]) {
    const draft = drafts[m.id] ?? m.label;
    const dirty = draft.trim() !== m.label;
    const busy = busyId === m.id;
    const isArchived = !!m.archivedAt;

    return (
      <div
        key={m.id}
        className={styles.row}
        style={{ opacity: isArchived ? 0.55 : 1 }}
      >
        <span className={styles.index}>{index + 1}.</span>
        <input
          className={styles.name}
          value={draft}
          disabled={busy || isArchived}
          aria-label={`Name of ${m.label}`}
          onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
        />
        <code className={styles.key}>{m.key}</code>

        <div className={styles.controls}>
          {!isArchived && (
            <>
              <button
                className={styles.button}
                disabled={busy || index === 0}
                title="Move up in the default order"
                aria-label={`Move ${m.label} up`}
                onClick={() => run(m.id, () => moveMilestoneType(m.id, "up"))}
              >
                ↑
              </button>
              <button
                className={styles.button}
                disabled={busy || index === list.length - 1}
                title="Move down in the default order"
                aria-label={`Move ${m.label} down`}
                onClick={() => run(m.id, () => moveMilestoneType(m.id, "down"))}
              >
                ↓
              </button>
              <label className={styles.inTable}>
                <input
                  type="checkbox"
                  checked={m.showInTable}
                  disabled={busy}
                  onChange={(e) => run(m.id, () => setMilestoneTableVisibility(m.id, e.target.checked))}
                />
                In table
              </label>
            </>
          )}

          <button
            className={styles.button}
            disabled={busy || !dirty || isArchived}
            onClick={() => run(m.id, () => renameMilestoneType(m.id, draft))}
          >
            Save name
          </button>

          {isArchived ? (
            <button className={styles.button} disabled={busy} onClick={() => run(m.id, () => restoreMilestoneType(m.id))}>
              Restore
            </button>
          ) : (
            <button
              className={styles.button}
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    `Archive "${m.label}"?\n\nIt disappears from the default order for every tender that hasn't set its own milestone order. No dates are deleted — restore it anytime and they come back.`
                  )
                ) {
                  run(m.id, () => archiveMilestoneType(m.id));
                }
              }}
            >
              Archive
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={shared.card}>
        <div className={shared.cardHeader}>
          <h2 className={shared.cardTitle}>Milestones</h2>
          <span className={shared.cardMeta}>Global catalog — default order and names for every tender</span>
        </div>

        <div className={styles.body}>
          <div className={styles.addRow}>
            <input
              className={styles.input}
              style={{ flex: 1 }}
              placeholder="New milestone name, e.g. Site Visit"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
            />
            <button className={styles.buttonPrimary} disabled={busyId === "__new__" || !newLabel.trim()} onClick={handleAdd}>
              Add milestone
            </button>
          </div>

          {loadError && (
            <div className={styles.errorBanner}>
              Could not load the milestone catalog: {loadError}
              <br />
              If the <code>milestone_types</code> table does not exist yet, run{" "}
              <code>supabase/migrations/0006_dynamic_milestones.sql</code> in the Supabase SQL editor first.
            </div>
          )}

          {message && <div className={styles.message}>{message}</div>}

          <div className={styles.note}>
            The order below is the default for every tender that hasn&apos;t set its own. &ldquo;In table&rdquo; is the
            starting visibility in the tender table&apos;s Columns menu — it does not delete anything.
          </div>

          {active.length ? (
            active.map((m, i) => row(m, i, active))
          ) : (
            <div className={shared.emptyState}>No milestones yet. Add one above.</div>
          )}

          {archived.length > 0 && (
            <>
              <h3 className={styles.archivedTitle}>Archived</h3>
              <div className={styles.archivedNote}>
                Hidden from the default order. Their dates are still stored on every tender that has them.
              </div>
              {archived.map((m, i) => row(m, i, archived))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
