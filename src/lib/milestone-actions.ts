"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "./auth/dal";
import { supabaseServer } from "./supabase-server";
import { MILESTONE_TYPES_TAG, TENDERS_TAG } from "./cache-tags";
import { slugifyMilestoneKey } from "./milestones";
import type { Track } from "./types";

export interface MilestoneActionResult {
  error?: string;
  key?: string;
}

/** Sort order is spaced by 10 so a milestone can be inserted between two
 * existing ones without renumbering. */
const ORDER_STEP = 10;

/** Appends to the end of the default order and clears both caches.
 * A milestone with `tenders.milestone_order` = null (which is every existing
 * tender) picks this up automatically, because null means "show the whole
 * catalog in the default order". */
export async function addMilestoneType(label: string, track: Track): Promise<MilestoneActionResult> {
  const ctx = await requireAdmin();
  const trimmed = label.trim();
  if (!trimmed) return { error: "Nama milestone tidak boleh kosong." };

  const key = slugifyMilestoneKey(trimmed, track);
  if (!key) return { error: "Nama milestone harus mengandung huruf atau angka." };

  // Scoped to this track: the catalogs are independent, so a new upstream
  // milestone must not be appended after the last downstream one (that would
  // make it appear at the wrong place in the other track's default order).
  const { data: last } = await supabaseServer()
    .from("milestone_types")
    .select("sort_order")
    .eq("track", track)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (last?.sort_order ?? 0) + ORDER_STEP;

  const { error } = await supabaseServer()
    .from("milestone_types")
    .insert({ key, label: trimmed, sort_order: sortOrder, track, created_by: ctx.userId });
  if (error) {
    if (error.code === "23505") {
      return { error: `Milestone dengan key "${key}" sudah ada. Pakai nama lain.` };
    }
    return { error: error.message };
  }

  updateTag(MILESTONE_TYPES_TAG);
  revalidatePath("/admin/milestones");
  return { key };
}

/** Dipakai form tender: bikin milestone kalau namanya baru, pakai yang sudah ada
 * kalau namanya sudah pernah dibuat.
 *
 * Beda dengan addMilestoneType() milik halaman admin: di sana nama kembar itu
 * kesalahan yang harus dilihat admin, di sini nama kembar adalah hal biasa —
 * banyak tender memang punya milestone bernama sama — jadi yang dikembalikan
 * adalah key yang sudah ada, bukan error. Milestone yang terarsip juga dicocokkan
 * dan diaktifkan lagi, bukan dibikin duplikatnya.
 */
