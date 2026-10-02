import { requireUser } from "@/lib/auth/dal";
import { getAllTenders, getFilterOptions } from "@/lib/tenders";
import { getMilestoneTypes } from "@/lib/milestones";
import { todayISO } from "@/lib/tender-logic";
import { TenderTableClient } from "@/components/TenderTableClient";

export const dynamic = "force-dynamic";

export default async function TenderTablePage() {
  const ctx = await requireUser();
  const [tenders, milestoneTypes] = await Promise.all([getAllTenders(), getMilestoneTypes()]);
  const options = getFilterOptions(tenders);
  return (
    <TenderTableClient
      tenders={tenders}
      options={options}
      milestoneTypes={milestoneTypes}
      anchor={todayISO()}
      isAdmin={ctx.profile.role === "admin"}
    />
  );
}
