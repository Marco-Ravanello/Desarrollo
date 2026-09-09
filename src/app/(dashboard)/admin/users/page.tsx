export const dynamic = "force-dynamic";

import { getUsers } from "@/services/system";
import { getAreas } from "@/services/cases";
import { getDeactivatedUserIds } from "@/app/(dashboard)/admin/actions/user-actions";
import { UsersManagementView } from "./users-management-view";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userRole = session.user.role;
  const canManage = hasPermission(userRole, PERMISSIONS.MANAGE_USERS) || userRole === "SUPERADMIN";

  if (!canManage) {
    redirect("/dashboard");
  }

  const [users, areas, deactivatedIds] = await Promise.all([
    getUsers(),
    getAreas(),
    getDeactivatedUserIds()
  ]);

  return (
    <UsersManagementView
      users={users as any}
      areas={areas as any}
      deactivatedIds={deactivatedIds}
      currentUserId={session.user.id}
    />
  );
}
