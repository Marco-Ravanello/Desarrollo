"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { notifyDueFollowUps } from "@/services/follow-ups";
import { notifyExpirations } from "@/services/expiry-notices";
import { noticesRecheckCutoff } from "@/lib/bell";

/**
 * Seguimientos que vencen hoy y vencimientos de VTV, seguros, convenios y documentos: se revisan acá,
 * pero no en cada consulta de la campanita sino cada 30 minutos por persona. La primera pestaña que
 * llega después de ese tiempo "toma" la revisión; las demás (y las otras computadoras) no la repiten.
 */
async function checkDueNotices(user: { id: string; role: any; areaId?: string | null }, now = new Date()) {
  const claimed = await prisma.user.updateMany({
    where: {
      id: user.id,
      OR: [{ noticesCheckedAt: null }, { noticesCheckedAt: { lt: noticesRecheckCutoff(now) } }],
    },
    data: { noticesCheckedAt: now },
  });
  if (claimed.count === 0) return;

  try {
    await notifyDueFollowUps(user.id, now);
  } catch (error) {
    console.error("No se pudieron revisar los seguimientos de hoy:", error);
  }
  try {
    await notifyExpirations({ id: user.id, role: user.role, areaId: user.areaId }, now);
  } catch (error) {
    console.error("No se pudieron revisar los vencimientos:", error);
  }
}

/** Lo que muestra la campanita, en un solo pedido: los últimos 10 avisos y cuántos hay sin leer en total. */
export async function getBellState() {
  const session = await auth();
  if (!session?.user?.id) return { items: [], unread: 0 };
  const user = { id: session.user.id, role: session.user.role, areaId: session.user.areaId };

  await checkDueNotices(user);

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  return { items, unread };
}

export async function markAsRead(id: string) {
  const session = await auth();
  if (!session?.user?.id) return;

  // Solo los avisos propios.
  await prisma.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { read: true }
  });
  // La campanita se actualiza sola: no hace falta volver a armar la página.
}

export async function markAllAsRead() {
  const session = await auth();
  if (!session?.user?.id) return;

  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true }
  });
  // La campanita se actualiza sola: no hace falta volver a armar la página.
}
