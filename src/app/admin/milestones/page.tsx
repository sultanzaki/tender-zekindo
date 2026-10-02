import { requireAdmin } from "@/lib/auth/dal";
import { getMilestoneTypesForAdmin } from "@/lib/milestones";
import { MilestoneAdmin } from "@/components/MilestoneAdmin";

export const dynamic = "force-dynamic";

export default async function MilestonesAdminPage() {
  await requireAdmin();
  const milestoneTypes = await getMilestoneTypesForAdmin();
  return <MilestoneAdmin milestoneTypes={milestoneTypes} />;
}
