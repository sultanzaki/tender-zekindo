import { notFound } from "next/navigation";
import { getAllTenders, getFilterOptions, getTenderById } from "@/lib/tenders";
import { EditTenderForm } from "@/components/EditTenderForm";

export const dynamic = "force-dynamic";

export default async function EditTenderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tender = await getTenderById(id);
  if (!tender) notFound();

  const allTenders = await getAllTenders();
  const options = getFilterOptions(allTenders);

  return <EditTenderForm tender={tender} options={options} />;
}
