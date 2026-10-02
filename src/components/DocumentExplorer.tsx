"use client";

import { useState, useTransition } from "react";
import {
  createDocumentFolder,
  deleteDocumentFolder,
  deleteTenderFile,
  renameDocumentFolder,
  uploadTenderFiles,
  type FileTarget,
} from "@/lib/folder-actions";
import type { DocumentFile, DocumentSection, DocumentTreeNode } from "@/lib/types";

function formatSize(bytes: number | null) {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** One folder and everything under it. Recursion is done with a component
 * rather than a flattened list so the indentation always matches the nesting. */
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

  // Accepts any action result: some return { id } on success, and narrowing the
  // signature per action here would just be noise.
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

  function handleUpload(section: DocumentSection, files: FileList | null, folderId?: string) {
    if (!files || !files.length) return;
    const formData = new FormData();
    for (const file of Array.from(files)) formData.append("files", file);
    run(() => uploadTenderFiles(tenderId, { ...target(section), folderId: folderId ?? null }, formData));
  }

  return (
    <div>
      {sections.map((section) => {
        const count = section.rootFiles.length + section.folders.length;
        // Milestone sections start collapsed when empty: there are a lot of them,
        // and an empty tree each is just noise.
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
                      disabled={pending}
                      onChange={(e) => {
                        handleUpload(section, e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    style={{ fontSize: 11.5 }}
                    disabled={pending}
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
                      disabled={pending || !rootName.trim()}
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
                    busy={pending}
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
                    busy={pending}
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

      {error && (
        <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--zk-error, #b91c1c)" }}>{error}</div>
      )}
    </div>
  );
}
