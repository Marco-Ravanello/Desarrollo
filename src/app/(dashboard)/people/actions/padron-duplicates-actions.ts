"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { actionErrorMessage } from "@/lib/action-error";
import { MANAGEMENT_ROLES } from "@/lib/permissions";
import { dismissPadronDuplicate, mergePadronDuplicates } from "@/services/padron-duplicates";

type Result = { success: true } | { success: false; error: string };

async function managementUserId() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Tu sesión expiró. Volvé a iniciar sesión." } as const;
  if (!MANAGEMENT_ROLES.includes(session.user.role)) return { error: "Tu rol no tiene permiso para unir personas del padrón." } as const;
  return { userId: session.user.id } as const;
}

/** Une dos registros del padrón: queda `keepDni` y se borra `removeDni`, pasando todo lo suyo al que queda. */
export async function mergePadronDuplicatesAction(keepDni: string, removeDni: string): Promise<Result> {
  const access = await managementUserId();
  if ("error" in access) return { success: false, error: access.error! };
  try {
    await mergePadronDuplicates(access.userId, String(keepDni || "").trim(), String(removeDni || "").trim());
    revalidatePath("/people/duplicados");
    revalidatePath("/people");
    return { success: true };
  } catch (err) {
    return { success: false, error: actionErrorMessage(err, "No se pudieron unir las dos personas") };
  }
}

/** Marca el par como personas distintas: no vuelve a aparecer en la lista. */
export async function dismissPadronDuplicateAction(dniA: string, dniB: string): Promise<Result> {
  const access = await managementUserId();
  if ("error" in access) return { success: false, error: access.error! };
  try {
    await dismissPadronDuplicate(access.userId, String(dniA || "").trim(), String(dniB || "").trim());
    revalidatePath("/people/duplicados");
    return { success: true };
  } catch (err) {
    return { success: false, error: actionErrorMessage(err, "No se pudo guardar la revisión") };
  }
}
