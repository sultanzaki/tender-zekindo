import { requireAdmin } from "@/lib/auth/dal";
import { getAllProfiles } from "@/lib/users";
import { ManageUsersClient } from "@/components/ManageUsersClient";

export const dynamic = "force-dynamic";

export default async function ManageUsersPage() {
  const ctx = await requireAdmin();
  const users = await getAllProfiles();
  return <ManageUsersClient users={users} currentUserId={ctx.userId} />;
}
