import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let client: SupabaseClient<Database> | null = null;

/**
 * Server-only Supabase client using the service role key. There is no
 * end-user auth in this app (internal tool, ~5-10 users), so RLS on
 * `tenders` intentionally has no policies — only this service-role client
 * (which bypasses RLS) can read/write. Never import this from a Client
 * Component or expose the key with a NEXT_PUBLIC_ prefix.
 */
export function supabaseServer(): SupabaseClient<Database> {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example)."
    );
  }

  client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
