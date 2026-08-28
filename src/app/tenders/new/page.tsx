import { getAllTenders, getFilterOptions } from "@/lib/tenders";
import { NewTenderForm } from "@/components/NewTenderForm";

export const dynamic = "force-dynamic";

export default async function NewTenderPage() {
  const tenders = await getAllTenders();
  const options = getFilterOptions(tenders);
  return <NewTenderForm options={options} />;
}
