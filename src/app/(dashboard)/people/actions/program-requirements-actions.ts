"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { actionErrorMessage } from "@/lib/action-error";
import { isPadronProgramColumn, programSlug } from "@/lib/padron-programs";
import { saveProgramRequirements } from "@/services/program-requirements";
import { enrollInProgram } from "@/services/program-enrollment";

const SESSION_ERROR = "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión.";

/** Guarda los requisitos simples de un programa. */
export async function saveProgramRequirementsAction(column: string, input: Record<string, unknown>) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: SESSION_ERROR };
  try {
    const result = await saveProgramRequirements(session.user, column, input);
    if (result.success && isPadronProgramColumn(column)) {
      revalidatePath(`/people/programas/${programSlug(column)}`);
      revalidatePath(`/people/programas/${programSlug(column)}/destinatarios`);
    }
    return result;
  } catch (error) {
    return { success: false as const, error: actionErrorMessage(error, "No se pudieron guardar los requisitos") };
  }
}

/** Alta con un toque desde la lista de posibles destinatarios (con la fecha de hoy). */
export async function enrollCandidateAction(dni: string, column: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: SESSION_ERROR };
  try {
    const result = await enrollInProgram(session.user, { dni, column, note: "Desde la lista de posibles destinatarios." });
    if (result.success && isPadronProgramColumn(column)) {
      revalidatePath(`/people/${dni}`);
      revalidatePath(`/people/programas/${programSlug(column)}`);
      revalidatePath(`/people/programas/${programSlug(column)}/destinatarios`);
    }
    return result;
  } catch (error) {
    return { success: false as const, error: actionErrorMessage(error, "No se pudo dar el alta") };
  }
}
