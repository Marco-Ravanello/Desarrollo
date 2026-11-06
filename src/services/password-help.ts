import prisma from "@/lib/prisma";
import { findUserForLogin } from "@/services/login-security";
import {
  canRequestAgain,
  cleanHelpIdentifier,
  isHelpRequestVisible,
  PASSWORD_HELP_COOLDOWN_MS,
  PASSWORD_HELP_MAX_PER_HOUR,
  PASSWORD_HELP_SHOW_MS,
  passwordHelpNotice,
} from "@/lib/password-help";

/**
 * Pedido de clave temporal desde la pantalla de ingreso (idea 106). Ver src/lib/password-help.ts.
 * Devuelve si se avisó, solo para las pruebas: la pantalla de ingreso responde siempre lo mismo.
 */
export async function requestPasswordHelp(identifier: unknown, now = new Date()): Promise<boolean> {
  const value = cleanHelpIdentifier(identifier);
  if (!value) return false;
  const user = await findUserForLogin(value);
  if (!user || !user.isActive) return false;
  if (!canRequestAgain(user.passwordHelpRequestedAt, now)) return false;

  const hourAgo = new Date(now.getTime() - PASSWORD_HELP_COOLDOWN_MS);
  const recent = await prisma.user.count({ where: { passwordHelpRequestedAt: { gt: hourAgo } } });
  if (recent >= PASSWORD_HELP_MAX_PER_HOUR) return false;

  // Solo una de dos pestañas que piden a la vez llega a avisar.
  const marked = await prisma.user.updateMany({
    where: {
      id: user.id,
      OR: [{ passwordHelpRequestedAt: null }, { passwordHelpRequestedAt: { lte: hourAgo } }],
    },
    data: { passwordHelpRequestedAt: now },
  });
  if (marked.count === 0) return false;

  const superadmins = await prisma.user.findMany({
    where: { role: "SUPERADMIN", isActive: true, id: { not: user.id } },
    select: { id: true },
  });
  const notice = passwordHelpNotice(user);
  await prisma.$transaction([
    prisma.notification.createMany({ data: superadmins.map((s) => ({ userId: s.id, ...notice })) }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PASSWORD_HELP_REQUEST",
        entity: "User",
        entityId: user.id,
        details: "Pidió una clave temporal desde la pantalla de ingreso",
      },
    }),
  ]);
  return true;
}

export type PasswordHelpRequest = {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  requestedAt: Date;
};

/** Pedidos de la última semana, el más viejo primero (solo para el Superadmin). */
export async function getPasswordHelpRequests(now = new Date()): Promise<PasswordHelpRequest[]> {
  const rows = await prisma.user.findMany({
    where: { isActive: true, passwordHelpRequestedAt: { gt: new Date(now.getTime() - PASSWORD_HELP_SHOW_MS) } },
    select: { id: true, name: true, username: true, email: true, passwordHelpRequestedAt: true },
    orderBy: { passwordHelpRequestedAt: "asc" },
  });
  return rows
    .filter((r) => isHelpRequestVisible(r.passwordHelpRequestedAt, now))
    .map((r) => ({ id: r.id, name: r.name, username: r.username, email: r.email, requestedAt: r.passwordHelpRequestedAt! }));
}

/** Borra el pedido: al generar la clave, al descartarlo o al entrar bien con la contraseña. */
export async function clearPasswordHelpRequest(userId: string) {
  await prisma.user.updateMany({
    where: { id: userId, passwordHelpRequestedAt: { not: null } },
    data: { passwordHelpRequestedAt: null },
  });
}
