"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function getNotifications() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
}

export async function markAsRead(id: string) {
  const session = await auth();
  if (!session?.user?.id) return;

  await prisma.notification.update({
    where: { id },
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

export async function createNotification(userId: string, title: string, message: string, link?: string) {
  return await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      link,
      read: false
    }
  });
}
