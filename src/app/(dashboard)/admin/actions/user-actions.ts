"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Role, User } from "@prisma/client";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { ActionResult } from "@/types/actions";
import { actionErrorMessage } from "@/lib/action-error";
import { isEmergencyDbUpdated, EMERGENCY_DB_PENDING_MESSAGE } from "@/services/emergency-db-status";

function canManageUsers(role?: string | null): boolean {
  if (!role) return false;
  return (
    role === "SUPERADMIN" ||
    role === "ADMIN_GENERAL" ||
    role === "DIRECCION_GENERAL" ||
    hasPermission(role as any, PERMISSIONS.MANAGE_USERS)
  );
}

// Solo un SUPERADMIN puede otorgar el rol SUPERADMIN o modificar a otro SUPERADMIN.
function canAssignRole(actorRole: string | null | undefined, targetRole: Role): boolean {
  if (!Object.values(Role).includes(targetRole)) return false;
  if (targetRole === Role.SUPERADMIN) return actorRole === Role.SUPERADMIN;
  return true;
}

function canModifyUser(actorRole: string | null | undefined, targetUserRole: Role): boolean {
  if (targetUserRole === Role.SUPERADMIN) return actorRole === Role.SUPERADMIN;
  return true;
}

export async function createUserAction(formData: FormData): Promise<ActionResult<User>> {
  const session = await auth();
  if (!session?.user || !canManageUsers(session.user.role)) {
    return { success: false, error: "Solo los administradores autorizados pueden crear usuarios" };
  }

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const role = formData.get("role") as Role;
  const areaId = formData.get("areaId") as string;

  if (!canAssignRole(session.user.role, role)) {
    return { success: false, error: "No tiene permisos para asignar ese rol" };
  }
  if (role === Role.RELEVADOR_EMERGENCIA && !(await isEmergencyDbUpdated())) {
    return { success: false, error: EMERGENCY_DB_PENDING_MESSAGE };
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        // La contraseña la eligió el administrador: la persona la cambia al ingresar.
        mustChangePassword: true,
        role,
        areaId: areaId || null,
        isActive: true,
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: 'CREATE_USER',
        entity: 'User',
        entityId: user.id,
        details: `Nuevo usuario creado: ${email} con rol ${role}`
      }
    });

    revalidatePath("/admin/users");
    return { success: true, data: user, message: "Agente municipal registrado con éxito" };
  } catch (error) {
    console.error(error);
    if ((error as any).code === 'P2002') return { success: false, error: "Ya existe un usuario con ese email" };
    return { success: false, error: actionErrorMessage(error, "No se pudo crear el usuario") };
  }
}

export interface UpdateUserInput {
  id: string;
  name: string;
  email: string;
  role: Role;
  areaId?: string | null;
  password?: string;
  isActive?: boolean;
}

export async function updateUserAction(input: UpdateUserInput): Promise<ActionResult<User>> {
  const session = await auth();
  if (!session?.user || !canManageUsers(session.user.role)) {
    return { success: false, error: "No tiene permisos para modificar usuarios" };
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { id: input.id }
    });

    if (!existing) {
      return { success: false, error: "Usuario no encontrado" };
    }

    if (!canModifyUser(session.user.role, existing.role) || !canAssignRole(session.user.role, input.role)) {
      return { success: false, error: "No tiene permisos para asignar ese rol o modificar este usuario" };
    }
    if (input.role === Role.RELEVADOR_EMERGENCIA && existing.role !== Role.RELEVADOR_EMERGENCIA && !(await isEmergencyDbUpdated())) {
      return { success: false, error: EMERGENCY_DB_PENDING_MESSAGE };
    }

    if (input.email !== existing.email) {
      const duplicate = await prisma.user.findUnique({
        where: { email: input.email }
      });
      if (duplicate && duplicate.id !== input.id) {
        return { success: false, error: "El correo electrónico ya está registrado por otro agente" };
      }
    }

    const dataToUpdate: any = {
      name: input.name,
      email: input.email,
      role: input.role,
      areaId: input.areaId || null,
    };

    if (typeof input.isActive === "boolean") {
      dataToUpdate.isActive = input.isActive;
    }

    if (input.password && input.password.trim().length >= 6) {
      dataToUpdate.password = await bcrypt.hash(input.password.trim(), 10);
      // Clave nueva puesta por otra persona: hay que cambiarla al ingresar.
      if (input.id !== session.user.id) dataToUpdate.mustChangePassword = true;
    }

    const updatedUser = await prisma.user.update({
      where: { id: input.id },
      data: dataToUpdate
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: 'UPDATE_USER',
        entity: 'User',
        entityId: updatedUser.id,
        details: `Actualización de perfil/rol/área para usuario: ${updatedUser.email}`
      }
    });

    revalidatePath("/admin/users");
    return { success: true, data: updatedUser, message: "Usuario actualizado con éxito" };
  } catch (error: any) {
    console.error("Error al actualizar usuario:", error);
    return { success: false, error: actionErrorMessage(error, "No se pudo actualizar el usuario") };
  }
}

export async function toggleUserStatusAction(userId: string) {
  const session = await auth();
  if (!session?.user || !canManageUsers(session.user.role)) {
    return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  }

  if (session.user.id === userId) {
    return { success: false, error: "No puede desactivar su propia cuenta activa de administrador" };
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true, email: true, role: true }
    });

    if (!existingUser) {
      return { success: false, error: "Usuario no encontrado" };
    }

    if (!canModifyUser(session.user.role, existingUser.role)) {
      return { success: false, error: "No tiene permisos para modificar este usuario" };
    }

    const newStatus = existingUser.isActive === false ? true : false;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { isActive: newStatus }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: newStatus ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
        entity: 'User',
        entityId: userId,
        details: `Cambio de estado de cuenta para ${existingUser.email} (${newStatus ? 'Activo' : 'Suspendido'})`
      }
    });

    revalidatePath("/admin/users");
    return { success: true, isActive: updated.isActive, isDeactivated: !updated.isActive };
  } catch (error: any) {
    console.error("Error en toggleUserStatusAction:", error);
    return { success: false, error: actionErrorMessage(error, "No se pudo cambiar el estado del usuario") };
  }
}
