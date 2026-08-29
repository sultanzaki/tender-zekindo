"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth/dal";
import { supabaseServer } from "./supabase-server";
import { DOCUMENT_BUCKET } from "./documents";
import type { ActionError } from "./actions";

export async function addDocumentType(
  label: string,
  currentTenderId?: string
): Promise<{ error?: string; id?: string; label?: string }> {
  const ctx = await requireAdmin();
  const trimmed = label.trim();
  if (!trimmed) return { error: "Document type name can't be empty." };

  const { data, error } = await supabaseServer()
    .from("document_types")
    .insert({ label: trimmed, is_default: false, created_by: ctx.userId })
    .select("id, label")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "A document type with this name already exists." };
    return { error: error.message };
  }

  if (currentTenderId) revalidatePath(`/tenders/${currentTenderId}`);
  return { id: data.id, label: data.label };
}

async function findDocumentRow(tenderId: string, documentTypeId: string) {
  return supabaseServer()
    .from("tender_documents")
    .select("*")
    .eq("tender_id", tenderId)
    .eq("document_type_id", documentTypeId)
    .maybeSingle();
}

export async function toggleTenderDocument(
  tenderId: string,
  documentTypeId: string,
  checked: boolean
): Promise<ActionError | undefined> {
  const ctx = await requireAdmin();

  const { data: existing, error: findError } = await findDocumentRow(tenderId, documentTypeId);
  if (findError) return { error: findError.message };

  if (existing) {
    const { error } = await supabaseServer()
      .from("tender_documents")
      .update({ checked, updated_by: ctx.userId, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabaseServer()
      .from("tender_documents")
      .insert({ tender_id: tenderId, document_type_id: documentTypeId, checked, updated_by: ctx.userId });
    if (error) return { error: error.message };
  }

  revalidatePath(`/tenders/${tenderId}`);
}

export async function uploadTenderDocument(
  tenderId: string,
  documentTypeId: string,
  formData: FormData
): Promise<ActionError | undefined> {
  const ctx = await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file first." };

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${tenderId}/${documentTypeId}-${Date.now()}-${safeName}`;
  const buffer = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabaseServer()
    .storage.from(DOCUMENT_BUCKET)
    .upload(path, buffer, { contentType: file.type || "application/octet-stream" });
  if (uploadError) return { error: uploadError.message };

  const { data: existing, error: findError } = await findDocumentRow(tenderId, documentTypeId);
  if (findError) return { error: findError.message };

  const patch = {
    file_path: path,
    file_name: file.name,
    checked: true,
    updated_by: ctx.userId,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    if (existing.file_path) {
      await supabaseServer().storage.from(DOCUMENT_BUCKET).remove([existing.file_path]);
    }
    const { error } = await supabaseServer().from("tender_documents").update(patch).eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabaseServer()
      .from("tender_documents")
      .insert({ tender_id: tenderId, document_type_id: documentTypeId, ...patch });
    if (error) return { error: error.message };
  }

  revalidatePath(`/tenders/${tenderId}`);
}

export async function removeTenderDocumentFile(tenderId: string, documentTypeId: string): Promise<ActionError | undefined> {
  await requireAdmin();

  const { data: existing, error: findError } = await findDocumentRow(tenderId, documentTypeId);
  if (findError) return { error: findError.message };
  if (!existing?.file_path) return undefined;

  await supabaseServer().storage.from(DOCUMENT_BUCKET).remove([existing.file_path]);
  const { error } = await supabaseServer()
    .from("tender_documents")
    .update({ file_path: null, file_name: null })
    .eq("id", existing.id);
  if (error) return { error: error.message };

  revalidatePath(`/tenders/${tenderId}`);
}
