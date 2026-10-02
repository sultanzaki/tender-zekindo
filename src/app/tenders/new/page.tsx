import { requireAdmin } from "@/lib/auth/dal";
import { getAllTenders, getSelectOptions } from "@/lib/tenders";
import { getMilestoneTypes } from "@/lib/milestones";
import { NewTenderForm } from "@/components/NewTenderForm";
import { trackFromParam } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewTenderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  // The form is reached from the list of one track, so it inherits that track
  // from the URL. The track is fixed here and never changes afterwards.
  const track = trackFromParam(sp.track);
  // Only this track's tenders are offered as "existing tender no" suggestions.
  const tenders = await getAllTenders({ includeArchived: true, track });
  const [selectOptions, milestoneTypes] = await Promise.all([
    getSelectOptions(tenders),
    getMilestoneTypes(track),
  ]);
  const existingTenders = tenders.map((t) => ({ id: t.id, tenderNo: t.tenderNo }));
  return (
    <NewTenderForm
      track={track}
      selectOptions={selectOptions}
      milestoneTypes={milestoneTypes}
      existingTenders={existingTenders}
    />
  );
}
