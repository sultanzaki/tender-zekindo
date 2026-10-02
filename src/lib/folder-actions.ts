"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth/dal";
import { supabaseServer } from "./supabase-server";
import { DOCUMENT_BUCKET } from "./documents";
import type { ActionError } from "./actions";

/** Where a file goes. `folderId` wins when set; otherwise the file lands at the
 * root of the tree named by milestoneKey / documentTypeId. */
export interface FileTarget {
  folderId?: string | null;
  milestoneKey?: string | null;
  documentTypeId?: string | null;
}

/** A filename cannot contain a path separator or the object key would escape the
 * folder it was meant to go in. */
function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Object key for one file. The index keeps two files with the same name in one
 * batch from overwriting each other, and the timestamp keeps a re-upload of the
 * same name from colliding with the previous one. */
function objectPath(tenderId: string, owner: string, index: number, fileName: string) {
  return `${tenderId}/${owner}-${Date.now()}-${index}-${safeFileName(fileName)}`;
}

/** Reads the folder and confirms it belongs to this tender. Returns the owner
 * columns so a subfolder or a file can inherit them — that way the two trees can
 * never get crossed, even if the caller passes a mismatched target. */
interface FolderLookup {
  folder: {
    id: string;
    tender_id: string;
    milestone_key: string | null;
    document_type_id: string | null;
  } | null;
  error?: string;
}

async function resolveFolder(tenderId: string, folderId: string): Promise<FolderLookup> {
  const { data, error } = await supabaseServer()
    .from("tender_folders")
    .select("id, tender_id, milestone_key, document_type_id")
    .eq("id", folderId)
    .maybeSingle();
  if (error) return { folder: null, error: error.message };
  if (!data) return { folder: null, error: "Folder tidak ditemukan." };
  if (data.tender_id !== tenderId) return { folder: null, error: "Folder itu milik tender lain." };
  return { folder: data };
}

export async function createDocumentFolder(
  tenderId: string,
  name: string,
  target: FileTarget
): Promise<ActionError | { id: string }> {
  const ctx = await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Nama folder tidak boleh kosong." };

  if (target.folderId) {
    const resolved = await resolveFolder(tenderId, target.folderId);
    if (resolved.error || !resolved.folder) return { error: resolved.error ?? "Folder tidak ditemukan." };
    const { error } = await supabaseServer().from("tender_folders").insert({
      tender_id: tenderId,
      name: trimmed,
      parent_id: target.folderId,
      milestone_key: resolved.folder.milestone_key,
      document_type_id: resolved.folder.document_type_id,
      created_by: ctx.userId,
    });
    if (error) return { error: error.message };
  } else {
    if (!target.milestoneKey && !target.documentTypeId) {
      return { error: "Folder harus punya induk: sebuah milestone atau satu item checklist." };
    }
    const { error } = await supabaseServer().from("tender_folders").insert({
      tender_id: tenderId,
      name: trimmed,
      parent_id: null,
      milestone_key: target.milestoneKey ?? null,
      document_type_id: target.documentTypeId ?? null,
      created_by: ctx.userId,
    });
    if (error) return { error: error.message };
  }

  revalidatePath(`/tenders/${tenderId}`);
  return { id: "" };
}

export async function renameDocumentFolder(folderId: string, name: string): Promise<ActionError | undefined> {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Nama folder tidak boleh kosong." };

  const { data, error } = await supabaseServer()
    .from("tender_folders")
    .update({ name: trimmed })
    .eq("id", folderId)
    .select("tender_id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Folder tidak ditemukan." };

  revalidatePath(`/tenders/${data.tender_id}`);
}

