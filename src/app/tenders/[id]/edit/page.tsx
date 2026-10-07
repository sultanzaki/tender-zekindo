import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { getAllTenders, getSelectOptions, getTenderById } from "@/lib/tenders";
import { getMilestoneTypes } from "@/lib/milestones";
import { EditTenderForm } from "@/components/EditTenderForm";

export const dynamic = "force-dynamic";

export default async function EditTenderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const tender = await getTenderById(id);
  if (!tender) notFound();

  // The catalog comes from the tender's own track, and the sibling suggestions
  // are limited to it too: an upstream tender must not offer a downstream
  // tender's number, and the milestones shown must be its own.
  const allTenders = await getAllTenders({ includeArchived: true, track: tender.track });
  const [selectOptions, milestoneTypes] = await Promise.all([
    getSelectOptions(allTenders),
    getMilestoneTypes(tender.track),
  ]);
  const existingTenders = allTenders.map((t) => ({ id: t.id, tenderNo: t.tenderNo }));

  return (
    <EditTenderForm
      tender={tender}
      selectOptions={selectOptions}
      milestoneTypes={milestoneTypes}
      existingTenders={existingTenders}
    />
  );
}
