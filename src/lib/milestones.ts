import "server-only";
import { unstable_cache } from "next/cache";
import { supabaseServer } from "./supabase-server";
import { MILESTONE_TYPES_TAG } from "./cache-tags";
import { defaultMilestoneTypes, type MilestoneCatalog } from "./tender-logic";
import type { MilestoneType, MilestoneTypeAdmin, Track } from "./types";

/** The database stores `track` as text, with a CHECK constraint behind it. The
 * app narrows it here once, so nothing downstream ever holds an unknown track. */
export function rowTrack(value: string | null | undefined): Track {
  return value === "downstream" ? "downstream" : "upstream";
}

/**
 * One track's milestone catalog, ordered by that catalog's default order.
 *
 * The two tracks have independent catalogs (migration 0009): adding, renaming,
 * reordering or archiving a milestone in one never touches the other. The
 * `track` argument is part of the cache key, so both are cached separately and
 * both are invalidated by `updateTag(MILESTONE_TYPES_TAG)`.
 */
const getMilestoneTypesCached = unstable_cache(
  async (track: Track): Promise<MilestoneType[]> => {
    const { data, error } = await supabaseServer()
      .from("milestone_types")
      .select("*")
      .eq("track", track)
      .is("archived_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      // Falls back to that track's built-in milestones, NOT to an empty array.
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
      console.error(`Failed to load ${track} milestone types, falling back to the built-ins:`, error.message);
      return defaultMilestoneTypes(track);
    }
    return (data ?? []).map((r) => ({
      id: r.id,
      key: r.key,
      track: rowTrack(r.track),
      label: r.label,
      sortOrder: r.sort_order,
      showInTable: r.show_in_table,
    }));
  },
  ["milestone-types:list"],
  { tags: [MILESTONE_TYPES_TAG], revalidate: 300 },
);

export async function getMilestoneTypes(track: Track): Promise<MilestoneType[]> {
  return getMilestoneTypesCached(track);
}

/** Both catalogs at once, for the screens that show both tracks: /notifications
 * and the nav badge. Passing only one of them would resolve the other track's
 * tenders against the wrong catalog and render them with no milestones. */
export async function getMilestoneCatalog(): Promise<MilestoneCatalog> {
  const [upstream, downstream] = await Promise.all([
    getMilestoneTypesCached("upstream"),
    getMilestoneTypesCached("downstream"),
  ]);
  return { upstream, downstream };
}

/** Turns a label into a jsonb-safe key: "Lab Sample #2" -> "labSample2".
 *
 * Downstream keys get a `ds` prefix, which is what keeps the two catalogs from
 * ever colliding. Milestone dates live in `tenders.milestones`, a jsonb bag
 * keyed by these strings, so a key shared by both tracks would mean renaming a
 * milestone in one track silently rewrote the other's dates — no error, and the
 * mistake only shows up as wrong data later.
 *
 * Must stay stable once written. */
export function slugifyMilestoneKey(label: string, track: Track = "upstream"): string {
  const words = label
    .trim()
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "";
  const slug = words
    .map((w, i) =>
      i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join("");
  return track === "downstream" ? `ds${slug.charAt(0).toUpperCase()}${slug.slice(1)}` : slug;
}

/** Admin management view for one track: includes archived milestones, and
 * deliberately NOT cached — the point of this page is to show the effect of the
 * last change immediately. Throws on error so the admin sees the problem rather
 * than a half-empty list. */
export async function getMilestoneTypesForAdmin(track: Track): Promise<MilestoneTypeAdmin[]> {
  const { data, error } = await supabaseServer()
    .from("milestone_types")
    .select("*")
    .eq("track", track)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load milestone types: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    key: r.key,
    track: rowTrack(r.track),
    label: r.label,
    sortOrder: r.sort_order,
    showInTable: r.show_in_table,
    archivedAt: r.archived_at,
  }));
}
