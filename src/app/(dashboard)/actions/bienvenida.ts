"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";

/** Anota que quien usa la app ya cerró la bienvenida, para no mostrársela otra vez. */
export async function markWelcomeSeenAction(): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  await prisma.user.updateMany({ where: { id: userId, welcomeSeenAt: null }, data: { welcomeSeenAt: new Date() } });
}
