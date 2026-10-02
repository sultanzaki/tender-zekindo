import { requireAdmin } from "@/lib/auth/dal";
import { getMilestoneTypesForAdmin } from "@/lib/milestones";
import { MilestoneAdmin, type MilestoneSection } from "@/components/MilestoneAdmin";
import { TRACKS, type Track } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MilestonesAdminPage() {
  await requireAdmin();

  // Both catalogs are loaded, each with its own error message rather than one
  // shared failure: before migrations 0006/0009 the `milestone_types` table or
  // its `track` column may be missing, and an admin opening this page should
  // get a sentence explaining that, not a 500.
  const sections: MilestoneSection[] = await Promise.all(
    TRACKS.map(async (track: Track) => {
      try {
        return { track, milestoneTypes: await getMilestoneTypesForAdmin(track), loadError: null };
      } catch (e) {
        return {
          track,
          milestoneTypes: [],
          loadError: e instanceof Error ? e.message : "Failed to load milestones.",
        };
      }
    }),
  );

  return <MilestoneAdmin sections={sections} />;
}
