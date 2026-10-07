"use client";

import { useState, useTransition } from "react";
import {
  createDocumentFolder,
  deleteDocumentFolder,
  deleteTenderFile,
  renameDocumentFolder,
  prepareFileUpload,
  completeFileUpload,
  type FileTarget,
  type UploadPrepItem,
} from "@/lib/folder-actions";
import type { DocumentFile, DocumentSection, DocumentTreeNode } from "@/lib/types";

function formatSize(bytes: number | null) {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Upload progress bar ────────────────────────────────── */
function UploadProgressBar({
  phase,
  pct,
  currentFile,
  totalBytes,
  uploadedBytes,
}: {
  phase: string;
  pct: number;
  currentFile: string;
  totalBytes: number;
  uploadedBytes: number;
}) {
  const label =
    phase === "preparing"
      ? "Menyiapkan…"
      : phase === "uploading"
        ? `Mengupload ${currentFile}…`
        : phase === "finalizing"
          ? "Menyimpan…"
          : phase === "done"
            ? "Selesai ✓"
            : "";

  if (phase === "idle" || phase === "error") return null;

  return (
    <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "#f1f5f9" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#334155", marginBottom: 4 }}>
        <span>{label}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: "#e2e8f0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 4,
            background: phase === "done" ? "#16a34a" : "#2563eb",
            transition: "width 0.3s ease",
          }}
        />
      </div>
      {totalBytes > 0 && (
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
          {formatSize(uploadedBytes)} / {formatSize(totalBytes)}
        </div>
      )}
    </div>
  );
}

