"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { actionErrorMessage } from "@/lib/action-error";
import { MANAGEMENT_ROLES } from "@/lib/permissions";
import { normalizeDni } from "@/lib/padron-import";
import type { GeocodingStatus } from "@/lib/geocoding";
import {
  GeocodingServiceError,
  geocodeNextGeorefBatch,
  geocodeNextOsmBatch,
  getGeocodingStatus,
  listGeocodingReview,
  retryWithAddress,
  setManualLocation,
  type GeocodeBatchResult,
  type GeocodingReviewRow,
} from "@/services/geocoding";

const DENIED = "Tu rol no tiene permiso para ubicar direcciones en el mapa.";

async function managementSession() {
  const session = await auth();
  if (!session?.user?.id || !MANAGEMENT_ROLES.includes(session.user.role)) return null;
  return session;
}

function serviceError(err: unknown, fallback: string) {
  if (err instanceof GeocodingServiceError) return err.message;
  console.error(fallback, err);
  return actionErrorMessage(err, fallback);
}

export async function getGeocodingStatusAction(): Promise<{ success: true; status: GeocodingStatus } | { success: false; error: string }> {
  if (!(await managementSession())) return { success: false, error: DENIED };
  try {
    return { success: true, status: await getGeocodingStatus() };
  } catch (err) {
    return { success: false, error: serviceError(err, "No se pudo leer cuántas direcciones faltan ubicar") };
  }
}

/** Una tanda de la búsqueda: primero Georef y, cuando no queda nada para Georef, OpenStreetMap. */
export async function geocodeBatchAction(
  phase: "georef" | "osm"
): Promise<{ success: true; result: GeocodeBatchResult; status: GeocodingStatus } | { success: false; error: string }> {
  if (!(await managementSession())) return { success: false, error: DENIED };
  try {
    const result = phase === "georef" ? await geocodeNextGeorefBatch() : await geocodeNextOsmBatch();
    if (result.located > 0) revalidatePath("/maps");
    return { success: true, result, status: await getGeocodingStatus() };
  } catch (err) {
    return { success: false, error: serviceError(err, "No se pudo seguir ubicando direcciones") };
  }
}

export async function listGeocodingReviewAction(
  query: string,
  page: number
): Promise<{ success: true; total: number; rows: GeocodingReviewRow[] } | { success: false; error: string }> {
  if (!(await managementSession())) return { success: false, error: DENIED };
  try {
    const { total, rows } = await listGeocodingReview(String(query || "").slice(0, 100), Math.max(1, Math.floor(Number(page) || 1)));
    return { success: true, total, rows };
  } catch (err) {
    return { success: false, error: serviceError(err, "No se pudo cargar la lista") };
  }
}

async function audit(userId: string, dni: string, details: string) {
  await prisma.auditLog
    .create({ data: { userId, action: "PADRON_GEO_UPDATE", entity: "PadronUnificado", entityId: dni, details } })
    .catch((e) => console.warn("AuditLog skipped:", e));
}

export async function retryAddressAction(dniInput: string, direccion: string) {
  const session = await managementSession();
  if (!session) return { success: false as const, error: DENIED };
  const dni = normalizeDni(dniInput);
  if (!dni || !(await prisma.padronUnificado.findUnique({ where: { dni }, select: { dni: true } }))) {
    return { success: false as const, error: "No se encontró a la persona en el padrón." };
  }
  if (!String(direccion || "").trim()) return { success: false as const, error: "Escribí la dirección." };
  try {
    const res = await retryWithAddress(dni, String(direccion));
    await audit(session.user.id!, dni, `Dirección corregida para ubicar en el mapa: "${String(direccion).trim().slice(0, 200)}". ${res.located ? `Ubicada con ${res.fuente === "OSM" ? "OpenStreetMap" : "Georef"}.` : "No se encontró."} Por ${session.user.name || session.user.email}.`);
    revalidatePath("/maps");
    return { success: true as const, located: res.located };
  } catch (err) {
    return { success: false as const, error: serviceError(err, "No se pudo buscar la dirección") };
  }
}

export async function setManualLocationAction(dniInput: string, lat: number, lon: number) {
  const session = await managementSession();
  if (!session) return { success: false as const, error: DENIED };
  const dni = normalizeDni(dniInput);
  if (!dni || !(await prisma.padronUnificado.findUnique({ where: { dni }, select: { dni: true } }))) {
    return { success: false as const, error: "No se encontró a la persona en el padrón." };
  }
  try {
    const ok = await setManualLocation(dni, { lat: Number(lat), lon: Number(lon) });
    if (!ok) return { success: false as const, error: "El punto marcado queda fuera de Tres de Febrero." };
    await audit(session.user.id!, dni, `Ubicación marcada a mano en el mapa por ${session.user.name || session.user.email}.`);
    revalidatePath("/maps");
    return { success: true as const };
  } catch (err) {
    return { success: false as const, error: serviceError(err, "No se pudo guardar el punto") };
  }
}
