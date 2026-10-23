"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { notifyDueFollowUps } from "@/services/follow-ups";
import { notifyExpirations } from "@/services/expiry-notices";

export async function getNotifications() {
  const session = await auth();
  if (!session?.user?.id) return [];

  // Los seguimientos que vencen hoy se avisan acá, la primera vez que se miran los avisos.
  try {
    await notifyDueFollowUps(session.user.id);
  } catch (error) {
    console.error("No se pudieron revisar los seguimientos de hoy:", error);
  }
  // Y los vencimientos de VTV, seguros y convenios, para quien los tiene que vigilar.
  try {
    await notifyExpirations({ id: session.user.id, role: session.user.role, areaId: session.user.areaId });
  } catch (error) {
    console.error("No se pudieron revisar los vencimientos:", error);
  }

  return await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
}

export async function markAsRead(id: string) {
  const session = await auth();
  if (!session?.user?.id) return;

  // Solo los avisos propios.
  await prisma.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { read: true }
  });

  revalidatePath("/");
}

export async function markAllAsRead() {
  const session = await auth();
  if (!session?.user?.id) return;

  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true }
  });

  revalidatePath("/");
}
