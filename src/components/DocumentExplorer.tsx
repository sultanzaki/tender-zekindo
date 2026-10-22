"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createDocumentFolder,
  renameDocumentFolder,
  deleteDocumentFolder,
  deleteTenderFile,
  prepareFileUpload,
  completeFileUpload,
  cancelPreparedUploads,
  type FileTarget,
} from "@/lib/folder-actions";
import type {
  DocumentFile,
  DocumentSection,
  DocumentTreeNode,
} from "@/lib/types";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_FILES } from "@/lib/upload-policy";
import { Modal } from "./Modal";
import styles from "./DocumentExplorer.module.css";
function size(bytes: number | null) {
  if (bytes === null) return "";
  return bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
type Intent =
  | { action: "create"; target: FileTarget }
  | { action: "rename"; id: string; name: string }
  | { action: "delete-folder" | "delete-file"; id: string; name: string };
function UploadButton({
  busy,
  onFiles,
}: {
  busy: boolean;
  onFiles: (files: FileList) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        className="button button-secondary"
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        Upload files
      </button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        disabled={busy}
        onChange={(e) => {
          if (e.target.files) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}
function Files({
  files,
  isAdmin,
  busy,
  onDelete,
}: {
  files: DocumentFile[];
  isAdmin: boolean;
  busy: boolean;
  onDelete: (file: DocumentFile) => void;
}) {
  return (
    <>
      {files.map((file) => (
        <div key={file.id} className={styles.file}>
          {file.fileUrl ? (
            <a href={file.fileUrl} target="_blank" rel="noopener noreferrer">
              {file.fileName}
            </a>
          ) : (
            <span>
              {file.fileName} <small>Link unavailable; refresh to retry.</small>
            </span>
          )}
          <small>{size(file.sizeBytes)}</small>
          {isAdmin && (
            <button
              disabled={busy}
              type="button"
              aria-label={`Delete ${file.fileName}`}
              onClick={() => onDelete(file)}
            >
              Delete
            </button>
          )}
        </div>
      ))}
    </>
  );
}
export function DocumentExplorer({
  tenderId,
  sections,
  isAdmin,
}: {
  tenderId: string;
  sections: DocumentSection[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, start] = useTransition();
  const [upload, setUpload] = useState<{ name: string; pct: number } | null>(
    null,
  );
  const busy = pending || upload !== null;
  function target(section: DocumentSection): FileTarget {
    return {
      milestoneKey: section.milestoneKey,
      documentTypeId: section.documentTypeId,
    };
  }
  function open(next: Intent) {
    setError("");
    setIntent(next);
    setName(next.action === "rename" ? next.name : "");
  }
  function execute() {
    if (!intent) return;
    const next = intent;
    setError("");
    start(async () => {
      try {
        const result = await (next.action === "create"
          ? createDocumentFolder(tenderId, name, next.target)
          : next.action === "rename"
            ? renameDocumentFolder(next.id, name)
            : next.action === "delete-file"
              ? deleteTenderFile(next.id)
              : deleteDocumentFolder(next.id));
        if (result && "error" in result && result.error) {
          setError(result.error);
          return;
        }
        setIntent(null);
        setNotice("Document workspace updated.");
      } catch {
        setError("The change could not be saved. Please try again.");
      }
    });
  }
  async function handleUpload(where: FileTarget, raw: FileList) {
    if (busy || !raw.length) return;
    const files = Array.from(raw);
    setError("");
    setNotice("");
    if (
      files.length > MAX_UPLOAD_FILES ||
      files.some((f) => !f.size || f.size > MAX_UPLOAD_BYTES)
    ) {
      setError(
        "Choose up to 50 non-empty files, with a maximum of 5 MB per file.",
      );
      return;
    }
    let prepared: string[] = [];
    let registered = false;
    try {
      setUpload({ name: "Preparing files…", pct: 0 });
      const prep = await prepareFileUpload(
        tenderId,
        where,
        files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
      );
      if ("error" in prep) throw new Error(prep.error);
      prepared = prep.uploads.map((item) => item.path);
      const uploaded = [];
      const total = files.reduce((sum, f) => sum + f.size, 0);
      let sent = 0;
      for (const item of prep.uploads) {
        const file = files[item.index];
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", item.signedUrl);
          xhr.setRequestHeader("Content-Type", item.contentType);
          xhr.timeout = 120000;
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable)
              setUpload({
                name: file.name,
                pct: Math.min(98, Math.round(((sent + e.loaded) / total) * 98)),
              });
          };
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error(`Upload failed (HTTP ${xhr.status}).`));
          xhr.onerror = () =>
            reject(
              new Error("Could not reach storage. Check your connection."),
            );
          xhr.ontimeout = () =>
            reject(new Error("Upload timed out. Please try again."));
          xhr.onabort = () => reject(new Error("Upload canceled."));
          xhr.send(file);
        });
        sent += file.size;
        uploaded.push({
          path: item.path,
          fileName: file.name,
          size: file.size,
          contentType: file.type || null,
        });
      }
      setUpload({ name: "Saving file records…", pct: 99 });
      const result = await completeFileUpload(tenderId, where, uploaded);
      if (result?.error) throw new Error(result.error);
      registered = true;
      setNotice(
        `${files.length} file${files.length === 1 ? "" : "s"} uploaded.`,
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Upload failed. Please try again.",
      );
      if (prepared.length && !registered) {
        try {
          await cancelPreparedUploads(tenderId, prepared);
        } catch {
          /* A cleanup failure does not hide the original upload error. */
        }
      }
    } finally {
      setUpload(null);
    }
  }
  function deleteFile(file: DocumentFile) {
    open({ action: "delete-file", id: file.id, name: file.fileName });
  }
  function folder(node: DocumentTreeNode, depth = 0): React.ReactNode {
    return (
      <details key={node.folder.id} className={styles.folder}>
        <summary>
          {node.folder.name}{" "}
          <span className="muted">
            · {node.files.length + node.children.length} items
          </span>
        </summary>
        <div className={styles.folderBody}>
          {isAdmin && (
            <div className={styles.actions}>
              <UploadButton
                busy={busy}
                onFiles={(files) =>
                  void handleUpload({ folderId: node.folder.id }, files)
                }
              />
              <button
                className="button button-secondary"
                disabled={busy}
                onClick={() =>
                  open({
                    action: "create",
                    target: { folderId: node.folder.id },
                  })
                }
              >
                New subfolder
              </button>
              <button
                className="button button-secondary"
                disabled={busy}
                onClick={() =>
                  open({
                    action: "rename",
                    id: node.folder.id,
                    name: node.folder.name,
                  })
                }
              >
                Rename
              </button>
              <button
                className="button button-danger"
                disabled={busy}
                onClick={() =>
                  open({
                    action: "delete-folder",
                    id: node.folder.id,
                    name: node.folder.name,
                  })
                }
              >
                Delete folder
              </button>
            </div>
          )}
          <Files
            files={node.files}
            isAdmin={isAdmin}
            busy={busy}
            onDelete={deleteFile}
          />
          {depth < 30 && node.children.map((child) => folder(child, depth + 1))}
          {!node.files.length && !node.children.length && (
            <p className={styles.empty}>This folder is empty.</p>
          )}
        </div>
      </details>
    );
  }
  const needle = query.trim().toLowerCase();
  const visible = sections.filter(
    (section) =>
      !needle ||
      `${section.title} ${JSON.stringify(section.rootFiles.map((f) => f.fileName))} ${JSON.stringify(section.folders)}`
        .toLowerCase()
        .includes(needle),
  );
  return (
    <div ref={container}>
      <p className="muted">
        Files up to 5 MB each · up to 50 per upload. Expand a section to view or
        add files.
      </p>
      <div className={styles.toolbar}>
        <button
          type="button"
          className="button button-secondary"
          disabled={busy}
          onClick={() => start(() => router.refresh())}
        >
          Refresh links
        </button>
        <input
          className="control"
          type="search"
          aria-label="Search documents"
          placeholder="Search sections, folders, or files"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="button button-secondary"
          onClick={() =>
            container.current
              ?.querySelectorAll("details")
              .forEach((d) => (d.open = true))
          }
        >
          Expand all
        </button>
        <button
          className="button button-secondary"
          onClick={() =>
            container.current
              ?.querySelectorAll("details")
              .forEach((d) => (d.open = false))
          }
        >
          Collapse all
        </button>
      </div>
      {error && !intent && (
        <p role="alert" className="feedback feedback-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="feedback feedback-success">
          {notice}
        </p>
      )}
      {upload && (
        <div className={styles.progress}>
          <div className={styles.status}>
            <span>{upload.name}</span>
            <span>{upload.pct}%</span>
          </div>
          <progress aria-label="File upload" max={100} value={upload.pct} />
        </div>
      )}
      {visible.map((section) => (
        <details
          key={section.id}
          className={styles.section}
          open={needle ? true : undefined}
        >
          <summary>
            <strong>{section.title}</strong>
            <small>
              {section.kind} ·{" "}
              {section.rootFiles.length + section.folders.length} items
            </small>
          </summary>
          <div className={styles.sectionBody}>
            {isAdmin && (
              <div className={styles.actions}>
                <UploadButton
                  busy={busy}
                  onFiles={(files) => void handleUpload(target(section), files)}
                />
                <button
                  className="button button-secondary"
                  disabled={busy}
                  onClick={() =>
                    open({ action: "create", target: target(section) })
                  }
                >
                  New folder
                </button>
              </div>
            )}
            <Files
              files={section.rootFiles}
              isAdmin={isAdmin}
              busy={busy}
              onDelete={deleteFile}
            />
            {section.folders.map((node) => folder(node))}
            {!section.rootFiles.length && !section.folders.length && (
              <p className={styles.empty}>No files in this section.</p>
            )}
          </div>
        </details>
      ))}
      {!visible.length && (
        <p className={styles.empty}>No matching document sections.</p>
      )}
      <Modal
        open={intent !== null}
        title={
          intent?.action === "create"
            ? "New folder"
            : intent?.action === "rename"
              ? "Rename folder"
              : "Delete document item?"
        }
        onClose={() => {
          if (!pending) setIntent(null);
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            execute();
          }}
        >
          {intent &&
          (intent.action === "create" || intent.action === "rename") ? (
            <label className="field">
              Folder name
              <input
                className="control"
                required
                maxLength={150}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          ) : (
            <p className="muted">
              Delete “{intent && "name" in intent ? intent.name : ""}”
              {intent?.action === "delete-folder"
                ? " and all its files and subfolders"
                : ""}
              ? This cannot be undone.
            </p>
          )}
          {error && (
            <p role="alert" className="feedback feedback-error">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              type="button"
              className="button button-secondary"
              disabled={pending}
              onClick={() => setIntent(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`button ${intent?.action.startsWith("delete") ? "button-danger" : "button-primary"}`}
              disabled={
                pending ||
                ((intent?.action === "create" || intent?.action === "rename") &&
                  !name.trim())
              }
            >
              {pending
                ? "Saving…"
                : intent?.action.startsWith("delete")
                  ? "Confirm delete"
                  : "Save folder"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
