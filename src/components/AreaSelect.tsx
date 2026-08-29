"use client";

import { useState, useTransition } from "react";
import { addSelectOption } from "@/lib/actions";

const ADD_NEW = "__add_new__";

export function AreaSelect({
  value,
  options,
  onChange,
  className,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const [localOptions, setLocalOptions] = useState(options);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
      const result = await addSelectOption("area", draft);
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
          placeholder="New area name"
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
            cursor: "pointer",
          }}
        >
          Add
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
    <select className={className} value={value} onChange={(e) => handleSelectChange(e.target.value)}>
      <option value="">Select area</option>
      {localOptions.map((a) => (
        <option key={a} value={a}>
          {a}
        </option>
      ))}
      <option value={ADD_NEW}>+ Add new area...</option>
    </select>
  );
}
