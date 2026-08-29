"use client";

import { useState, useTransition } from "react";
import { addDocumentType, removeTenderDocumentFile, toggleTenderDocument, uploadTenderDocument } from "@/lib/document-actions";
import type { TenderDocument } from "@/lib/types";
import styles from "./DocumentChecklist.module.css";

export function DocumentChecklist({
  tenderId,
  documents,
  isAdmin,
}: {
  tenderId: string;
  documents: TenderDocument[];
  isAdmin: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  function handleToggle(documentTypeId: string, checked: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await toggleTenderDocument(tenderId, documentTypeId, checked);
      if (result?.error) setError(result.error);
    });
  }

  function handleFileChange(documentTypeId: string, file: File | undefined) {
    if (!file) return;
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadTenderDocument(tenderId, documentTypeId, formData);
      if (result?.error) setError(result.error);
    });
  }

  function handleRemoveFile(documentTypeId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeTenderDocumentFile(tenderId, documentTypeId);
      if (result?.error) setError(result.error);
    });
  }

  function handleAddType() {
    setError(null);
    startTransition(async () => {
      const result = await addDocumentType(newLabel, tenderId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setNewLabel("");
      setShowAdd(false);
    });
  }

  return (
    <div>
      {documents.map((doc) => (
        <div key={doc.documentTypeId} className={styles.row}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={doc.checked}
            disabled={!isAdmin || isPending}
            onChange={(e) => handleToggle(doc.documentTypeId, e.target.checked)}
          />
          <span className={styles.label}>{doc.label}</span>
          {doc.fileUrl && doc.fileName ? (
            <>
              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className={styles.fileLink} title={doc.fileName}>
                {doc.fileName}
              </a>
              {isAdmin && (
                <button className={styles.removeLink} onClick={() => handleRemoveFile(doc.documentTypeId)} disabled={isPending}>
                  Remove
                </button>
              )}
            </>
          ) : (
            isAdmin && (
              <label className={styles.uploadLabel}>
                Upload
                <input type="file" onChange={(e) => handleFileChange(doc.documentTypeId, e.target.files?.[0])} />
              </label>
            )
          )}
        </div>
      ))}

      {isAdmin && (
        <>
          {showAdd ? (
            <div className={styles.addRow}>
              <input
                className={styles.addInput}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="New document type name"
                autoFocus
              />
              <button className={styles.addButton} onClick={handleAddType} disabled={isPending || !newLabel.trim()}>
                Add
              </button>
              <button
                className={styles.addButton}
                onClick={() => {
                  setShowAdd(false);
                  setNewLabel("");
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button className={styles.addToggle} onClick={() => setShowAdd(true)}>
              + Add document type
            </button>
          )}
        </>
      )}

      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}