export async function ensureMilestoneTypeByName(label: string, track: Track): Promise<MilestoneActionResult> {
  const ctx = await requireAdmin();
  const trimmed = label.trim();
  if (!trimmed) return { error: "Nama milestone tidak boleh kosong." };

  const slug = slugifyMilestoneKey(trimmed, track);
  if (!slug) return { error: "Nama milestone harus mengandung huruf atau angka." };

  // Katalognya kecil, jadi dibaca sekalian: satu query untuk mencari nama yang
  // sama (tanpa membedakan huruf besar/kecil) DAN untuk tahu key mana yang sudah
  // terpakai. Pencocokan dilakukan di JS, bukan dengan `ilike`, supaya tanda
  // `%` atau `_` di nama milestone tidak diperlakukan sebagai wildcard.
  const { data, error: readError } = await supabaseServer()
    .from("milestone_types")
    .select("key, label, archived_at, track");
  if (readError) return { error: readError.message };
  const rows = data ?? [];

  // Pencocokan nama HARUS dalam jalur yang sama. Tanpa `track` di sini, menulis
  // "Prebid" di form downstream akan menemukan milestone "Prebid" milik upstream
  // dan memakai key upstream itu — sehingga tender downstream menyimpan tanggal
  // di key milik jalur lain.
  const match = rows.find(
    (r) => r.track === track && r.label.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  if (match) {
    if (match.archived_at) {
      const { error } = await supabaseServer()
        .from("milestone_types")
        .update({ archived_at: null })
        .eq("key", match.key);
      if (error) return { error: error.message };
      updateTag(MILESTONE_TYPES_TAG);
    }
    return { key: match.key };
  }

  // Nama yang berbeda bisa menghasilkan key yang sama ("Lab Test 2" dan
  // "Lab-Test2"). Key tidak boleh diubah setelah tertulis karena tanggal di
  // tenders.milestones memakai key itu, jadi yang baru dibuatkan key uniknya.
  //
  // Diperiksa terhadap SELURUH key, bukan hanya jalur ini: constraint di
  // database adalah `key unique` global, dan key yang sama di dua jalur akan
  // membuat satu jalur bisa menimpa arti tanggal jalur lain.
  const takenKeys = new Set(rows.map((r) => r.key));
  let key = slug;
  for (let n = 2; takenKeys.has(key); n++) key = `${slug}${n}`;

  const { data: last } = await supabaseServer()
    .from("milestone_types")
    .select("sort_order")
    .eq("track", track)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (last?.sort_order ?? 0) + ORDER_STEP;

  const { error } = await supabaseServer()
    .from("milestone_types")
    .insert({ key, label: trimmed, sort_order: sortOrder, track, created_by: ctx.userId });
  if (error) return { error: error.message };

  updateTag(MILESTONE_TYPES_TAG);
  return { key };
}

/** Renaming only touches the label. The `key` is deliberately immutable: the
 * dates already stored in `tenders.milestones` are keyed by it, so changing it
 * would orphan every existing date for this milestone. */
export async function renameMilestoneType(id: string, label: string): Promise<MilestoneActionResult> {
  await requireAdmin();
  const trimmed = label.trim();
  if (!trimmed) return { error: "Nama milestone tidak boleh kosong." };

  const { error } = await supabaseServer()
    .from("milestone_types")
    .update({ label: trimmed })
    .eq("id", id);
  if (error) return { error: error.message };

  updateTag(MILESTONE_TYPES_TAG);
  revalidatePath("/admin/milestones");
  return {};
}

/** Archiving hides a milestone from the default order for every tender that
 * hasn't set its own order. It never deletes dates: the values stay in
 * `tenders.milestones` and come back if the milestone is restored. */
export async function archiveMilestoneType(id: string): Promise<MilestoneActionResult> {
  await requireAdmin();
  const { error } = await supabaseServer()
    .from("milestone_types")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  updateTag(MILESTONE_TYPES_TAG);
  revalidatePath("/admin/milestones");
  return {};
}

export async function restoreMilestoneType(id: string): Promise<MilestoneActionResult> {
  await requireAdmin();
  const { error } = await supabaseServer()
    .from("milestone_types")
    .update({ archived_at: null })
    .eq("id", id);
  if (error) return { error: error.message };

  updateTag(MILESTONE_TYPES_TAG);
  revalidatePath("/admin/milestones");
  return {};
}

/** Moves a milestone one step up or down in the *default* order of ITS OWN
 * track, by swapping sort_order with its neighbour there. Tenders with their
 * own `milestone_order` are unaffected — this only changes the default. */
export async function moveMilestoneType(id: string, direction: "up" | "down"): Promise<MilestoneActionResult> {
  await requireAdmin();

  // The track is read first so the neighbour is taken from the same catalog.
  // Without this, pressing ↑ on the first upstream milestone could swap it with
  // the last downstream one: the two orders would then be interleaved permanently.
  const { data: subject, error: subjectError } = await supabaseServer()
    .from("milestone_types")
    .select("id, sort_order, track")
    .eq("id", id)
    .maybeSingle();
  if (subjectError) return { error: subjectError.message };
  if (!subject) return { error: "Milestone tidak ditemukan." };

  const { data, error } = await supabaseServer()
    .from("milestone_types")
    .select("id, sort_order")
    .eq("track", subject.track)
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return { error: error.message };

  const list = data ?? [];
  const index = list.findIndex((m) => m.id === id);
  if (index === -1) return { error: "Milestone tidak ditemukan." };

  const neighbourIndex = direction === "up" ? index - 1 : index + 1;
  if (neighbourIndex < 0 || neighbourIndex >= list.length) return {}; // already at the edge

  const current = list[index];
  const neighbour = list[neighbourIndex];

  // Two updates, not one statement: this needs to be portable and readable, and
  // the list is ~12 rows on an internal tool.
  const first = await supabaseServer()
    .from("milestone_types")
    .update({ sort_order: neighbour.sort_order })
    .eq("id", current.id);
  if (first.error) return { error: first.error.message };

  const second = await supabaseServer()
    .from("milestone_types")
    .update({ sort_order: current.sort_order })
    .eq("id", neighbour.id);
  if (second.error) return { error: second.error.message };

  updateTag(MILESTONE_TYPES_TAG);
  revalidatePath("/admin/milestones");
  return {};
}

/** Controls the starting visibility of a milestone in the dense tender table
 * (the Columns menu still toggles it per session). */
export async function setMilestoneTableVisibility(id: string, showInTable: boolean): Promise<MilestoneActionResult> {
  await requireAdmin();
  const { error } = await supabaseServer()
    .from("milestone_types")
    .update({ show_in_table: showInTable })
    .eq("id", id);
  if (error) return { error: error.message };

  updateTag(MILESTONE_TYPES_TAG);
  revalidatePath("/admin/milestones");
  revalidatePath("/tenders");
  return {};
}

/** Sets the milestone order/subset for ONE tender (drag-free: the edit form
 * sends the finished array). Keys are validated against the catalog so a
 * malformed payload can't write junk into the column.
 *
 * An empty array is stored as NULL, which means "use the catalog default" —
 * that keeps the common case (no override) out of the database entirely. */
export async function setTenderMilestoneOrder(
  tenderId: string,
  keys: string[]
): Promise<MilestoneActionResult> {
  await requireAdmin();

  // The keys are validated against the catalog of THIS tender's track: a
  // downstream tender must not be able to store upstream keys (and vice versa),
  // which is exactly what a mismatched payload would do.
  const { data: tender, error: tenderError } = await supabaseServer()
    .from("tenders")
    .select("track")
    .eq("id", tenderId)
    .maybeSingle();
  if (tenderError) return { error: tenderError.message };
  if (!tender) return { error: "Tender tidak ditemukan." };

  const { data: catalog, error: catalogError } = await supabaseServer()
    .from("milestone_types")
    .select("key")
    .eq("track", tender.track);
  if (catalogError) return { error: catalogError.message };

  const known = new Set((catalog ?? []).map((m) => m.key));
  const unknown = keys.filter((k) => !known.has(k));
  if (unknown.length) return { error: `Milestone tidak dikenal: ${unknown.join(", ")}` };

  const { error } = await supabaseServer()
    .from("tenders")
    .update({ milestone_order: keys.length ? keys : null })
    .eq("id", tenderId);
  if (error) return { error: error.message };

  updateTag(TENDERS_TAG);
  revalidatePath(`/tenders/${tenderId}`);
  revalidatePath("/tenders");
  return {};
}
