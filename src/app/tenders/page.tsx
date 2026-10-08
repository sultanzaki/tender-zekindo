import { getAuthContext } from "@/lib/auth/dal";
import { getAllTenders, getFilterOptions } from "@/lib/tenders";
import { getMilestoneTypes } from "@/lib/milestones";
import { todayISO } from "@/lib/tender-logic";
import { flatParams, trackFromParam } from "@/lib/types";
import { TenderTableClient } from "@/components/TenderTableClient";
import { TrackSwitch } from "@/components/TrackSwitch";

export const dynamic = "force-dynamic";

export default async function TenderTablePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getAuthContext();
  const sp = await searchParams;
  const track = trackFromParam(sp.track);

  const [tenders, milestoneTypes] = await Promise.all([
    getAllTenders({ track }),
    getMilestoneTypes(track),
  ]);
  const options = getFilterOptions(tenders);
  return (
    <>
      <TrackSwitch current={track} basePath="/tenders" params={flatParams(sp)} />
      <TenderTableClient
        tenders={tenders}
        options={options}
        milestoneTypes={milestoneTypes}
        anchor={todayISO()}
        isAdmin={ctx?.profile.role === "admin"}
        track={track}
      />
    </>
  );
}
