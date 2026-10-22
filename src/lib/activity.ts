import "server-only";
import { requireAdmin } from "./auth/dal";
import { supabaseServer } from "./supabase-server";
export async function getTenderActivity(tenderId: string) {
  await requireAdmin();
  const { data, error } = await supabaseServer()
    .from("tender_events")
    .select("id, actor_name, action, created_at, changes")
    .eq("tender_id", tenderId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error)
    return {
      events: [],
      error: "Activity could not be loaded. Please try again.",
    };
  return { events: data ?? [], error: null };
}
