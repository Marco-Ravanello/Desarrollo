"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { actionErrorMessage } from "@/lib/action-error";
import { closeCase, reopenCase } from "@/services/case-closing";

const NO_SESSION = "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión.";

function revalidateCase(caseId: string) {
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
  revalidatePath("/people/[id]", "page");
  revalidatePath("/dashboard");
}

/** Cierra el expediente con un motivo, que queda en su historia. */
export async function closeCaseAction(caseId: string, reason: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: NO_SESSION };
  try {
    const result = await closeCase({ id: session.user.id, role: session.user.role }, { caseId, reason });
    if (result.success) revalidateCase(caseId);
    return result;
  } catch (error) {
    console.error(error);
    return { success: false, error: actionErrorMessage(error, "No se pudo cerrar el expediente") };
  }
}

/** Reabre un expediente cerrado, con un motivo que queda en su historia. */
export async function reopenCaseAction(caseId: string, reason: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: NO_SESSION };
  try {
    const result = await reopenCase({ id: session.user.id, role: session.user.role }, { caseId, reason });
    if (result.success) revalidateCase(caseId);
    return result;
  } catch (error) {
    console.error(error);
    return { success: false, error: actionErrorMessage(error, "No se pudo reabrir el expediente") };
  }
}