export async function uploadTenderFiles(
  tenderId: string,
  target: FileTarget,
  formData: FormData
): Promise<ActionError | undefined> {
  const ctx = await requireAdmin();

  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: "Pilih minimal satu file." };

  const folderId: string | null = target.folderId ?? null;
  let milestoneKey: string | null = target.milestoneKey ?? null;
  let documentTypeId: string | null = target.documentTypeId ?? null;

  if (folderId) {
    const resolved = await resolveFolder(tenderId, folderId);
    if (resolved.error || !resolved.folder) return { error: resolved.error ?? "Folder tidak ditemukan." };
    milestoneKey = resolved.folder.milestone_key;
    documentTypeId = resolved.folder.document_type_id;
  } else if (!milestoneKey && !documentTypeId) {
    return { error: "File harus punya induk: sebuah milestone atau satu item checklist." };
  }

  const owner = folderId ?? milestoneKey ?? documentTypeId ?? "root";

  // Uploaded together: they are independent, and one at a time is what made the
  // old page slow. If ANY of them fails, the ones that already landed are
  // removed again — a half-uploaded batch is worse than none, because the user
  // cannot tell which half arrived.
  const paths = files.map((file, i) => objectPath(tenderId, owner, i, file.name));
  const results = await Promise.all(
    files.map(async (file, i) => {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const { error } = await supabaseServer()
        .storage.from(DOCUMENT_BUCKET)
        .upload(paths[i], buffer, { contentType: file.type || "application/octet-stream" });
      return error;
    })
  );

  const failedAt = results.findIndex((e) => e);
  if (failedAt !== -1) {
    const landed = paths.filter((_, i) => !results[i]);
    if (landed.length) await supabaseServer().storage.from(DOCUMENT_BUCKET).remove(landed);
    return { error: results[failedAt]!.message };
  }

  const { error } = await supabaseServer()
    .from("tender_files")
    .insert(
      files.map((file, i) => ({
        tender_id: tenderId,
        folder_id: folderId,
        milestone_key: folderId ? null : milestoneKey,
        document_type_id: folderId ? null : documentTypeId,
        file_path: paths[i],
        file_name: file.name,
        size_bytes: file.size,
        content_type: file.type || null,
        uploaded_by: ctx.userId,
      }))
    );
  if (error) {
    // Rows failed after the objects landed: take the objects back out so the
    // bucket does not accumulate files nothing points at.
    await supabaseServer().storage.from(DOCUMENT_BUCKET).remove(paths);
    return { error: error.message };
  }

  revalidatePath(`/tenders/${tenderId}`);
}

export async function deleteTenderFile(fileId: string): Promise<ActionError | undefined> {
  await requireAdmin();

  const { data: row, error } = await supabaseServer()
    .from("tender_files")
    .select("id, tender_id, file_path")
    .eq("id", fileId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!row) return { error: "File tidak ditemukan." };

  const { error: deleteError } = await supabaseServer().from("tender_files").delete().eq("id", fileId);
  if (deleteError) return { error: deleteError.message };

  await supabaseServer().storage.from(DOCUMENT_BUCKET).remove([row.file_path]);
  revalidatePath(`/tenders/${row.tender_id}`);
}

/**
 * Deletes a folder, everything inside it, and every file object in Storage.
 *
 * The row deletions would cascade on their own, but the Storage objects would
 * not: they would stay in the bucket with nothing pointing at them, quietly
 * costing money and never being reachable again. So the paths are collected
 * first, the objects removed, and only then the row.
 */
export async function deleteDocumentFolder(folderId: string): Promise<ActionError | undefined> {
  await requireAdmin();

  const { data: folder, error } = await supabaseServer()
    .from("tender_folders")
    .select("id, tender_id")
    .eq("id", folderId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!folder) return { error: "Folder tidak ditemukan." };

  // Walk the flat list in JS instead of a recursive query: one round trip and no
  // depth limit.
  const { data: allFolders, error: foldersError } = await supabaseServer()
    .from("tender_folders")
    .select("id, parent_id")
    .eq("tender_id", folder.tender_id);
  if (foldersError) return { error: foldersError.message };

  const childrenOf = new Map<string, string[]>();
  for (const f of allFolders ?? []) {
    if (!f.parent_id) continue;
    const bucket = childrenOf.get(f.parent_id) ?? [];
    bucket.push(f.id);
    childrenOf.set(f.parent_id, bucket);
  }

  const doomed = [folderId];
  for (let i = 0; i < doomed.length; i++) {
    for (const child of childrenOf.get(doomed[i]) ?? []) doomed.push(child);
  }

  const { data: files, error: filesError } = await supabaseServer()
    .from("tender_files")
    .select("file_path")
    .in("folder_id", doomed);
  if (filesError) return { error: filesError.message };

  const paths = (files ?? []).map((f) => f.file_path);
  if (paths.length) {
    const { error: storageError } = await supabaseServer().storage.from(DOCUMENT_BUCKET).remove(paths);
    // Deleting the rows anyway would leave the objects unreachable forever, so
    // stop and report instead.
    if (storageError) return { error: `Gagal menghapus file di folder ini: ${storageError.message}` };
  }

  const { error: deleteError } = await supabaseServer().from("tender_folders").delete().eq("id", folderId);
  if (deleteError) return { error: deleteError.message };

  revalidatePath(`/tenders/${folder.tender_id}`);
}
