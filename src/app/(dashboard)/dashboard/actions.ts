"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { parseHomeLayout } from "@/lib/home-layout";
import { actionErrorMessage } from "@/lib/action-error";
import type { ActionResult } from "@/types/actions";

/**
 * Guarda el orden y las tarjetas escondidas del Inicio de quien está usando la app.
 * null vuelve al orden de siempre. Solo cambia cómo se ve el Inicio: qué tarjetas hay lo decide el rol.
 */
export async function saveHomeLayoutAction(raw: unknown): Promise<ActionResult<null>> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { success: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  }
  try {
    const pref = raw === null ? null : parseHomeLayout(raw);
    await prisma.user.update({
      where: { id: userId },
      data: { homeLayout: pref ? (pref as unknown as Prisma.InputJsonValue) : Prisma.DbNull },
    });
    revalidatePath("/dashboard");
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: actionErrorMessage(error, "No se pudo guardar el orden del Inicio.") };
  }
}
