"use server";

import { supabaseServer } from "./supabase-server";
import { requireUser } from "./auth/dal";

export async function reportClientError(
  message: string,
  stack: string | null,
  path: string | null,
) {
  const ctx = await requireUser();
  const { error } = await supabaseServer()
    .from("error_log")
    .insert({
      message: String(message).slice(0, 2000),
      stack: stack?.slice(0, 10000) ?? null,
      path: path?.slice(0, 2000) ?? null,
      actor_id: ctx.userId,
    });
  if (error) console.error("Failed to write error_log row:", error.message);
}
