"use server";

import { findExistingPersonByDni } from "@/services/people";
import { createPersonRecord, parsePersonDataForm } from "@/services/person-data";
import { applyPickedPoint, type RelocateResult } from "@/services/geocoding";
import { parsePickedPoint } from "@/lib/address-preview";
import { createAuditLog } from "@/services/system";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { actionErrorMessage } from "@/lib/action-error";
import { canEditSocialRecords } from "@/lib/permissions";

type CreatePersonResult =
  | { success: true; id: string; ubicacion: RelocateResult }
  | { success: false; error: string; existingId?: string };

export async function createPersonAction(formData: FormData): Promise<CreatePersonResult> {
  const session = await auth();
  if (session?.user && !canEditSocialRecords(session.user.role)) {
    return { success: false, error: "Tu rol (Auditoría) puede consultar pero no cargar ni modificar datos." };
  }
  if (!session?.user?.id) {
    return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  }

  // "12.345.678" se guarda como "12345678"; un pasaporte u otro documento queda como se escribió.
  const rawDni = String(formData.get("dni") ?? "").trim();
  const dni = /^[\d.\s]+$/.test(rawDni) ? rawDni.replace(/[.\s]/g, "") : rawDni.slice(0, 30);
  if (!dni) return { success: false, error: "Completá el DNI." };

  const parsed = parsePersonDataForm(formData);
  if ("error" in parsed) return { success: false, error: parsed.error };
  if (!parsed.data.direccion && !parsed.data.barrio) {
    return { success: false, error: "Completá la calle y altura, o al menos el barrio." };
  }

  try {
    // Si ya está cargada no se toca: se avisa y se ofrece ir a su ficha (para corregir datos está "Editar datos").
    const existing = await findExistingPersonByDni(dni);
    if (existing) {
      return {
        success: false,
        error: `Esta persona ya está cargada: ${existing.nombre} (DNI ${dni}). No se cambió nada.`,
        existingId: existing.id,
      };
    }

    const created = await createPersonRecord(dni, parsed.data);
    const { id } = created;
    let ubicacion = created.ubicacion;
    await createAuditLog(session.user.id, "CREATE", "Person", id, { dni });
    // El punto que se marcó en el mapa del formulario (idea 157) manda sobre el que se buscó solo.
    const picked = parsePickedPoint(formData.get("punto_lat"), formData.get("punto_lon"));
    if (picked && (await applyPickedPoint(dni, picked, session.user.id).catch(() => false))) ubicacion = "UBICADA";

    revalidatePath("/people");
    revalidatePath("/maps");
    return { success: true, id, ubicacion };
  } catch (error: any) {
    if (error?.code === "P2002") {
      return { success: false, error: "Esta persona ya está cargada. No se cambió nada." };
    }
    return { success: false, error: actionErrorMessage(error, "No se pudo guardar la persona") };
  }
}
