import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cookie-bound Supabase client for auth session management (login, logout,
 * password set, invite-link verification). Uses the anon key, not the
 * service-role key — this client's authority is exactly "whatever the
 * signed-in user's session allows via Supabase Auth," not full data access.
 *
 * All tender/business data access still goes through supabaseServer()
 * (service-role client, src/lib/supabase-server.ts) — this client is only
 * ever used to establish/read/end an auth session.
 */
export async function createAuthClient() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set (see .env.example).");
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, which can't set cookies — safe
          // to ignore. proxy.ts refreshes the session cookie on navigation.
        }
      },
    },
  });
}
