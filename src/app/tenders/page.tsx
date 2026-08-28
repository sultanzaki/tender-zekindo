import { getAllTenders, getFilterOptions } from "@/lib/tenders";
import { todayISO } from "@/lib/tender-logic";
import { TenderTableClient } from "@/components/TenderTableClient";

export const dynamic = "force-dynamic";

export default async function TenderTablePage() {
  const tenders = await getAllTenders();
  const options = getFilterOptions(tenders);
  return <TenderTableClient tenders={tenders} options={options} anchor={todayISO()} />;
}
