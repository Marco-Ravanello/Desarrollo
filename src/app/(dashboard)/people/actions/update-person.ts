"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { actionErrorMessage } from "@/lib/action-error";
import { canEditSocialRecords } from "@/lib/permissions";
import { parsePersonDataForm, updatePersonData, type UpdatePersonDataResult } from "@/services/person-data";

type UpdatePersonResult = ({ success: true } & UpdatePersonDataResult) | { success: false; error: string };

/** "Editar datos" de la ficha. El DNI no se cambia: es el que identifica a la persona. */
export async function updatePersonAction(dni: string, formData: FormData): Promise<UpdatePersonResult> {
  const session = await auth();
  if (session?.user && !canEditSocialRecords(session.user.role)) {
    return { success: false, error: "Tu rol (Auditoría) puede consultar pero no cargar ni modificar datos." };
  }
  if (!session?.user?.id) {
    return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  }

  const parsed = parsePersonDataForm(formData);
  if ("error" in parsed) return { success: false, error: parsed.error };

  try {
    const result = await updatePersonData(dni, parsed.data, session.user.id);
    if (!result) return { success: false, error: "No encontramos a esta persona. Recargá la página y probá de nuevo." };

    revalidatePath(`/people/${dni}`);
    revalidatePath("/people");
    revalidatePath("/maps");
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: actionErrorMessage(error, "No se pudieron guardar los datos") };
  }
}
