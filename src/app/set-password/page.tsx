import { requireUser } from "@/lib/auth/dal";
import { SetPasswordForm } from "@/components/SetPasswordForm";

export const dynamic = "force-dynamic";

export default async function SetPasswordPage() {
  const ctx = await requireUser();
  return (
    <SetPasswordForm
      title={`Welcome, ${ctx.profile.name}`}
      subtitle="Set a password for your account to finish setting it up."
    />
  );
}
