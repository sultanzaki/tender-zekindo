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

  const allTenders = await getAllTenders({ includeArchived: true });
  const [selectOptions, milestoneTypes] = await Promise.all([
    getSelectOptions(allTenders),
    getMilestoneTypes(),
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
