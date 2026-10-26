"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { actionErrorMessage } from "@/lib/action-error";
import { enrollInProgram, withdrawFromProgram } from "@/services/program-enrollment";

const SESSION_ERROR = "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión.";

/** Alta de la persona en un programa del padrón, desde su ficha. */
export async function enrollInProgramAction(dni: string, column: string, day: string, note?: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: SESSION_ERROR };
  try {
    const result = await enrollInProgram(session.user, { dni, column, day, note });
    if (result.success) revalidatePath(`/people/${dni}`);
    return result;
  } catch (error) {
    return { success: false as const, error: actionErrorMessage(error, "No se pudo dar el alta") };
  }
}

/** Baja de la persona de un programa del padrón, con fecha y motivo. */
export async function withdrawFromProgramAction(dni: string, column: string, day: string, reason: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: SESSION_ERROR };
  try {
    const result = await withdrawFromProgram(session.user, { dni, column, day, reason });
    if (result.success) revalidatePath(`/people/${dni}`);
    return result;
  } catch (error) {
    return { success: false as const, error: actionErrorMessage(error, "No se pudo dar la baja") };
  }
}
