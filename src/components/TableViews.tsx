"use client";
import { useState } from "react";
import type { TenderFilters } from "@/lib/types";
import { readTenderFilters } from "@/lib/table-state";
import { useStoredJSON } from "./useStoredJSON";
import { Modal } from "./Modal";
const EMPTY: { name: string; filters: TenderFilters }[] = [];
export function TableViews({
  track,
  filters,
  onApply,
}: {
  track: string;
  filters: TenderFilters;
  onApply: (filters: TenderFilters) => void;
}) {
  const [stored, save] = useStoredJSON(`zekindo-views:${track}`, EMPTY);
  const views = Array.isArray(stored)
    ? stored
        .filter(
          (v) =>
            v &&
            typeof v.name === "string" &&
            v.filters &&
            typeof v.filters === "object",
        )
        .slice(0, 10)
    : EMPTY;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="saved-views">
      <label>
        Saved views{" "}
        <select
          aria-label="Saved views"
          className="control"
          value=""
          onChange={(e) => {
            if (e.target.value === "") return;
            const view = views[Number(e.target.value)];
            if (view)
              onApply(
                readTenderFilters(
                  new URLSearchParams(
                    view.filters as unknown as Record<string, string>,
                  ),
                ),
              );
          }}
        >
          <option value="">Choose a view…</option>
          {views.map((v, i) => (
            <option key={i} value={i}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      <button className="button button-secondary" onClick={() => setOpen(true)}>
        Save view
      </button>
      <Modal
        open={open}
        title="Save current filters"
        onClose={() => setOpen(false)}
      >
        <p className="muted">
          Saved on this browser for the {track} track. Your shareable URL works
          on any device.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const next = [
              ...views.filter((v) => v.name !== name.trim()),
              { name: name.trim(), filters },
            ].slice(-10);
            if (save(next)) {
              setOpen(false);
              setName("");
            } else
              setError(
                "Browser storage is unavailable. You can bookmark the URL instead.",
              );
          }}
        >
          <label className="field">
            View name
            <input
              className="control"
              required
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Active opportunities in Jawa"
            />
          </label>
          {error && (
            <p role="alert" className="feedback feedback-error">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                save(EMPTY);
                setOpen(false);
              }}
            >
              Clear saved views
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={!name.trim()}
            >
              Save view
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
