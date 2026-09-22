export const dynamic = "force-dynamic";

import { getUsers } from "@/services/system";
import { getAreas } from "@/services/cases";
import { UsersManagementView } from "./users-management-view";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; create?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userRole = session.user.role;
  const canManage =
    hasPermission(userRole, PERMISSIONS.MANAGE_USERS) ||
    userRole === "SUPERADMIN" ||
    userRole === "DIRECCION_GENERAL" ||
    userRole === "ADMIN_GENERAL";

  if (!canManage) {
    redirect("/dashboard");
  }

  const { new: isNew, create } = await searchParams;
  const autoOpenNew = Boolean(isNew === "true" || isNew === "1" || create === "true" || create === "1");

  const [usersRaw, areas] = await Promise.all([
    getUsers(),
    getAreas(),
  ]);

  const sanitizedUsers = (usersRaw || []).map((u: any) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    areaId: u.areaId,
    area: u.area ? { id: u.area.id, name: u.area.name } : null,
    isActive: u.isActive !== undefined && u.isActive !== null ? Boolean(u.isActive) : true,
  }));

  return (
    <UsersManagementView
      users={sanitizedUsers}
      areas={areas as any}
      currentUserId={session.user.id}
      autoOpenNew={autoOpenNew}
    />
  );
}
