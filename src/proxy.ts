import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/sessionCookie";

// Optimistic auth check (Next.js 16 renamed Middleware to Proxy — same
// mechanism). This only checks whether the session cookie is present and
// redirects; it deliberately does NOT touch the database (no cookie
// hashing/lookup here) — that's the job of requireUser()/requireAdmin() in
// src/lib/auth/dal.ts, called at the top of every protected page and Server
// Action. This is the "cheap, runs on every request" layer, not the
// security boundary — a forged/expired/revoked cookie value still gets
// rejected there.
//
// Deliberately one-directional: only redirects an unauthenticated-looking
// request AWAY from a protected page. It does NOT bounce an
// already-cookied visitor away from /login, because cookie presence isn't
// proof the session is still valid (e.g. an admin password reset revokes
// it) — doing that here would bounce a signed-out-but-still-cookied
// visitor from /login straight back to a protected page, which redirects
// straight back to /login, forever. src/app/login/page.tsx does that
// redirect instead, using the real DB-backed getAuthContext() check.
const PUBLIC_PREFIXES = ["/login"];

export function proxy(request: NextRequest) {
  const hasSessionCookie = !!request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));

  if (!hasSessionCookie && !isPublic) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png).*)"],
};
