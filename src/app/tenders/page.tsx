import { requireUser } from "@/lib/auth/dal";
import { getAllTenders, getFilterOptions } from "@/lib/tenders";
import { todayISO } from "@/lib/tender-logic";
import { TenderTableClient } from "@/components/TenderTableClient";

export const dynamic = "force-dynamic";

export default async function TenderTablePage() {
  const ctx = await requireUser();
  const tenders = await getAllTenders();
  const options = getFilterOptions(tenders);
  return (
    <TenderTableClient tenders={tenders} options={options} anchor={todayISO()} isAdmin={ctx.profile.role === "admin"} />
  );
}
