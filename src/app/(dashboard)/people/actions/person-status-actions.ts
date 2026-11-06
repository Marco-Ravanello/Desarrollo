"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { actionErrorMessage } from "@/lib/action-error";
import { clearPersonStatus, markPersonStatus } from "@/services/person-status";

const SESSION_ERROR = "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión.";

/** Marca que la persona falleció o se mudó fuera del distrito: sale de los programas, las recorridas y los avisos. */
export async function markPersonStatusAction(dni: string, estado: string, day: string, note: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: SESSION_ERROR };
  try {
    const result = await markPersonStatus(session.user, { dni, estado, day, note });
    if (result.success) revalidatePath(`/people/${dni}`);
    return result;
  } catch (error) {
    return { success: false as const, error: actionErrorMessage(error, "No se pudo guardar") };
  }
}

/** Saca la marca (por si fue un error). */
export async function clearPersonStatusAction(dni: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: SESSION_ERROR };
  try {
    const result = await clearPersonStatus(session.user, dni);
    if (result.success) revalidatePath(`/people/${dni}`);
    return result;
  } catch (error) {
    return { success: false as const, error: actionErrorMessage(error, "No se pudo deshacer") };
  }
}
