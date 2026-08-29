"use server";

import { supabaseServer } from "./supabase-server";
import { getAuthContext } from "./auth/dal";

export async function reportClientError(message: string, stack: string | null, path: string | null) {
  const ctx = await getAuthContext();
  const { error } = await supabaseServer()
    .from("error_log")
    .insert({ message, stack, path, actor_id: ctx?.userId ?? null });
  if (error) console.error("Failed to write error_log row:", error.message);
}
