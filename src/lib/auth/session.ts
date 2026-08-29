import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { supabaseServer } from "../supabase-server";
import { SESSION_COOKIE_NAME } from "./sessionCookie";

export { SESSION_COOKIE_NAME };
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Issues a new session for userId and sets the httpOnly cookie. Only the
 * SHA-256 hash of the token is ever stored — the raw value lives only in
 * the browser's cookie, same principle as a password-reset token. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  const { error } = await supabaseServer()
    .from("sessions")
    .insert({ id: hashToken(token), user_id: userId, expires_at: expiresAt.toISOString() });
  if (error) throw new Error(`Failed to create session: ${error.message}`);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Deletes the current session (if any) and clears the cookie. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await supabaseServer().from("sessions").delete().eq("id", hashToken(token));
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/** Revokes every session for a user — used when an admin resets someone's
 * password, so a stolen/old session can't outlive the password change. */
export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  await supabaseServer().from("sessions").delete().eq("user_id", userId);
}

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const { data, error } = await supabaseServer()
    .from("sessions")
    .select("user_id, expires_at")
    .eq("id", hashToken(token))
    .maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.user_id;
}
