import { requireAdmin } from "@/lib/auth/dal";
import { getMilestoneTypesForAdmin } from "@/lib/milestones";
import { MilestoneAdmin } from "@/components/MilestoneAdmin";
import type { MilestoneTypeAdmin } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MilestonesAdminPage() {
  await requireAdmin();

  // Caught rather than thrown: before migration 0006 the `milestone_types`
  // table does not exist, and an admin opening this page should get a sentence
  // explaining that, not a 500.
  let milestoneTypes: MilestoneTypeAdmin[] = [];
  let loadError: string | null = null;
  try {
    milestoneTypes = await getMilestoneTypesForAdmin();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load milestones.";
  }

  return <MilestoneAdmin milestoneTypes={milestoneTypes} loadError={loadError} />;
}
