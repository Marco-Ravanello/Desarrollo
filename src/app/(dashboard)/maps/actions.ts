"use server";

import { auth } from "@/auth";
import { actionErrorMessage } from "@/lib/action-error";
import { PERMISSIONS, canAccessPath, hasPermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import type { MapFilters } from "@/lib/map-filters";
import { normalizeMapFilters } from "@/lib/map-filters";
import { getMapData, getMapExportRows, getMapPeople, type MapData, type MapExportRow, type MapPerson } from "@/services/map";

const DENIED = "Tu rol no tiene acceso al Mapa Social.";

async function mapSession() {
  const session = await auth();
  if (!session?.user?.id || !canAccessPath(session.user.role, "/maps")) return null;
  return session;
}

export async function getMapDataAction(filters: MapFilters): Promise<{ success: true; data: MapData } | { success: false; error: string }> {
  if (!(await mapSession())) return { success: false, error: DENIED };
  try {
    return { success: true, data: await getMapData(normalizeMapFilters(filters)) };
  } catch (err) {
    console.error("Error en getMapDataAction:", err);
    return { success: false, error: actionErrorMessage(err, "No se pudo cargar el mapa") };
  }
}

export async function getMapPeopleAction(dnis: string[]): Promise<{ success: true; people: MapPerson[] } | { success: false; error: string }> {
  if (!(await mapSession())) return { success: false, error: DENIED };
  try {
    return { success: true, people: await getMapPeople(Array.isArray(dnis) ? dnis : []) };
  } catch (err) {
    console.error("Error en getMapPeopleAction:", err);
    return { success: false, error: actionErrorMessage(err, "No se pudieron cargar los datos") };
  }
}

/** Planilla con nombres y direcciones: solo roles con permiso para exportar datos personales. */
export async function getMapExportAction(filters: MapFilters): Promise<{ success: true; rows: MapExportRow[] } | { success: false; error: string }> {
  const session = await mapSession();
  if (!session) return { success: false, error: DENIED };
  if (!hasPermission(session.user.role, PERMISSIONS.EXPORT_PERSONAL_DATA)) {
    return { success: false, error: "Tu rol no tiene permiso para exportar datos personales." };
  }
  try {
    const normalized = normalizeMapFilters(filters);
    const rows = await getMapExportRows(normalized);
    await prisma.auditLog
      .create({
        data: {
          userId: session.user.id!,
          action: "EXPORT_MAP_PEOPLE",
          entity: "PadronUnificado",
          entityId: "mapa-social",
          details: `Exportó ${rows.length} personas del Mapa Social (localidad: ${normalized.localityId}, programa: ${normalized.program}${normalized.query ? `, búsqueda: "${normalized.query}"` : ""}).`,
        },
      })
      .catch((e) => console.warn("AuditLog skipped:", e));
    return { success: true, rows };
  } catch (err) {
    console.error("Error en getMapExportAction:", err);
    return { success: false, error: actionErrorMessage(err, "No se pudo armar la planilla") };
  }
}
