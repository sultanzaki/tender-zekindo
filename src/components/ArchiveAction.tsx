"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { restoreTender, deleteTenderPermanently } from "@/lib/actions";
import { Modal } from "./Modal";
export function ArchiveAction({
  tenderId,
  action,
}: {
  tenderId: string;
  action: "restore" | "delete";
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const label = action === "restore" ? "Restore" : "Delete permanently";
  function run() {
    setError("");
    start(async () => {
      const result = await (action === "restore"
        ? restoreTender(tenderId)
        : deleteTenderPermanently(tenderId));
      if (result?.error) setError(result.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }
  return (
    <>
      <button
        className={`button ${action === "restore" ? "button-secondary" : "button-danger"}`}
        disabled={pending}
        onClick={() => {
          if (action === "restore") run();
          else setOpen(true);
        }}
      >
        {pending ? "Working…" : label}
      </button>
      <Modal
        open={open}
        title="Permanently delete tender?"
        onClose={() => {
          if (!pending) setOpen(false);
        }}
      >
        <p className="muted">
          This removes the tender and its documents. This action cannot be
          undone.
        </p>
        <label className="field">
          Type DELETE to confirm
          <input
            className="control"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
          />
        </label>
        {error && (
          <p role="alert" className="feedback feedback-error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="button button-secondary"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            className="button button-danger"
            disabled={pending || typed !== "DELETE"}
            onClick={run}
          >
            Delete permanently
          </button>
        </div>
      </Modal>
      {error && !open && (
        <p role="alert" className="feedback feedback-error">
          {error}
        </p>
      )}
    </>
  );
}
