"use server";

import { createHRRecord, markBackFromLeave } from "@/services/hr";
import { deleteLeave, ensureLeaveForStatus, registerLeave } from "@/services/hr-leaves";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { ContractType, HRStatus, HRRecord } from "@prisma/client";
import { readHRForm } from "@/lib/hr-form";
import { canEditHR } from "@/lib/hr-labels";
import { ActionResult } from "@/types/actions";
import { actionErrorMessage } from "@/lib/action-error";

/** El DNI ya está en otro legajo: mensaje claro en vez del error de la base. */
async function dniTaken(dni: string, exceptId?: string) {
  const other = await prisma.hRRecord.findUnique({ where: { dni }, select: { id: true, firstName: true, lastName: true } });
  return other && other.id !== exceptId ? other : null;
}

/** Lo que vuelve al navegador al guardar: datos simples (el sueldo es Decimal y no se puede mandar). */
type SavedHR = { id: string; firstName: string; lastName: string };
const saved = (r: HRRecord): SavedHR => ({ id: r.id, firstName: r.firstName, lastName: r.lastName });

export async function createHRRecordAction(formData: FormData): Promise<ActionResult<SavedHR>> {
  const session = await auth();
  if (!session?.user || !canEditHR(session.user.role)) {
    return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  }

  const parsed = readHRForm((k) => formData.get(k) as string | null);
  if (!parsed.ok) return { success: false, error: parsed.error };
  const data = parsed.data;

  try {
    const taken = await dniTaken(data.dni);
    if (taken) return { success: false, error: `Ya hay un legajo con ese DNI: ${taken.lastName}, ${taken.firstName}.` };
    const newRecord = await createHRRecord(data);
    await ensureLeaveForStatus(newRecord.id, data.status, data.statusUntil, session.user.id ?? null);
    revalidatePath("/admin/hr");
    return { success: true, data: saved(newRecord) };
  } catch (error) {
    console.error(error);
    return { success: false, error: actionErrorMessage(error, "No se pudo crear el legajo") };
  }
}

export async function updateHRRecordAction(id: string, formData: FormData): Promise<ActionResult<SavedHR>> {
  const session = await auth();
  if (!session?.user || !canEditHR(session.user.role)) {
    return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  }

  const parsed = readHRForm((k) => formData.get(k) as string | null);
  if (!parsed.ok) return { success: false, error: parsed.error };
  const { contractType, status, ...rest } = parsed.data;

  try {
    const taken = await dniTaken(rest.dni, id);
    if (taken) return { success: false, error: `Ya hay otro legajo con ese DNI: ${taken.lastName}, ${taken.firstName}.` };
    const updatedRecord = await prisma.hRRecord.update({
      where: { id },
      data: { ...rest, contractType: contractType as ContractType, status: status as HRStatus },
    });
    await ensureLeaveForStatus(id, status, rest.statusUntil, session.user.id ?? null);
    revalidatePath("/admin/hr");
    revalidatePath(`/admin/hr/${id}`);
    return { success: true, data: saved(updatedRecord) };
  } catch (error) {
    console.error(error);
    return { success: false, error: actionErrorMessage(error, "No se pudo actualizar el legajo") };
  }
}

export async function deleteHRRecordAction(id: string): Promise<ActionResult<void>> {
  const session = await auth();
  if (!session?.user || !canEditHR(session.user.role)) {
    return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  }

  try {
    await prisma.hRRecord.update({ where: { id }, data: { status: 'BAJA' as HRStatus } });
    revalidatePath("/admin/hr");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, error: actionErrorMessage(error, "No se pudo dar de baja el agente") };
  }
}

/** "Ya volvió", desde la tarjeta "De licencia hoy" del inicio. */
export async function markBackFromLeaveAction(id: string): Promise<ActionResult<void>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  try {
    const result = await markBackFromLeave(session.user, id);
    if (!result.success) return result;
    revalidatePath("/dashboard");
    revalidatePath("/admin/hr");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, error: actionErrorMessage(error, "No se pudo marcar la vuelta") };
  }
}

export async function registerLeaveAction(hrRecordId: string, formData: FormData): Promise<ActionResult<void>> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  try {
    const res = await registerLeave(session.user, hrRecordId, {
      kind: formData.get("kind") as string | null,
      startDate: formData.get("startDate") as string | null,
      endDate: formData.get("endDate") as string | null,
      notes: formData.get("notes") as string | null,
    });
    if (!res.success) return res;
    revalidatePath("/admin/hr");
    revalidatePath(`/admin/hr/${hrRecordId}`);
    revalidatePath("/admin/hr/ausencias");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, error: actionErrorMessage(error, "No se pudo guardar la licencia") };
  }
}

export async function deleteLeaveAction(leaveId: string): Promise<ActionResult<void>> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  try {
    const res = await deleteLeave(session.user, leaveId);
    if (!res.success) return res;
    revalidatePath("/admin/hr", "layout");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, error: actionErrorMessage(error, "No se pudo borrar la licencia") };
  }
}
