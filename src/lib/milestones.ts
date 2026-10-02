import "server-only";
import { unstable_cache } from "next/cache";
import { supabaseServer } from "./supabase-server";
import { MILESTONE_TYPES_TAG } from "./cache-tags";
import { DEFAULT_MILESTONE_TYPES } from "./tender-logic";
import type { MilestoneType, MilestoneTypeAdmin } from "./types";

/**
 * The global milestone catalog, ordered by the default order.
 *
 * Milestones are no longer hardcoded in src/lib/types.ts: an admin can add,
 * rename, reorder and archive them, and each tender can override the order and
 * the subset it uses (see `tenders.milestone_order`, migration
 * 0006_dynamic_milestones.sql).
 *
 * Cached and invalidated by `updateTag(MILESTONE_TYPES_TAG)` from the
 * milestone Server Actions.
 */
export const getMilestoneTypes = unstable_cache(
  async (): Promise<MilestoneType[]> => {
    const { data, error } = await supabaseServer()
      .from("milestone_types")
      .select("*")
      .is("archived_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      // Falls back to the 12 built-in milestones, NOT to an empty array.
      //
      // This is the fix for a real regression: the catalog is consumed directly
      // by TenderTableClient, both tender forms and the Excel export — not only
      // through resolveTenderMilestones(), which has its own fallback. Returning
      // [] here therefore deleted every milestone column and every milestone
      // date input from the UI, so before migration 0006 the app looked broken
      // rather than merely missing the new feature.
      //
      // An empty-but-successful read still returns [] on purpose: that is an
      // admin who archived every milestone, which is a legitimate choice.
      console.error("Failed to load milestone types, falling back to the built-ins:", error.message);
      return DEFAULT_MILESTONE_TYPES;
    }
    return (data ?? []).map((r) => ({
      id: r.id,
      key: r.key,
      label: r.label,
      sortOrder: r.sort_order,
      showInTable: r.show_in_table,
    }));
  },
  ["milestone-types:list"],
  { tags: [MILESTONE_TYPES_TAG], revalidate: 300 },
);

/** Turns a label into a jsonb-safe key: "Lab Sample #2" -> "labSample2".
 * Must stay stable once written, because existing tender dates in
 * `tenders.milestones` are keyed by it. */
export function slugifyMilestoneKey(label: string): string {
  const words = label
    .trim()
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "";
  return words
    .map((w, i) =>
      i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join("");
}

/** Admin management view: includes archived milestones, and deliberately NOT
 * cached — the point of this page is to show the effect of the last change
 * immediately. Throws on error so the admin sees the problem rather than a
 * half-empty list. */
export async function getMilestoneTypesForAdmin(): Promise<MilestoneTypeAdmin[]> {
  const { data, error } = await supabaseServer()
    .from("milestone_types")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load milestone types: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label,
    sortOrder: r.sort_order,
    showInTable: r.show_in_table,
    archivedAt: r.archived_at,
  }));
}
