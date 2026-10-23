"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Role, User } from "@prisma/client";
import { canCreateUsersAndResetPasswords, hasPermission, PERMISSIONS } from "@/lib/permissions";
import { newPasswordProblem } from "@/lib/password-rules";
import { generateTemporaryPassword } from "@/lib/temporary-password";
import { normalizeEmail, normalizeUsername, usernameProblem } from "@/lib/username";
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
  if (!session?.user || !canCreateUsersAndResetPasswords(session.user.role)) {
    return { success: false, error: "Solo el Superadmin puede crear usuarios." };
  }

  const name = formData.get("name") as string;
  const username = normalizeUsername(formData.get("username"));
  const emailCheck = normalizeEmail(formData.get("email"));
  const password = formData.get("password") as string;
  const role = formData.get("role") as Role;
  const areaId = formData.get("areaId") as string;

  if (!canAssignRole(session.user.role, role)) {
    return { success: false, error: "No tenés permiso para asignar ese rol." };
  }
  const userProblem = usernameProblem(username);
  if (userProblem) return { success: false, error: userProblem };
  if (!emailCheck.ok) return { success: false, error: emailCheck.error };
  const email = emailCheck.email;
  const passwordProblem = newPasswordProblem(password || "");
  if (passwordProblem) return { success: false, error: `Contraseña temporal: ${passwordProblem}` };
  if (role === Role.RELEVADOR_EMERGENCIA && !(await isEmergencyDbUpdated())) {
    return { success: false, error: EMERGENCY_DB_PENDING_MESSAGE };
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        username,
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
        details: `Nuevo usuario creado: ${username} con rol ${role}`
      }
    });

    revalidatePath("/admin/users");
    return { success: true, data: user, message: "Agente municipal registrado con éxito" };
  } catch (error) {
    console.error(error);
    if ((error as any).code === 'P2002') return { success: false, error: duplicateMessage(error) };
    return { success: false, error: actionErrorMessage(error, "No se pudo crear el usuario") };
  }
}

/** Qué dato está repetido cuando la base rechaza un usuario nuevo o un cambio. */
function duplicateMessage(error: unknown): string {
  const target = String((error as any)?.meta?.target ?? "");
  return target.includes("username") ? "Ya hay otra persona con ese nombre de usuario." : "Ya hay otra persona con ese correo.";
}

export interface UpdateUserInput {
  id: string;
  name: string;
  /** Solo el Superadmin cambia el nombre de usuario (es con lo que se ingresa). */
  username?: string;
  email?: string | null;
  role: Role;
  areaId?: string | null;
  password?: string;
  isActive?: boolean;
}

