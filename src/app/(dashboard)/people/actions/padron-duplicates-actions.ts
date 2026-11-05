"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { actionErrorMessage } from "@/lib/action-error";
import { MANAGEMENT_ROLES } from "@/lib/permissions";
import { dismissPadronDuplicate, mergePadronDuplicates } from "@/services/padron-duplicates";
import { getMergeSide, mergePeople, searchMergeCandidates } from "@/services/person-merge";
import type { MergeCandidate, MergeSide } from "@/lib/person-merge";

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

// "Unir con otra ficha", desde la ficha de una persona. Solo la conducción, como "Posibles duplicados".

export async function searchMergeCandidatesAction(currentDni: string, query: string): Promise<MergeCandidate[]> {
  const access = await managementUserId();
  if ("error" in access) return [];
  return searchMergeCandidates(String(currentDni || "").trim(), String(query || "").slice(0, 80));
}

export async function previewMergeAction(
  currentDni: string,
  otherDni: string
): Promise<{ success: true; a: MergeSide; b: MergeSide } | { success: false; error: string }> {
  const access = await managementUserId();
  if ("error" in access) return { success: false, error: access.error! };
  const a = String(currentDni || "").trim();
  const b = String(otherDni || "").trim();
  if (!b) return { success: false, error: "Escribí el DNI o el nombre de la otra ficha." };
  if (a === b) return { success: false, error: "Es la misma ficha. Elegí otra." };
  const [sideA, sideB] = await Promise.all([getMergeSide(a), getMergeSide(b)]);
  if (!sideA) return { success: false, error: "No encontré esta ficha. Actualizá la página." };
  if (!sideB) return { success: false, error: `No encontré ninguna ficha con el DNI ${b}.` };
  return { success: true, a: sideA, b: sideB };
}

export async function mergePeopleAction(keepDni: string, removeDni: string): Promise<{ success: true; keepDni: string } | { success: false; error: string }> {
  const access = await managementUserId();
  if ("error" in access) return { success: false, error: access.error! };
  const keep = String(keepDni || "").trim();
  const remove = String(removeDni || "").trim();
  try {
    await mergePeople(access.userId, keep, remove);
    revalidatePath("/people");
    revalidatePath(`/people/${encodeURIComponent(keep)}`);
    revalidatePath("/people/duplicados");
    return { success: true, keepDni: keep };
  } catch (err) {
    return { success: false, error: actionErrorMessage(err, "No se pudieron unir las dos fichas") };
  }
}
