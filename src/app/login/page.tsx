import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/dal";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") ? next : "/";

  // A real DB-backed check, not just cookie presence (that's what proxy.ts
  // does, cheaply) — matters because a session can be revoked (e.g. an
  // admin password reset) while its cookie is still sitting in the
  // browser. Redirecting away from /login on cookie presence alone would
  // bounce a signed-out-but-still-cookied visitor straight back here from
  // every protected page, an infinite loop.
  const ctx = await getAuthContext();
  if (ctx) redirect(safeNext);

  return <LoginForm next={safeNext} />;
}
