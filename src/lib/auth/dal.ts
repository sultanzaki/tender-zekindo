import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSessionUserId } from "./session";
import { supabaseServer } from "../supabase-server";
import type { Profile } from "../types";

export interface AuthContext {
  userId: string;
  email: string;
  profile: Profile;
}

/**
 * Resolves the signed-in user (if any) from the session cookie. React-cached
 * so a single request only checks the session once, and soft-fails to null
 * on any error — including missing env vars, which lets routes like /login
 * and /_not-found statically prerender at build time without a database.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  try {
    const userId = await getSessionUserId();
    if (!userId) return null;

    const { data: profileRow, error } = await supabaseServer()
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error || !profileRow) return null;

    return {
      userId,
      email: profileRow.email,
      profile: {
        id: profileRow.id,
        email: profileRow.email,
        name: profileRow.name,
        role: profileRow.role,
        createdAt: profileRow.created_at,
      },
    };
  } catch {
    return null;
  }
});

export async function requireUser(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  return ctx;
}

export async function requireAdmin(): Promise<AuthContext> {
  const ctx = await requireUser();
  if (ctx.profile.role !== "admin") redirect("/");
  return ctx;
}
