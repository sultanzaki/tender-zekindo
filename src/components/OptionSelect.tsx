"use client";

import { useState, useTransition } from "react";
import { addSelectOption } from "@/lib/actions";
import type { ExtendableField } from "@/lib/types";

const ADD_NEW = "__add_new__";

/**
 * Dropdown for any admin-extendable field (Area, Customer, Entity).
 *
 * The "+ Add new …" entry writes straight to the `select_options` table via
 * addSelectOption and immediately makes the value the current selection, so a
 * user never has to leave the form to introduce a value that doesn't exist
 * yet. Which fields are allowed to do this is decided server-side by
 * EXTENDABLE_FIELDS, not by the props here.
 */
export function OptionSelect({
  field,
  label,
  value,
  options,
  onChange,
  className,
  required,
}: {
  field: ExtendableField;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
}) {
  const [localOptions, setLocalOptions] = useState(options);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // A value can arrive from the server after mount (e.g. router.refresh), and
  // a value the user typed in a previous session may not be in the list yet.
  // Render both so the select never shows a blank for a populated field.
  const known = value && !localOptions.includes(value) ? [value, ...localOptions] : localOptions;

  function handleSelectChange(next: string) {
    if (next === ADD_NEW) {
      setAdding(true);
      return;
    }
    onChange(next);
  }

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      const result = await addSelectOption(field, draft);
      if (result.error) {
        setError(result.error);
        return;
      }
      const newValue = result.value!;
      setLocalOptions((prev) => (prev.includes(newValue) ? prev : [...prev, newValue].sort()));
      onChange(newValue);
      setAdding(false);
      setDraft("");
    });
  }

  if (adding) {
    return (
      <div style={{ display: "flex", gap: 6 }}>
        <input
          className={className}
          style={{ flex: 1 }}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`New ${label.toLowerCase()}`}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending || !draft.trim()}
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            background: "var(--color-primary)",
            color: "#fff",
            padding: "0 14px",
            fontSize: 13,
            cursor: isPending ? "wait" : "pointer",
          }}
        >
          {isPending ? "Adding…" : "Add"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAdding(false);
            setDraft("");
            setError(null);
          }}
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            background: "none",
            color: "var(--color-fg2)",
            padding: "0 14px",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        {error && <span style={{ color: "var(--zk-error)", fontSize: 12, alignSelf: "center" }}>{error}</span>}
      </div>
    );
  }

  return (
    <select
      className={className}
      value={value}
      required={required}
      onChange={(e) => handleSelectChange(e.target.value)}
    >
      <option value="">Select {label.toLowerCase()}</option>
      {known.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
      <option value={ADD_NEW}>+ Add new {label.toLowerCase()}…</option>
    </select>
  );
}
