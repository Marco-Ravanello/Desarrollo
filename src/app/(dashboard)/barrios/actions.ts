"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { barrioSlug } from "@/lib/barrios";
import { parseRecorridaCriteria } from "@/lib/recorridas";
import { createLugar, deleteLugar, updateLugar } from "@/services/barrios";
import {
  addVisita, createRecorrida, deleteRecorrida, saveVisita, setReferente, terminarRecorrida, updateRecorrida, type RecorridaInput,
} from "@/services/recorridas";

type Result = { success: true } | { success: false; error: string };

const SESSION_EXPIRED: Result = { success: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };

function refresh(barrio: string) {
  revalidatePath("/barrios");
  revalidatePath(`/barrios/${barrioSlug(barrio)}`);
}

export async function saveLugarAction(barrio: string, id: string | null, data: Record<string, unknown>): Promise<Result> {
  const session = await auth();
  if (!session?.user?.id) return SESSION_EXPIRED;
  const res = id ? await updateLugar(session.user, id, data) : await createLugar(session.user, barrio, data);
  if (res.success) refresh(barrio);
  return res;
}

export async function deleteLugarAction(barrio: string, id: string): Promise<Result> {
  const session = await auth();
  if (!session?.user?.id) return SESSION_EXPIRED;
  const res = await deleteLugar(session.user, id);
  if (res.success) refresh(barrio);
  return res;
}

// ---------------------------------------------------------------------------
// Recorridas y referente
// ---------------------------------------------------------------------------

function refreshRecorrida(id: string, barrio?: string) {
  revalidatePath(`/barrios/recorridas/${id}`);
  if (barrio) refresh(barrio);
}

/** Guarda una recorrida. `criteria` es la búsqueda de la lista (?motivo=…), para volver a armarla en el servidor. */
export async function createRecorridaAction(
  barrio: string,
  criteria: string,
  excluded: string[],
  input: RecorridaInput
): Promise<Result | { success: true; id: string }> {
  const session = await auth();
  if (!session?.user?.id) return SESSION_EXPIRED;
  const parsed = parseRecorridaCriteria(Object.fromEntries(groupParams(new URLSearchParams(criteria))));
  const res = await createRecorrida(session.user, barrio, parsed, Array.isArray(excluded) ? excluded : [], input);
  if (res.success) refresh(barrio);
  return res;
}

/** URLSearchParams → { clave: valor | valores[] } (motivo puede venir varias veces). */
function groupParams(p: URLSearchParams): [string, string | string[]][] {
  const out = new Map<string, string[]>();
  p.forEach((v, k) => out.set(k, [...(out.get(k) ?? []), v]));
  return [...out.entries()].map(([k, v]) => [k, v.length === 1 ? v[0] : v]);
}

export async function saveVisitaAction(recorridaId: string, visitaId: string, resultado: string, nota: string): Promise<Result> {
  const session = await auth();
  if (!session?.user?.id) return SESSION_EXPIRED;
  const res = await saveVisita(session.user, visitaId, resultado, nota);
  if (res.success) refreshRecorrida(recorridaId);
  return res;
}

export async function addVisitaAction(recorridaId: string, dni: string): Promise<Result> {
  const session = await auth();
  if (!session?.user?.id) return SESSION_EXPIRED;
  const res = await addVisita(session.user, recorridaId, dni);
  if (res.success) refreshRecorrida(recorridaId);
  return res;
}

export async function updateRecorridaAction(id: string, barrio: string, input: RecorridaInput): Promise<Result> {
  const session = await auth();
  if (!session?.user?.id) return SESSION_EXPIRED;
  const res = await updateRecorrida(session.user, id, input);
  if (res.success) refreshRecorrida(id, barrio);
  return res;
}

export async function terminarRecorridaAction(id: string, barrio: string, hallazgos: string, pendientes: string): Promise<Result> {
  const session = await auth();
  if (!session?.user?.id) return SESSION_EXPIRED;
  const res = await terminarRecorrida(session.user, id, hallazgos, pendientes);
  if (res.success) refreshRecorrida(id, barrio);
  return res;
}

export async function deleteRecorridaAction(id: string): Promise<Result | { success: true; barrio: string }> {
  const session = await auth();
  if (!session?.user?.id) return SESSION_EXPIRED;
  const res = await deleteRecorrida(session.user, id);
  if (res.success) refresh(res.barrio);
  return res;
}

export async function setReferenteAction(barrio: string, userId: string | null): Promise<Result> {
  const session = await auth();
  if (!session?.user?.id) return SESSION_EXPIRED;
  const res = await setReferente(session.user, barrio, userId || null);
  if (res.success) refresh(barrio);
  return res;
}
