"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { actionErrorMessage } from "@/lib/action-error";
import { enrollInProgram, undoWithdrawFromProgram, withdrawFromProgram } from "@/services/program-enrollment";
import { bulkEnroll, bulkWithdraw, previewBulkEnroll } from "@/services/program-bulk";

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

/** "Deshacer" justo después de dar una baja desde la ficha: vuelve a quedar en el programa. */
export async function undoWithdrawFromProgramAction(dni: string, column: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: SESSION_ERROR };
  try {
    const result = await undoWithdrawFromProgram(session.user, { dni, column });
    if (result.success) revalidatePath(`/people/${dni}`);
    return result;
  } catch (error) {
    return { success: false as const, error: actionErrorMessage(error, "No se pudo deshacer la baja") };
  }
}

/** Altas de varias personas juntas (desde la lista de posibles destinatarios o pegando los DNI). */
export async function bulkEnrollAction(column: string, dnis: string[], day: string, note?: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: SESSION_ERROR };
  try {
    const result = await bulkEnroll(session.user, { column, dnis, day, note });
    if (result.success) revalidatePath("/people/programas", "layout");
    return result;
  } catch (error) {
    return { success: false as const, error: actionErrorMessage(error, "No se pudieron dar las altas") };
  }
}

/** Bajas de varias personas juntas, con la misma fecha y el mismo motivo. */
export async function bulkWithdrawAction(column: string, dnis: string[], day: string, reason: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: SESSION_ERROR };
  try {
    const result = await bulkWithdraw(session.user, { column, dnis, day, reason });
    if (result.success) revalidatePath("/people/programas", "layout");
    return result;
  } catch (error) {
    return { success: false as const, error: actionErrorMessage(error, "No se pudieron dar las bajas") };
  }
}

/** Antes de dar las altas de una lista de DNI pegada: quiénes son y cuáles no se pueden. */
export async function previewBulkEnrollAction(column: string, text: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: SESSION_ERROR };
  try {
    return await previewBulkEnroll(session.user, column, text);
  } catch (error) {
    return { success: false as const, error: actionErrorMessage(error, "No se pudo revisar la lista") };
  }
}
