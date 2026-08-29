import { requireAdmin } from "@/lib/auth/dal";
import { getAllTenders, getAreaOptions, getFilterOptions } from "@/lib/tenders";
import { NewTenderForm } from "@/components/NewTenderForm";

export const dynamic = "force-dynamic";

export default async function NewTenderPage() {
  await requireAdmin();
  const tenders = await getAllTenders({ includeArchived: true });
  const options = getFilterOptions(tenders);
  const areaOptions = await getAreaOptions(tenders);
  const existingTenders = tenders.map((t) => ({ id: t.id, tenderNo: t.tenderNo }));
  return <NewTenderForm options={options} areaOptions={areaOptions} existingTenders={existingTenders} />;
}
