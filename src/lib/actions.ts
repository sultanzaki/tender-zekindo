"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase-server";
import { requireAdmin } from "./auth/dal";
import { getTenderById } from "./tenders";
import { DOCUMENT_BUCKET } from "./documents";
import { getMilestoneTypes } from "./milestones";
import { TENDERS_TAG } from "./cache-tags";
import { currentPeriod, periodsSorted } from "./tender-logic";
import {
  EXTENDABLE_FIELDS,
  RESULT_ENUM,
  type ExtendableField,
  type Milestones,
  type Tender,
  type TenderEditFormValues,
  type TenderEventAction,
  type TenderEventChange,
  type TenderFormValues,
} from "./types";

export interface ActionError {
  error: string;
}

function parseNumericInput(raw: string): number | null {
  const digits = raw.replace(/[^0-9]/g, "");
  return digits ? Number(digits) : null;
}

/** Milestone keys are admin-authored data now (they become jsonb keys in
 * `tenders.milestones` and entries in `milestone_types.key`), so they are
 * validated rather than trusted from the client. */
const MILESTONE_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

/** Builds the milestone jsonb for a save.
 *
 * `base` is the row's existing milestones, and submitted keys are merged on top
 * of it rather than replacing it. That matters: a tender can have a per-tender
 * milestone list (see `tenders.milestone_order`), and the form does not submit
 * milestones the tender doesn't show. Replacing the whole object would silently
 * delete the dates of every hidden milestone. */
function buildMilestones(input: Record<string, string>, base: Milestones = {}): Milestones {
  const out: Milestones = { ...base };
  for (const [key, value] of Object.entries(input)) {
    if (!MILESTONE_KEY_PATTERN.test(key)) continue;
    out[key] = value || null;
  }
  return out;
}

function validate(values: TenderFormValues): string | null {
  if (!values.area.trim()) return "Area is required.";
  if (!values.customer.trim()) return "Customer is required.";
  return null;
}

function labelFor(tender: Tender): string {
  return tender.tenderNo || tender.product || tender.id;
}

async function resolveCurrentPeriod(): Promise<string> {
  const { data, error } = await supabaseServer().from("tenders").select("period");
  if (error) throw new Error(`Failed to determine period: ${error.message}`);
  const periods = periodsSorted((data ?? []).map((r) => r.period));
  return currentPeriod(periods) || new Date().getFullYear().toString();
}

