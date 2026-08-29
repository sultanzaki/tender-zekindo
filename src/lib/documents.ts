import "server-only";
import { supabaseServer } from "./supabase-server";
import type { DocumentType, TenderDocument } from "./types";

export const DOCUMENT_BUCKET = "tender-documents";

export async function getDocumentTypes(): Promise<DocumentType[]> {
  const { data, error } = await supabaseServer()
    .from("document_types")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load document types: ${error.message}`);
  return (data ?? []).map((r) => ({ id: r.id, label: r.label, isDefault: r.is_default }));
}

export async function getTenderDocuments(tenderId: string): Promise<TenderDocument[]> {
  const [types, rowsRes] = await Promise.all([
    getDocumentTypes(),
    supabaseServer().from("tender_documents").select("*").eq("tender_id", tenderId),
  ]);
  if (rowsRes.error) throw new Error(`Failed to load documents: ${rowsRes.error.message}`);
  const rows = rowsRes.data ?? [];

  const results: TenderDocument[] = [];
  for (const type of types) {
    const row = rows.find((r) => r.document_type_id === type.id);
    let fileUrl: string | null = null;
    if (row?.file_path) {
      const { data: signed } = await supabaseServer()
        .storage.from(DOCUMENT_BUCKET)
        .createSignedUrl(row.file_path, 300);
      fileUrl = signed?.signedUrl ?? null;
    }
    results.push({
      documentTypeId: type.id,
      label: type.label,
      checked: row?.checked ?? false,
      filePath: row?.file_path ?? null,
      fileName: row?.file_name ?? null,
      fileUrl,
      updatedAt: row?.updated_at ?? null,
    });
  }
  return results;
}
