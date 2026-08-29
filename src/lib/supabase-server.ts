import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let client: SupabaseClient<Database> | null = null;

/**
 * Service-role Supabase client for all data access — tenders, profiles,
 * sessions, everything. Bypasses RLS entirely: the Next.js app itself (via
 * src/lib/auth/dal.ts) is the authorization boundary, not Postgres RLS,
 * since every call site here is server-only. Never import this into client
 * components.
 */
export function supabaseServer(): SupabaseClient<Database> {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example).");
  }
  client = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
