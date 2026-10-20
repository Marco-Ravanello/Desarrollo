import prisma from "@/lib/prisma";

// Bloqueo por intentos fallidos: después de MAX_FAILED_LOGINS contraseñas incorrectas en
// LOGIN_LOCK_MS, la cuenta queda bloqueada hasta que esos intentos salgan de la ventana.
// Los intentos se guardan en la auditoría. Lo usan el ingreso y el cambio de contraseña.
export const MAX_FAILED_LOGINS = 5;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;

export async function isAccountLocked(userId: string) {
  const windowStart = new Date(Date.now() - LOGIN_LOCK_MS);
  // Un ingreso correcto o una clave temporal nueva (la registra el Superadmin, sobre la cuenta) reinician la cuenta.
  const lastLogin = await prisma.auditLog.findFirst({
    where: {
      createdAt: { gt: windowStart },
      OR: [{ userId, action: "LOGIN" }, { entity: "User", entityId: userId, action: "PASSWORD_RESET" }],
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const failed = await prisma.auditLog.count({
    where: { userId, action: "LOGIN_FAILED", createdAt: { gt: lastLogin?.createdAt ?? windowStart } },
  });
  return failed >= MAX_FAILED_LOGINS;
}

export function logLogin(userId: string, action: "LOGIN" | "LOGIN_FAILED", details: string) {
  return prisma.auditLog
    .create({ data: { userId, action, entity: "User", entityId: userId, details } })
    .catch((error) => console.error("No se pudo registrar el intento de ingreso:", error));
}