/* ── Folder branch ──────────────────────────────────────── */
function FolderBranch({
  node,
  depth,
  isAdmin,
  busy,
  onUpload,
  onNewFolder,
  onRename,
  onDeleteFolder,
  onDeleteFile,
}: {
  node: DocumentTreeNode;
  depth: number;
  isAdmin: boolean;
  busy: boolean;
  onUpload: (folderId: string, files: FileList | null) => void;
  onNewFolder: (parentId: string, name: string) => void;
  onRename: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string, name: string) => void;
  onDeleteFile: (fileId: string, name: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(node.folder.name);

  const count = node.files.length + node.children.length;

  return (
    <div style={{ marginLeft: depth === 0 ? 0 : 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0" }}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{ border: "none", background: "none", cursor: "pointer", width: 16, padding: 0, color: "inherit" }}
          title={open ? "Collapse" : "Expand"}
        >
          {open ? "▾" : "▸"}
        </button>
        <span style={{ fontSize: 13 }}>📁</span>

        {renaming ? (
          <>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              style={{ flex: 1, fontSize: 13, padding: "2px 6px" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) {
                  onRename(node.folder.id, newName.trim());
                  setRenaming(false);
                }
                if (e.key === "Escape") setRenaming(false);
              }}
            />
            <button
              type="button"
              style={{ fontSize: 12 }}
              disabled={busy || !newName.trim()}
              onClick={() => {
                onRename(node.folder.id, newName.trim());
                setRenaming(false);
              }}
            >
              Save
            </button>
          </>
        ) : (
          <>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{node.folder.name}</span>
            <span style={{ fontSize: 11, opacity: 0.55 }}>{count ? `${count} item` : "kosong"}</span>
            {isAdmin && (
              <>
                <label style={{ fontSize: 11.5, cursor: "pointer", textDecoration: "underline" }}>
                  Upload
                  <input
                    type="file"
                    multiple
                    style={{ display: "none" }}
                    disabled={busy}
                    onChange={(e) => {
                      onUpload(node.folder.id, e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button type="button" style={{ fontSize: 11.5 }} disabled={busy} onClick={() => setAdding(true)}>
                  + Subfolder
                </button>
                <button type="button" style={{ fontSize: 11.5 }} disabled={busy} onClick={() => setRenaming(true)}>
                  Rename
                </button>
                <button
                  type="button"
                  style={{ fontSize: 11.5 }}
                  disabled={busy}
                  onClick={() => onDeleteFolder(node.folder.id, node.folder.name)}
                >
                  Hapus
                </button>
              </>
            )}
          </>
        )}
      </div>

      {open && (
        <div>
          {adding && (
            <div style={{ display: "flex", gap: 6, marginLeft: 32, padding: "3px 0" }}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama subfolder"
                autoFocus
                style={{ flex: 1, fontSize: 12.5, padding: "2px 6px" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim()) {
                    onNewFolder(node.folder.id, name.trim());
                    setName("");
                    setAdding(false);
                  }
                  if (e.key === "Escape") setAdding(false);
                }}
              />
              <button
                type="button"
                style={{ fontSize: 12 }}
                disabled={busy || !name.trim()}
                onClick={() => {
                  onNewFolder(node.folder.id, name.trim());
                  setName("");
                  setAdding(false);
                }}
              >
                Add
              </button>
            </div>
          )}

          {node.files.map((file) => (
            <FileRow key={file.id} file={file} depth={depth + 1} isAdmin={isAdmin} busy={busy} onDelete={onDeleteFile} />
          ))}

          {node.children.map((child) => (
            <FolderBranch
              key={child.folder.id}
              node={child}
              depth={depth + 1}
              isAdmin={isAdmin}
              busy={busy}
              onUpload={onUpload}
              onNewFolder={onNewFolder}
              onRename={onRename}
              onDeleteFolder={onDeleteFolder}
              onDeleteFile={onDeleteFile}
            />
          ))}

          {!adding && !node.files.length && !node.children.length && (
            <div style={{ marginLeft: 32, fontSize: 12, opacity: 0.5 }}>Folder kosong</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── File row ───────────────────────────────────────────── */
function FileRow({
  file,
  depth,
  isAdmin,
  busy,
  onDelete,
}: {
  file: DocumentFile;
  depth: number;
  isAdmin: boolean;
  busy: boolean;
  onDelete: (fileId: string, name: string) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0", marginLeft: depth === 0 ? 0 : 32 }}>
      <span style={{ fontSize: 12, opacity: 0.5 }}>📄</span>
      {file.fileUrl ? (
        <a
          href={file.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ flex: 1, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          title={file.fileName}
        >
          {file.fileName}
        </a>
      ) : (
        <span style={{ flex: 1, fontSize: 12.5 }} title="Signed URL gagal dibuat">
          {file.fileName}
        </span>
      )}
      <span style={{ fontSize: 11, opacity: 0.5 }}>{formatSize(file.sizeBytes)}</span>
      {isAdmin && (
        <button type="button" style={{ fontSize: 11.5 }} disabled={busy} onClick={() => onDelete(file.id, file.fileName)}>
          Hapus
        </button>
      )}
    </div>
  );
}

/* ── Upload progress state ──────────────────────────────── */
interface UploadProgress {
  phase: "idle" | "preparing" | "uploading" | "finalizing" | "done" | "error";
  pct: number;
  currentFile: string;
  totalBytes: number;
  uploadedBytes: number;
}

const IDLE_UPLOAD: UploadProgress = {
  phase: "idle",
  pct: 0,
  currentFile: "",
  totalBytes: 0,
  uploadedBytes: 0,
};

/* ── Main explorer ──────────────────────────────────────── */
export function DocumentExplorer({
  tenderId,
  sections,
  isAdmin,
}: {
  tenderId: string;
  sections: DocumentSection[];
  isAdmin: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [addingRoot, setAddingRoot] = useState<string | null>(null);
  const [rootName, setRootName] = useState("");
  const [upload, setUpload] = useState<UploadProgress>(IDLE_UPLOAD);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      const result = (await fn()) as { error?: string } | undefined;
      if (result?.error) setError(result.error);
    });
  }

  function target(section: DocumentSection): FileTarget {
    return {
      milestoneKey: section.milestoneKey,
      documentTypeId: section.documentTypeId,
    };
  }

  function isBusy() {
    return pending || upload.phase !== "idle";
  }

  async function handleUpload(section: DocumentSection, rawFiles: FileList | null, folderId?: string) {
    if (!rawFiles || !rawFiles.length) return;
    setError(null);

    const files = Array.from(rawFiles);
    const totalBytes = files.reduce((s, f) => s + f.size, 0);
    setUpload({
      phase: "preparing",
      pct: 0,
      currentFile: files[0]?.name || "",
      totalBytes,
      uploadedBytes: 0,
    });

    // 1. Get signed upload URLs from server
    const target_ = { ...target(section), folderId: folderId ?? null };
    const prep = await prepareFileUpload(
      tenderId,
      target_,
      files.map((f) => ({ name: f.name, size: f.size, type: f.type }))
    );
    if ("error" in prep) {
      setError(prep.error!);
      setUpload(IDLE_UPLOAD);
      return;
    }

    // 2. Upload each file directly to Supabase via XHR
    setUpload((u) => ({ ...u, phase: "uploading" }));
    let uploadedBytes = 0;
    const uploaded: { path: string; fileName: string; size: number; contentType: string | null }[] = [];

    for (const item of prep.uploads) {
      const file = files[item.index];
      if (!file) continue;

      setUpload((u) => ({ ...u, currentFile: item.fileName }));

      try {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (e) => {
            if (!e.lengthComputable) return;
            const fileLoaded = uploadedBytes + e.loaded;
            const pct = (fileLoaded / totalBytes) * 100;
            setUpload((u) => ({ ...u, pct, uploadedBytes: fileLoaded }));
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              uploadedBytes += file.size;
              setUpload((u) => ({ ...u, uploadedBytes }));
              uploaded.push({
                path: item.path,
                fileName: item.fileName,
                size: file.size,
                contentType: file.type || null,
              });
              resolve();
            } else {
              reject(new Error(`Upload gagal (HTTP ${xhr.status})`));
            }
          };
          xhr.onerror = () => reject(new Error("Gagal terhubung ke storage."));
          xhr.open("PUT", item.signedUrl);
          xhr.setRequestHeader("Content-Type", item.contentType);
          xhr.send(file);
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload gagal.");
        setUpload(IDLE_UPLOAD);
        return;
      }
    }

    // 3. Register files in database
    setUpload((u) => ({ ...u, phase: "finalizing", pct: 100 }));
    const result = await completeFileUpload(tenderId, target_, uploaded);
    if (result?.error) {
      setError(result.error);
      setUpload(IDLE_UPLOAD);
      return;
    }

    // 4. Done
    setUpload({ phase: "done", pct: 100, currentFile: "", totalBytes, uploadedBytes });
    setTimeout(() => setUpload(IDLE_UPLOAD), 2500);
  }

  const busy = isBusy();

  return (
    <div>
      {sections.map((section) => {
        const count = section.rootFiles.length + section.folders.length;
        const isCollapsed = collapsed[section.id] ?? (section.kind === "milestone" && count === 0);

        return (
          <div key={section.id} style={{ borderTop: "1px solid rgba(0,0,0,0.08)", padding: "6px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [section.id]: !isCollapsed }))}
                style={{ border: "none", background: "none", cursor: "pointer", width: 16, padding: 0, color: "inherit" }}
                title={isCollapsed ? "Expand" : "Collapse"}
              >
                {isCollapsed ? "▸" : "▾"}
              </button>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
                {section.title}
                <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, opacity: 0.55 }}>
                  {section.kind === "milestone" ? "milestone" : "checklist"} · {count ? `${count} item` : "kosong"}
                </span>
              </span>
              {isAdmin && (
                <>
                  <label style={{ fontSize: 11.5, cursor: "pointer", textDecoration: "underline" }}>
                    Upload
                    <input
                      type="file"
                      multiple
                      style={{ display: "none" }}
                      disabled={busy}
                      onChange={(e) => {
                        handleUpload(section, e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    style={{ fontSize: 11.5 }}
                    disabled={busy}
                    onClick={() => {
                      setAddingRoot(section.id);
                      setRootName("");
                    }}
                  >
                    + Folder
                  </button>
                </>
              )}
            </div>

            {!isCollapsed && (
              <div style={{ marginLeft: 22, marginTop: 4 }}>
                {addingRoot === section.id && (
                  <div style={{ display: "flex", gap: 6, padding: "3px 0" }}>
                    <input
                      value={rootName}
                      onChange={(e) => setRootName(e.target.value)}
                      placeholder="Nama folder"
                      autoFocus
                      style={{ flex: 1, fontSize: 12.5, padding: "2px 6px" }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && rootName.trim()) {
                          run(() => createDocumentFolder(tenderId, rootName.trim(), target(section)));
                          setAddingRoot(null);
                        }
                        if (e.key === "Escape") setAddingRoot(null);
                      }}
                    />
                    <button
                      type="button"
                      style={{ fontSize: 12 }}
                      disabled={busy || !rootName.trim()}
                      onClick={() => {
                        run(() => createDocumentFolder(tenderId, rootName.trim(), target(section)));
                        setAddingRoot(null);
                      }}
                    >
                      Add
                    </button>
                  </div>
                )}

                {section.rootFiles.map((file) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    depth={1}
                    isAdmin={isAdmin}
                    busy={busy}
                    onDelete={(id, name) => {
                      if (confirm(`Hapus "${name}"?`)) run(() => deleteTenderFile(id));
                    }}
                  />
                ))}

                {section.folders.map((node) => (
                  <FolderBranch
                    key={node.folder.id}
                    node={node}
                    depth={0}
                    isAdmin={isAdmin}
                    busy={busy}
                    onUpload={(folderId, files) => handleUpload(section, files, folderId)}
                    onNewFolder={(parentId, name) => run(() => createDocumentFolder(tenderId, name, { folderId: parentId }))}
                    onRename={(folderId, name) => run(() => renameDocumentFolder(folderId, name))}
                    onDeleteFolder={(folderId, name) => {
                      if (confirm(`Hapus folder "${name}" beserta semua file di dalamnya?`)) {
                        run(() => deleteDocumentFolder(folderId));
                      }
                    }}
                    onDeleteFile={(id, name) => {
                      if (confirm(`Hapus "${name}"?`)) run(() => deleteTenderFile(id));
                    }}
                  />
                ))}

                {!section.rootFiles.length && !section.folders.length && addingRoot !== section.id && (
                  <div style={{ fontSize: 12, opacity: 0.5 }}>Belum ada dokumen.</div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <UploadProgressBar
        phase={upload.phase}
        pct={upload.pct}
        currentFile={upload.currentFile}
        totalBytes={upload.totalBytes}
        uploadedBytes={upload.uploadedBytes}
      />

      {error && (
        <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--zk-error, #b91c1c)" }}>{error}</div>
      )}
    </div>
  );
}