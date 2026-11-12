"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { notifyDueFollowUps } from "@/services/follow-ups";
import { notifyExpirations } from "@/services/expiry-notices";
import { KEEP_NOTICE_TITLE_PREFIXES, noticesRecheckCutoff, readNoticesCutoff } from "@/lib/bell";
import { UNDO_NOTICES_MAX } from "@/lib/undo";

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
  // Limpieza (idea 132): los avisos leídos de hace más de 6 meses se borran, salvo los de algo vencido.
  try {
    await prisma.notification.deleteMany({
      where: {
        userId: user.id,
        read: true,
        createdAt: { lt: readNoticesCutoff(now) },
        NOT: KEEP_NOTICE_TITLE_PREFIXES.map((p) => ({ title: { startsWith: p } })),
      },
    });
  } catch (error) {
    console.error("No se pudieron borrar los avisos viejos:", error);
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

/** Marca todos como leídos y devuelve cuáles eran, para poder deshacerlo. */
export async function markAllAsRead(): Promise<string[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const unread = await prisma.notification.findMany({
    where: { userId: session.user.id, read: false },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  const ids = unread.map((n) => n.id);
  if (ids.length === 0) return [];
  await prisma.notification.updateMany({
    where: { id: { in: ids }, userId: session.user.id },
    data: { read: true }
  });
  // La campanita se actualiza sola: no hace falta volver a armar la página.
  return ids.slice(0, UNDO_NOTICES_MAX);
}

/** "Deshacer" de "Marcar todas como leídas": esos avisos vuelven a quedar sin leer (solo los propios). */
export async function undoMarkAllAsRead(ids: string[]): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false };
  const clean = Array.isArray(ids) ? ids.filter((id) => typeof id === "string").slice(0, UNDO_NOTICES_MAX) : [];
  if (clean.length === 0) return { success: true };
  await prisma.notification.updateMany({
    where: { id: { in: clean }, userId: session.user.id, read: true },
    data: { read: false },
  });
  return { success: true };
}