function diffRecords(
  before: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, TenderEventChange> | null {
  const changes: Record<string, TenderEventChange> = {};
  for (const [key, newVal] of Object.entries(patch)) {
    const oldVal = before[key] ?? null;
    const normalizedNew = newVal ?? null;
    if (JSON.stringify(oldVal) !== JSON.stringify(normalizedNew)) {
      changes[key] = { from: oldVal, to: normalizedNew };
    }
  }
  return Object.keys(changes).length ? changes : null;
}

async function logTenderEvent(params: {
  tenderId: string | null;
  tenderLabel: string;
  actorId: string;
  actorName: string;
  action: TenderEventAction;
  changes: Record<string, TenderEventChange> | null;
}) {
  const { error } = await supabaseServer().from("tender_events").insert({
    tender_id: params.tenderId,
    tender_label: params.tenderLabel,
    actor_id: params.actorId,
    actor_name: params.actorName,
    action: params.action,
    changes: params.changes,
  });
  if (error) console.error("Failed to write tender_events row:", error.message);
}

function toInsertPayload(values: TenderFormValues, milestoneBase: Milestones = {}) {
  return {
    area: values.area,
    tender_no: values.tenderNo || null,
    customer: values.customer.trim(),
    product: values.product || null,
    entitas: values.entitas || null,
    qty: parseNumericInput(values.qty),
    oe: parseNumericInput(values.oe),
    oe_catatan: values.oeCatatan || null,
    nilai_penawaran: parseNumericInput(values.nilaiPenawaran),
    milestones: buildMilestones(values.milestones, milestoneBase),
  };
}

/** True when two milestone order arrays list the same keys in the same order. */
function sameOrder(a: string[], b: string[]) {
  return a.length === b.length && a.every((key, i) => key === b[i]);
}

export async function createTender(values: TenderFormValues): Promise<ActionError | undefined> {
  const ctx = await requireAdmin();

  const validationError = validate(values);
  if (validationError) return { error: validationError };

  let period: string;
  try {
    period = await resolveCurrentPeriod();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to determine period." };
  }

  // Milestone order chosen on the new-tender form. Stored as NULL when it still
  // matches the catalog, so a tender nobody customised keeps following the
  // catalog when milestones are later added, renamed or reordered. Unknown keys
  // are dropped rather than written, so a tampered payload cannot put junk in
  // the column.
  const catalogOrder = (await getMilestoneTypes(values.track)).map((m) => m.key);
  const requestedOrder = (values.milestoneOrder ?? catalogOrder).filter((k) => catalogOrder.includes(k));
  const milestoneOrder = sameOrder(requestedOrder, catalogOrder) ? null : requestedOrder;

  const { data, error } = await supabaseServer()
    .from("tenders")
    .insert({
      ...toInsertPayload(values),
      // `track` is set here and nowhere else. It is deliberately NOT part of
      // toInsertPayload(), which updateTender also uses: a tender must never
      // change track, because its milestone dates are keyed by that track's
      // catalog. Switching would silently orphan every date it has.
      track: values.track,
      milestone_order: milestoneOrder,
      period,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error) return { error: `Failed to save tender: ${error.message}` };

  await logTenderEvent({
    tenderId: data.id,
    tenderLabel: values.tenderNo || values.product || data.id,
    actorId: ctx.userId,
    actorName: ctx.profile.name,
    action: "create",
    changes: diffRecords({}, toInsertPayload(values)),
  });

  revalidatePath("/");
  revalidatePath("/tenders");
  updateTag(TENDERS_TAG);
  redirect(`/tenders/${data.id}`);
}

export async function updateTender(id: string, values: TenderEditFormValues): Promise<ActionError | undefined> {
  const ctx = await requireAdmin();

  const validationError = validate(values);
  if (validationError) return { error: validationError };
  if (values.result && !(RESULT_ENUM as readonly string[]).includes(values.result)) {
    return { error: "Invalid result value." };
  }

  const { data: before, error: beforeError } = await supabaseServer()
    .from("tenders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (beforeError || !before) return { error: "Tender not found." };

  const patch = {
    ...toInsertPayload(values, before.milestones),
    result: values.result || null,
    carry_over: values.carryOver || null,
    remarks: values.remarks || null,
    remark: values.remark || null,
    pnl: values.pnl,
    catatan_internal: values.catatanInternal || null,
    updated_by: ctx.userId,
  };

  const { error } = await supabaseServer().from("tenders").update(patch).eq("id", id);
  if (error) return { error: `Failed to save changes: ${error.message}` };

  await logTenderEvent({
    tenderId: id,
    tenderLabel: values.tenderNo || values.product || id,
    actorId: ctx.userId,
    actorName: ctx.profile.name,
    action: "update",
    changes: diffRecords(before, patch),
  });

  revalidatePath("/");
  revalidatePath("/tenders");
  updateTag(TENDERS_TAG);
  revalidatePath(`/tenders/${id}`);
  redirect(`/tenders/${id}`);
}

export async function archiveTender(id: string): Promise<ActionError | undefined> {
  const ctx = await requireAdmin();
  const tender = await getTenderById(id);
  if (!tender) return { error: "Tender not found." };

  const { error } = await supabaseServer()
    .from("tenders")
    .update({ archived_at: new Date().toISOString(), updated_by: ctx.userId })
    .eq("id", id);
  if (error) return { error: error.message };

  await logTenderEvent({
    tenderId: id,
    tenderLabel: labelFor(tender),
    actorId: ctx.userId,
    actorName: ctx.profile.name,
    action: "archive",
    changes: null,
  });

  revalidatePath("/");
  revalidatePath("/tenders");
  updateTag(TENDERS_TAG);
  revalidatePath("/tenders/archive");
  revalidatePath(`/tenders/${id}`);
  redirect("/tenders");
}

export async function restoreTender(id: string): Promise<ActionError | undefined> {
  const ctx = await requireAdmin();
  const tender = await getTenderById(id);
  if (!tender) return { error: "Tender not found." };

  const { error } = await supabaseServer()
    .from("tenders")
    .update({ archived_at: null, updated_by: ctx.userId })
    .eq("id", id);
  if (error) return { error: error.message };

  await logTenderEvent({
    tenderId: id,
    tenderLabel: labelFor(tender),
    actorId: ctx.userId,
    actorName: ctx.profile.name,
    action: "restore",
    changes: null,
  });

  revalidatePath("/");
  revalidatePath("/tenders");
  updateTag(TENDERS_TAG);
  revalidatePath("/tenders/archive");
  revalidatePath(`/tenders/${id}`);
  redirect(`/tenders/${id}`);
}

/** Removes every object under `<tenderId>/` in the private documents bucket.
 * Without this a permanent delete orphans the files: the `tender_documents`
 * rows cascade away with the tender, but the Storage objects do not.
 * Best-effort — a Storage hiccup must not block the delete the user asked
 * for. */
async function deleteTenderStorageFiles(tenderId: string): Promise<void> {
  try {
    const client = supabaseServer();
    const { data, error } = await client.storage.from(DOCUMENT_BUCKET).list(tenderId);
    if (error || !data?.length) return;
    const paths = data.filter((entry) => entry.id).map((entry) => `${tenderId}/${entry.name}`);
    if (paths.length) await client.storage.from(DOCUMENT_BUCKET).remove(paths);
  } catch (e) {
    console.error(`Failed to clean up Storage files for tender ${tenderId}:`, e);
  }
}

export interface BulkResult {
  error?: string;
  count?: number;
}

/** One audit event per tender, in a single insert. Rows must still exist when
 * `tender_id` is set; pass `detachIds` when they're already deleted. */
async function logBulkEvents(
  targets: { id: string; tender_no: string | null; product: string | null }[],
  ctx: { userId: string; profile: { name: string } },
  action: TenderEventAction,
  detachIds = false
): Promise<void> {
  if (!targets.length) return;
  const { error } = await supabaseServer()
    .from("tender_events")
    .insert(
      targets.map((t) => ({
        tender_id: detachIds ? null : t.id,
        tender_label: t.tender_no || t.product || t.id,
        actor_id: ctx.userId,
        actor_name: ctx.profile.name,
        action,
        changes: null,
      }))
    );
  if (error) console.error("Failed to write bulk tender_events rows:", error.message);
}

async function loadBulkTargets(ids: string[]) {
  const { data, error } = await supabaseServer()
    .from("tenders")
    .select("id, tender_no, product")
    .in("id", ids);
  if (error) throw new Error(`Failed to load tenders: ${error.message}`);
  return data ?? [];
}

export async function deleteTenderPermanently(id: string): Promise<ActionError | undefined> {
  const ctx = await requireAdmin();
  const tender = await getTenderById(id);
  if (!tender) return { error: "Tender not found." };
  if (!tender.archivedAt) return { error: "Archive the tender before deleting it permanently." };

  const { error } = await supabaseServer().from("tenders").delete().eq("id", id);
  if (error) return { error: error.message };

  await deleteTenderStorageFiles(id);

  await logTenderEvent({
    tenderId: null,
    tenderLabel: labelFor(tender),
    actorId: ctx.userId,
    actorName: ctx.profile.name,
    action: "delete",
    changes: null,
  });

  revalidatePath("/tenders/archive");
  updateTag(TENDERS_TAG);
  redirect("/tenders/archive");
}

/** Bulk archive from the tender table. Reversible (Restore lives on
 * /tenders/archive), so this is the safe bulk default. */
export async function bulkArchiveTenders(ids: string[]): Promise<BulkResult> {
  const ctx = await requireAdmin();
  if (!ids.length) return { error: "No tenders selected." };

  const { error } = await supabaseServer()
    .from("tenders")
    .update({ archived_at: new Date().toISOString(), updated_by: ctx.userId })
    .in("id", ids);
  if (error) return { error: `Failed to archive: ${error.message}` };

  await logBulkEvents(await loadBulkTargets(ids), ctx, "archive");

  revalidatePath("/");
  revalidatePath("/tenders");
  updateTag(TENDERS_TAG);
  revalidatePath("/tenders/archive");
  return { count: ids.length };
}

/** Bulk permanent delete from the tender table: row, Storage files, and an
 * audit event per tender. Deliberately does NOT require a prior archive — the
 * UI gates it behind a typed confirmation instead, since requiring two steps
 * for a batch the user explicitly selected defeats the point of bulk actions.
 * Use bulkArchiveTenders when the intent is reversible. */
export async function bulkDeleteTenders(ids: string[]): Promise<BulkResult> {
  const ctx = await requireAdmin();
  if (!ids.length) return { error: "No tenders selected." };

  let targets;
  try {
    targets = await loadBulkTargets(ids);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load tenders." };
  }
  if (!targets.length) return { error: "No matching tenders found." };

  const targetIds = targets.map((t) => t.id);
  const { error } = await supabaseServer().from("tenders").delete().in("id", targetIds);
  if (error) return { error: `Failed to delete: ${error.message}` };

  for (const targetId of targetIds) await deleteTenderStorageFiles(targetId);
  await logBulkEvents(targets, ctx, "delete", true);

  revalidatePath("/");
  revalidatePath("/tenders");
  updateTag(TENDERS_TAG);
  revalidatePath("/tenders/archive");
  return { count: targetIds.length };
}

// Plain <form action={fn.bind(null, id)}> requires a void-returning action
// (unlike useActionState, it has nowhere to put a returned error) — these
// wrap the real actions for that use, used where the caller has no inline
// error UI (the archive list's Restore/Delete buttons).
export async function restoreTenderForm(id: string): Promise<void> {
  await restoreTender(id);
}

export async function deleteTenderPermanentlyForm(id: string): Promise<void> {
  await deleteTenderPermanently(id);
}

// Inline quick-edit from the tender table (Result badge / a milestone date
// cell), scoped to admins. No redirect — the caller stays on the table.
export async function quickUpdateResult(id: string, result: string): Promise<ActionError | undefined> {
  const ctx = await requireAdmin();
  if (result && !(RESULT_ENUM as readonly string[]).includes(result)) return { error: "Invalid result value." };

  const { data: before, error: beforeError } = await supabaseServer()
    .from("tenders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (beforeError || !before) return { error: "Tender not found." };

  const patch = { result: result || null, updated_by: ctx.userId };
  const { error } = await supabaseServer().from("tenders").update(patch).eq("id", id);
  if (error) return { error: error.message };

  await logTenderEvent({
    tenderId: id,
    tenderLabel: before.tender_no || before.product || id,
    actorId: ctx.userId,
    actorName: ctx.profile.name,
    action: "update",
    changes: diffRecords(before, patch),
  });

  revalidatePath("/");
  revalidatePath("/tenders");
  updateTag(TENDERS_TAG);
  revalidatePath(`/tenders/${id}`);
}

export async function quickUpdateMilestone(
  id: string,
  key: string,
  value: string
): Promise<ActionError | undefined> {
  const ctx = await requireAdmin();
  if (!MILESTONE_KEY_PATTERN.test(key)) return { error: "Invalid milestone key." };

  const { data: before, error: beforeError } = await supabaseServer()
    .from("tenders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (beforeError || !before) return { error: "Tender not found." };

  const milestones = { ...before.milestones, [key]: value || null };
  const patch = { milestones, updated_by: ctx.userId };
  const { error } = await supabaseServer().from("tenders").update(patch).eq("id", id);
  if (error) return { error: error.message };

  await logTenderEvent({
    tenderId: id,
    tenderLabel: before.tender_no || before.product || id,
    actorId: ctx.userId,
    actorName: ctx.profile.name,
    action: "update",
    changes: diffRecords(before, patch),
  });

  revalidatePath("/");
  revalidatePath("/tenders");
  updateTag(TENDERS_TAG);
  revalidatePath(`/tenders/${id}`);
}

export async function addSelectOption(field: string, value: string): Promise<{ error?: string; value?: string }> {
  const ctx = await requireAdmin();
  const trimmed = value.trim();
  if (!trimmed) return { error: "Value can't be empty." };
  if (!(EXTENDABLE_FIELDS as readonly string[]).includes(field)) {
    return { error: `"${field}" is not an extendable dropdown field.` };
  }

  const { error } = await supabaseServer()
    .from("select_options")
    .insert({ field: field as ExtendableField, value: trimmed, created_by: ctx.userId });
  if (error && error.code !== "23505") return { error: error.message };

  revalidatePath("/tenders/new");
  revalidatePath("/tenders");
  return { value: trimmed };
}
