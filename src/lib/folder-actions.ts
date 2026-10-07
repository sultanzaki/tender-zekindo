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

  // Sequential upload (one at a time) to avoid Supabase free-plan rate limits.
  // See https://supabase.com/docs/guides/storage/uploads#file-limits
  // The parallel Promise.all approach hit rate limits with 2+ files.
  const paths: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const path = objectPath(tenderId, owner, i, files[i].name);
    paths.push(path);
    const buffer = new Uint8Array(await files[i].arrayBuffer());
    const { error } = await supabaseServer()
      .storage.from(DOCUMENT_BUCKET)
      .upload(path, buffer, { contentType: files[i].type || "application/octet-stream" });
    if (error) {
      // Batches that landed before this failure are removed again.
      const landed = paths.filter((_, j) => j < i);
      if (landed.length)
        await supabaseServer().storage.from(DOCUMENT_BUCKET).remove(landed);
      return { error: error.message };
    }
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

/** One prepared upload slot: a signed URL the client uses to upload direct to
 * Supabase Storage (bypassing Vercel's 4.5 MB function body limit). */
export interface UploadPrepItem {
  index: number;
  path: string;
  signedUrl: string;
  token: string;
  fileName: string;
  fileSize: number;
  contentType: string;
}

/** Generates signed upload URLs so the client can PUT files directly to
 * Supabase Storage. File data never passes through the server this way — no
 * Vercel body limit, no function timeout for large files. */
export async function prepareFileUpload(
  tenderId: string,
  target: FileTarget,
  files: { name: string; size: number; type: string }[]
): Promise<{ uploads: UploadPrepItem[] } | ActionError> {
  const ctx = await requireAdmin();

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

  const uploads = await Promise.all(
    files.map(async (file, i) => {
      const path = objectPath(tenderId, owner, i, file.name);
      const { data, error } = await supabaseServer()
        .storage.from(DOCUMENT_BUCKET)
        .createSignedUploadUrl(path, { upsert: false });
      if (error) throw new Error(error.message);
      return {
        index: i,
        path,
        signedUrl: data.signedUrl,
        token: data.token,
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type || "application/octet-stream",
      };
    })
  );

  return { uploads };
}

/** Registers already-uploaded files in the tender_files database row.
 * Call AFTER the client has PUT each file directly to its signed URL. */
export async function completeFileUpload(
  tenderId: string,
  target: FileTarget,
  uploaded: { path: string; fileName: string; size: number; contentType: string | null }[]
): Promise<ActionError | undefined> {
  const ctx = await requireAdmin();

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

  const { error } = await supabaseServer()
    .from("tender_files")
    .insert(
      uploaded.map((f) => ({
        tender_id: tenderId,
        folder_id: folderId,
        milestone_key: folderId ? null : milestoneKey,
        document_type_id: folderId ? null : documentTypeId,
        file_path: f.path,
        file_name: f.fileName,
        size_bytes: f.size,
        content_type: f.contentType || null,
        uploaded_by: ctx.userId,
      }))
    );
  if (error) return { error: error.message };

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
