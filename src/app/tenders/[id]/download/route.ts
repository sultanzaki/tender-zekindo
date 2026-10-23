import { requireUser } from "@/lib/auth/dal";
import { getTenderById } from "@/lib/tenders";
import { supabaseServer } from "@/lib/supabase-server";
import { DOCUMENT_BUCKET } from "@/lib/documents";

export const dynamic = "force-dynamic";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ctx = await requireUser();
  const { id } = await context.params;
  const query = new URL(request.url).searchParams;
  const file = query.get("file"),
    document = query.get("document");
  if (!!file === !!document || !uuid.test(file || document || ""))
    return new Response("Invalid document request.", {
      status: 400,
      headers: privateHeaders,
    });

  const tender = await getTenderById(id);
  if (!tender || (tender.archivedAt && ctx.profile.role !== "admin"))
    return new Response("Document not found.", {
      status: 404,
      headers: privateHeaders,
    });

  // Match both the record and its tender; a file ID alone is never authority.
  const lookup = file
    ? supabaseServer()
        .from("tender_files")
        .select("file_path, file_name")
        .eq("id", file)
    : supabaseServer()
        .from("tender_documents")
        .select("file_path, file_name")
        .eq("document_type_id", document!);
  const { data: record, error } = await lookup
    .eq("tender_id", id)
    .maybeSingle();
  if (error || !record?.file_path)
    return new Response("Document not found.", {
      status: 404,
      headers: privateHeaders,
    });

  const { data, error: downloadError } = await supabaseServer()
    .storage.from(DOCUMENT_BUCKET)
    .download(record.file_path);
  if (downloadError || !data)
    return new Response("Unable to download this document.", {
      status: 502,
      headers: privateHeaders,
    });

  const name = (record.file_name || "document")
    .split(/[\\/]/)
    .pop()!
    .toWellFormed();
  const fallback = name.replace(/[^a-zA-Z0-9._ -]/g, "_") || "document";
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return new Response(data.stream(), {
    headers: {
      ...privateHeaders,
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`,
      "Content-Length": String(data.size),
    },
  });
}
