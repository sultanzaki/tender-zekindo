import "server-only";
import { unstable_cache } from "next/cache";
import { supabaseServer } from "./supabase-server";
import type { DocumentType, TenderDocument } from "./types";
import { DOCUMENT_TYPES_TAG } from "./cache-tags";

export const DOCUMENT_BUCKET = "tender-documents";

/** Admin-managed checklist definitions. Identical for every tender, but this
 * used to be re-queried on each tender page render (and once more inside
 * getTenderDocuments). Cached and invalidated by
 * `revalidateTag(DOCUMENT_TYPES_TAG)` from document-actions.ts. */
export const getDocumentTypes = unstable_cache(
  async (): Promise<DocumentType[]> => {
    const { data, error } = await supabaseServer()
      .from("document_types")
      .select("*")
      .is("archived_at", null)
      .order("created_at", { ascending: true });
    if (error)
      throw new Error(`Failed to load document types: ${error.message}`);
    return (data ?? []).map((r) => ({
      id: r.id,
      label: r.label,
      isDefault: r.is_default,
    }));
  },
  ["document-types:list"],
  { tags: [DOCUMENT_TYPES_TAG], revalidate: 300 },
);

export async function getTenderDocuments(
  tenderId: string,
): Promise<TenderDocument[]> {
  const [types, rowsRes] = await Promise.all([
    getDocumentTypes(),
    supabaseServer()
      .from("tender_documents")
      .select("*")
      .eq("tender_id", tenderId),
  ]);
  if (rowsRes.error)
    throw new Error(`Failed to load documents: ${rowsRes.error.message}`);
  const rows = rowsRes.data ?? [];

  // Index by type once: the previous version did rows.find() per type, which is
  // O(types x rows) for no reason.
  const rowByType = new Map(rows.map((r) => [r.document_type_id, r]));

  const paths = rows
    .map((row) => row.file_path)
    .filter((path): path is string => !!path);
  const signed = paths.length
    ? await supabaseServer()
        .storage.from(DOCUMENT_BUCKET)
        .createSignedUrls(paths, 300)
    : { data: [] };
  const urlByPath = new Map(
    (signed.data ?? []).map((item) => [item.path, item.signedUrl]),
  );
  return types.map((type): TenderDocument => {
    const row = rowByType.get(type.id);
    return {
      documentTypeId: type.id,
      label: type.label,
      checked: row?.checked ?? false,
      filePath: row?.file_path ?? null,
      fileName: row?.file_name ?? null,
      fileUrl: row?.file_path ? (urlByPath.get(row.file_path) ?? null) : null,
      updatedAt: row?.updated_at ?? null,
    };
  });
}