export async function updateUserAction(input: UpdateUserInput): Promise<ActionResult<User>> {
  const session = await auth();
  if (!session?.user || !canManageUsers(session.user.role)) {
    return { success: false, error: "No tenés permiso para modificar usuarios." };
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { id: input.id }
    });

    if (!existing) {
      return { success: false, error: "Usuario no encontrado" };
    }

    if (!canModifyUser(session.user.role, existing.role) || !canAssignRole(session.user.role, input.role)) {
      return { success: false, error: "No tenés permiso para asignar ese rol o modificar este usuario." };
    }
    if (input.password && !canCreateUsersAndResetPasswords(session.user.role)) {
      return { success: false, error: "Solo el Superadmin puede cambiar contraseñas desde acá. La tuya la cambiás en “Cambiar mi contraseña”." };
    }
    if (input.role === Role.RELEVADOR_EMERGENCIA && existing.role !== Role.RELEVADOR_EMERGENCIA && !(await isEmergencyDbUpdated())) {
      return { success: false, error: EMERGENCY_DB_PENDING_MESSAGE };
    }

    // Sin el campo, el correo queda como está; vacío, se borra.
    const emailCheck = input.email === undefined ? { ok: true as const, email: existing.email } : normalizeEmail(input.email);
    if (!emailCheck.ok) return { success: false, error: emailCheck.error };
    const email = emailCheck.email;
    if (email && email !== existing.email) {
      const duplicate = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" }, id: { not: input.id } } });
      if (duplicate) return { success: false, error: "Ya hay otra persona con ese correo." };
    }

    const dataToUpdate: any = {
      name: input.name,
      email,
      role: input.role,
      areaId: input.areaId || null,
    };

    if (input.username !== undefined) {
      const username = normalizeUsername(input.username);
      if (username !== existing.username) {
        if (!canCreateUsersAndResetPasswords(session.user.role)) {
          return { success: false, error: "Solo el Superadmin puede cambiar el nombre de usuario." };
        }
        const problem = usernameProblem(username);
        if (problem) return { success: false, error: problem };
        const taken = await prisma.user.findUnique({ where: { username } });
        if (taken && taken.id !== input.id) return { success: false, error: "Ya hay otra persona con ese nombre de usuario." };
        dataToUpdate.username = username;
      }
    }

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
        details: `Actualización de perfil/rol/área para usuario: ${updatedUser.username || updatedUser.email}`
      }
    });

    revalidatePath("/admin/users");
    return { success: true, data: updatedUser, message: "Usuario actualizado con éxito" };
  } catch (error: any) {
    console.error("Error al actualizar usuario:", error);
    if (error?.code === "P2002") return { success: false, error: duplicateMessage(error) };
    return { success: false, error: actionErrorMessage(error, "No se pudo actualizar el usuario") };
  }
}

export async function toggleUserStatusAction(userId: string) {
  const session = await auth();
  if (!session?.user || !canManageUsers(session.user.role)) {
    return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  }

  if (session.user.id === userId) {
    return { success: false, error: "No podés suspender tu propia cuenta." };
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true, email: true, username: true, role: true }
    });

    if (!existingUser) {
      return { success: false, error: "Usuario no encontrado" };
    }

    if (!canModifyUser(session.user.role, existingUser.role)) {
      return { success: false, error: "No tenés permiso para modificar este usuario." };
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
        details: `Cambio de estado de cuenta para ${existingUser.username || existingUser.email} (${newStatus ? 'Activo' : 'Suspendido'})`
      }
    });

    revalidatePath("/admin/users");
    return { success: true, isActive: updated.isActive, isDeactivated: !updated.isActive };
  } catch (error: any) {
    console.error("Error en toggleUserStatusAction:", error);
    return { success: false, error: actionErrorMessage(error, "No se pudo cambiar el estado del usuario") };
  }
}

/**
 * Genera una clave temporal para otra persona (solo el Superadmin). La clave anterior deja de
 * andar, la persona la cambia al ingresar y la clave se devuelve una sola vez (no se guarda en ningún lado).
 */
export async function resetTemporaryPasswordAction(userId: string): Promise<{ success: true; password: string } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id || !canCreateUsersAndResetPasswords(session.user.role)) {
    return { success: false, error: "Solo el Superadmin puede restablecer contraseñas." };
  }
  if (session.user.id === userId) {
    return { success: false, error: "Tu propia contraseña la cambiás en “Cambiar mi contraseña”." };
  }

  try {
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, username: true } });
    if (!target) return { success: false, error: "Usuario no encontrado" };

    const password = generateTemporaryPassword();
    await prisma.user.update({
      where: { id: target.id },
      data: { password: await bcrypt.hash(password, 10), mustChangePassword: true },
    });
    // También destraba la cuenta si estaba bloqueada por intentos fallidos (ver login-security).
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "PASSWORD_RESET",
        entity: "User",
        entityId: target.id,
        details: `Clave temporal generada para ${target.username || target.email}`,
      },
    });

    revalidatePath("/admin/users");
    return { success: true, password };
  } catch (error: any) {
    console.error("Error al generar clave temporal:", error);
    return { success: false, error: actionErrorMessage(error, "No se pudo generar la clave temporal") };
  }
}
