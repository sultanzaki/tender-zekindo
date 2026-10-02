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

// Only classes that actually exist in shared.module.css are used here
// (.card/.cardHeader/.cardTitle/.cardMeta/.pagePad/.emptyState); everything else
// is inline, so this component cannot silently render unstyled buttons by
// referencing a class that was never defined.
const INPUT: React.CSSProperties = {
  padding: "7px 10px",
  border: "1px solid var(--zk-gray-300, #d1d5db)",
  borderRadius: 6,
  fontSize: 13,
  fontFamily: "inherit",
  minWidth: 0,
};

const BUTTON: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid var(--zk-gray-300, #d1d5db)",
  borderRadius: 6,
  background: "#fff",
  fontSize: 12.5,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const BUTTON_PRIMARY: React.CSSProperties = {
  ...BUTTON,
  background: "var(--color-primary, #111827)",
  color: "#fff",
  borderColor: "var(--color-primary, #111827)",
};

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
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 0",
          borderBottom: "1px solid var(--zk-gray-200, #e5e7eb)",
          opacity: isArchived ? 0.55 : 1,
        }}
      >
        <span style={{ width: 26, color: "var(--color-fg3)", fontSize: 12 }}>{index + 1}.</span>
        <input
          style={{ ...INPUT, flex: 1, minWidth: 200 }}
          value={draft}
          disabled={busy || isArchived}
          onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
        />
        <code style={{ fontSize: 11, color: "var(--color-fg3)", minWidth: 96 }}>{m.key}</code>

        {!isArchived && (
          <>
            <button
              style={BUTTON}
              disabled={busy || index === 0}
              title="Move up in the default order"
              onClick={() => run(m.id, () => moveMilestoneType(m.id, "up"))}
            >
              ↑
            </button>
            <button
              style={BUTTON}
              disabled={busy || index === list.length - 1}
              title="Move down in the default order"
              onClick={() => run(m.id, () => moveMilestoneType(m.id, "down"))}
            >
              ↓
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, whiteSpace: "nowrap" }}>
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
          style={BUTTON}
          disabled={busy || !dirty || isArchived}
          onClick={() => run(m.id, () => renameMilestoneType(m.id, draft))}
        >
          Save name
        </button>

        {isArchived ? (
          <button style={BUTTON} disabled={busy} onClick={() => run(m.id, () => restoreMilestoneType(m.id))}>
            Restore
          </button>
        ) : (
          <button
            style={BUTTON}
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
    );
  }

  return (
    <div className={shared.pagePad} style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div className={shared.card}>
        <div className={shared.cardHeader}>
          <h2 className={shared.cardTitle}>Milestones</h2>
          <span className={shared.cardMeta}>Global catalog — default order and names for every tender</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0" }}>
          <input
            style={{ ...INPUT, flex: 1 }}
            placeholder="New milestone name, e.g. Site Visit"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
          />
          <button style={BUTTON_PRIMARY} disabled={busyId === "__new__" || !newLabel.trim()} onClick={handleAdd}>
            Add milestone
          </button>
        </div>

        {loadError && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 6,
              padding: "10px 12px",
              marginBottom: 12,
              fontSize: 12.5,
              color: "#991b1b",
            }}
          >
            Could not load the milestone catalog: {loadError}
            <br />
            If the <code>milestone_types</code> table does not exist yet, run{" "}
            <code>supabase/migrations/0006_dynamic_milestones.sql</code> in the Supabase SQL editor first.
          </div>
        )}

        {message && (
          <div style={{ color: "var(--zk-error, #b91c1c)", fontSize: 12.5, marginBottom: 10 }}>{message}</div>
        )}

        <div style={{ marginBottom: 6, fontSize: 12.5, color: "var(--color-fg3)" }}>
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
            <h3 style={{ marginTop: 26, marginBottom: 4, fontSize: 13.5 }}>Archived</h3>
            <div style={{ fontSize: 12.5, color: "var(--color-fg3)", marginBottom: 8 }}>
              Hidden from the default order. Their dates are still stored on every tender that has them.
            </div>
            {archived.map((m, i) => row(m, i, archived))}
          </>
        )}
      </div>
    </div>
  );
}
