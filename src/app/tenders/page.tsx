import { getAuthContext } from "@/lib/auth/dal";
import { getAllTenders, getFilterOptions } from "@/lib/tenders";
import { getMilestoneTypes, getMilestoneCatalog } from "@/lib/milestones";
import { todayISO } from "@/lib/tender-logic";
import { flatParams, trackFromParam } from "@/lib/types";
import { TenderTableClient } from "@/components/TenderTableClient";
import { readTenderFilters } from "@/lib/table-state";

export const dynamic = "force-dynamic";

export default async function TenderTablePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getAuthContext();
  const sp = await searchParams;
  const track = sp.track === "all" ? "all" : trackFromParam(sp.track);

  const [tenders, milestoneTypes] = await Promise.all([
    getAllTenders({ track }),
    track === "all"
      ? getMilestoneCatalog().then((c) => [
          ...(c.upstream ?? []),
          ...(c.downstream ?? []),
        ])
      : getMilestoneTypes(track),
  ]);
  const options = getFilterOptions(tenders);
  return (
    <>
      <TenderTableClient
        key={track}
        tenders={tenders.map((t) => ({
          ...t,
          catatanInternal: null,
          remarks: null,
          remark: null,
          oeCatatan: null,
          createdByName: null,
          updatedByName: null,
        }))}
        initialFilters={readTenderFilters(
          new URLSearchParams(flatParams(sp) as Record<string, string>),
        )}
        options={options}
        milestoneTypes={milestoneTypes}
        anchor={todayISO()}
        isAdmin={ctx?.profile.role === "admin"}
        track={track}
      />
    </>
  );
}
