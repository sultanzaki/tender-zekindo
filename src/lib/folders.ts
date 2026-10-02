import "server-only";
import { supabaseServer } from "./supabase-server";
import { DOCUMENT_BUCKET } from "./documents";
import type { DocumentFile, DocumentFolder, DocumentSection, DocumentTreeNode } from "./types";

/** A file plus where it sits. `folderId` wins when set; otherwise the file is at
 * the root of the tree named by `milestoneKey` / `documentTypeId`. */
export interface TenderFileRow extends DocumentFile {
  folderId: string | null;
  milestoneKey: string | null;
  documentTypeId: string | null;
}

export interface TenderFileTree {
  folders: DocumentFolder[];
  files: TenderFileRow[];
}

/** What the K in a section is: a milestone, or a checklist item. */
export interface SectionDescriptor {
  id: string;
  title: string;
  kind: "milestone" | "checklist";
  milestoneKey: string | null;
  documentTypeId: string | null;
}

/**
 * Every folder and file of one tender, with signed URLs already attached.
 *
 * Two queries total, regardless of how many documents there are or how deep the
 * folders nest: the tree is assembled in JS by buildDocumentSections(). The
 * signed URLs are the one call per file that cannot be avoided (the bucket is
 * private), but they are issued together instead of one after another — doing
 * that sequentially is what made the old detail page pay a round trip to
 * Singapore per attachment.
 */
export async function getTenderFileTree(tenderId: string): Promise<TenderFileTree> {
  const [foldersRes, filesRes] = await Promise.all([
    supabaseServer()
      .from("tender_folders")
      .select("*")
      .eq("tender_id", tenderId)
      .order("name", { ascending: true }),
    supabaseServer()
      .from("tender_files")
      .select("*")
      .eq("tender_id", tenderId)
      .order("file_name", { ascending: true }),
  ]);

  // Thrown, not swallowed: an empty document panel would look like the files
  // were deleted, which is far worse than an error page.
  if (foldersRes.error) throw new Error(`Failed to load document folders: ${foldersRes.error.message}`);
  if (filesRes.error) throw new Error(`Failed to load documents: ${filesRes.error.message}`);

  const folderRows = foldersRes.data ?? [];
  const fileRows = filesRes.data ?? [];

  const urls = await Promise.all(
    fileRows.map(async (row) => {
      const { data } = await supabaseServer().storage.from(DOCUMENT_BUCKET).createSignedUrl(row.file_path, 300);
      return [row.id, data?.signedUrl ?? null] as const;
    })
  );
  const urlById = new Map(urls);

  return {
    folders: folderRows.map((r) => ({
      id: r.id,
      parentId: r.parent_id,
      name: r.name,
      milestoneKey: r.milestone_key,
      documentTypeId: r.document_type_id,
    })),
    files: fileRows.map((r) => ({
      id: r.id,
      folderId: r.folder_id,
      milestoneKey: r.milestone_key,
      documentTypeId: r.document_type_id,
      fileName: r.file_name,
      fileUrl: urlById.get(r.id) ?? null,
      sizeBytes: r.size_bytes,
      createdAt: r.created_at,
    })),
  };
}

/** Files and folders are sorted here, not in SQL, so both trees keep the same
 * order without a second round trip. */
function byName<T extends { name?: string; fileName?: string }>(a: T, b: T) {
  const left = a.name ?? a.fileName ?? "";
  const right = b.name ?? b.fileName ?? "";
  return left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
}

/**
 * Turns the flat tree into one section per descriptor, nesting folders by
 * parentId. Pure — no I/O — so it can be reasoned about (and tested) on its own.
 *
 * A folder whose parent is missing from its own section is treated as a root
 * rather than dropped: silently losing a folder would hide the files inside it.
 */
export function buildDocumentSections(
  tree: TenderFileTree,
  descriptors: SectionDescriptor[]
): DocumentSection[] {
  return descriptors.map((descriptor) => {
    const belongs = (folder: DocumentFolder) =>
      descriptor.kind === "milestone"
        ? folder.milestoneKey === descriptor.milestoneKey
        : folder.documentTypeId === descriptor.documentTypeId;

    const own = tree.folders.filter(belongs);
    const ownIds = new Set(own.map((f) => f.id));

    const childrenOf = new Map<string | null, DocumentFolder[]>();
    for (const folder of own) {
      const parentKey = folder.parentId && ownIds.has(folder.parentId) ? folder.parentId : null;
      const bucket = childrenOf.get(parentKey) ?? [];
      bucket.push(folder);
      childrenOf.set(parentKey, bucket);
    }
    for (const bucket of childrenOf.values()) bucket.sort(byName);

    const filesOf = new Map<string, DocumentFile[]>();
    const rootFiles: DocumentFile[] = [];
    for (const file of tree.files) {
      if (file.folderId && ownIds.has(file.folderId)) {
        const bucket = filesOf.get(file.folderId) ?? [];
        bucket.push(file);
        filesOf.set(file.folderId, bucket);
      } else if (
        !file.folderId &&
        (descriptor.kind === "milestone"
          ? file.milestoneKey === descriptor.milestoneKey
          : file.documentTypeId === descriptor.documentTypeId)
      ) {
        rootFiles.push(file);
      }
    }
    for (const bucket of filesOf.values()) bucket.sort(byName);
    rootFiles.sort(byName);

    const build = (parentId: string | null): DocumentTreeNode[] =>
      (childrenOf.get(parentId) ?? []).map((folder) => ({
        folder,
        children: build(folder.id),
        files: filesOf.get(folder.id) ?? [],
      }));

    return {
      ...descriptor,
      folders: build(null),
      rootFiles,
    };
  });
}
