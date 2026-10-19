"use server";

import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { newPasswordProblem } from "@/lib/password-rules";
import { isAccountLocked, logLogin } from "@/services/login-security";

export type ChangePasswordResult = { success: true } | { success: false; error: string; field?: "current" | "next" | "confirm" };

/** Cada persona cambia su propia contraseña. Hace falta la actual (y cuenta para el bloqueo por intentos). */
export async function changeOwnPasswordAction(input: { current: string; next: string; confirm: string }): Promise<ChangePasswordResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Tu sesión venció. Volvé a iniciar sesión." };
  const userId = session.user.id;

  const current = String(input?.current ?? "");
  const next = String(input?.next ?? "");
  const confirm = String(input?.confirm ?? "");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, password: true, isActive: true } });
  if (!user || user.isActive === false || !user.password) {
    return { success: false, error: "No se pudo cambiar la contraseña de esta cuenta." };
  }
  if (await isAccountLocked(user.id)) {
    return { success: false, error: "Hubo demasiados intentos fallidos. Esperá 15 minutos y probá de nuevo.", field: "current" };
  }
  if (!(await bcrypt.compare(current, user.password))) {
    await logLogin(user.id, "LOGIN_FAILED", "Contraseña actual incorrecta al intentar cambiarla");
    return { success: false, error: "La contraseña actual no es correcta.", field: "current" };
  }

  const problem = newPasswordProblem(next, { current, email: user.email });
  if (problem) return { success: false, error: problem, field: "next" };
  if (next !== confirm) return { success: false, error: "Las dos contraseñas nuevas no coinciden.", field: "confirm" };

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(next, 10), mustChangePassword: false },
  });
  await prisma.auditLog
    .create({ data: { userId: user.id, action: "PASSWORD_CHANGED", entity: "User", entityId: user.id, details: "La persona cambió su contraseña" } })
    .catch((err) => console.warn("AuditLog creation skipped:", err));

  return { success: true };
}
