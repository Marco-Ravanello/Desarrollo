"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { actionErrorMessage } from "@/lib/action-error";
import { programSlug, isPadronProgramColumn } from "@/lib/padron-programs";
import { setProgramArea } from "@/services/programs";

/** Elige qué área tiene a cargo un programa (areaId vacío = ninguna). Solo la conducción. */
export async function setProgramAreaAction(column: string, areaId: string | null) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  try {
    const result = await setProgramArea(session.user, column, areaId || null);
    if (result.success && isPadronProgramColumn(column)) {
      revalidatePath("/people/programas");
      revalidatePath(`/people/programas/${programSlug(column)}`);
    }
    return result;
  } catch (error) {
    return { success: false as const, error: actionErrorMessage(error, "No se pudo cambiar el área a cargo") };
  }
}
