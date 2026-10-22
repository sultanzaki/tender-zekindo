import { getAllTenders } from "@/lib/tenders";
import { getMilestoneCatalog } from "@/lib/milestones";
import { computeDeadlines, computeStalled, todayISO } from "@/lib/tender-logic";
import { DeadlineWorkspace } from "@/components/DeadlineWorkspace";
export const dynamic = "force-dynamic";
export default async function Notifications({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; track?: string }>;
}) {
  const [tenders, catalog, params] = await Promise.all([
    getAllTenders(),
    getMilestoneCatalog(),
    searchParams,
  ]);
  return (
    <DeadlineWorkspace
      deadlines={computeDeadlines(tenders, todayISO(), catalog)}
      followups={computeStalled(tenders, todayISO(), catalog)}
      initialView={params.view}
      initialTrack={params.track}
    />
  );
}
