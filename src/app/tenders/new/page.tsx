import { requireAdmin } from "@/lib/auth/dal";
import { getAllTenders, getSelectOptions } from "@/lib/tenders";
import { NewTenderForm } from "@/components/NewTenderForm";

export const dynamic = "force-dynamic";

export default async function NewTenderPage() {
  await requireAdmin();
  const tenders = await getAllTenders({ includeArchived: true });
  const selectOptions = await getSelectOptions(tenders);
  const existingTenders = tenders.map((t) => ({ id: t.id, tenderNo: t.tenderNo }));
  return <NewTenderForm selectOptions={selectOptions} existingTenders={existingTenders} />;
}
