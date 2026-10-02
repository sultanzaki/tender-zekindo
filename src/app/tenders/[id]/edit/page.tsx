import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { getAllTenders, getSelectOptions, getTenderById } from "@/lib/tenders";
import { EditTenderForm } from "@/components/EditTenderForm";

export const dynamic = "force-dynamic";

export default async function EditTenderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const tender = await getTenderById(id);
  if (!tender) notFound();

  const allTenders = await getAllTenders({ includeArchived: true });
  const selectOptions = await getSelectOptions(allTenders);
  const existingTenders = allTenders.map((t) => ({ id: t.id, tenderNo: t.tenderNo }));

  return (
    <EditTenderForm tender={tender} selectOptions={selectOptions} existingTenders={existingTenders} />
  );
}
