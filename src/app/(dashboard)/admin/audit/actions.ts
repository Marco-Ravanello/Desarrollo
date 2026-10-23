"use server";

import { auth } from "@/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { auditEntityLabel, describeAuditAction, formatAuditDetails } from "@/lib/audit-labels";
import { formatFechaHora } from "@/lib/fechas";
import { exportAuditLogs, parseAuditFilters } from "@/services/audit";
import { actionErrorMessage } from "@/lib/action-error";

/** Los movimientos filtrados, listos para la planilla de Excel. */
export async function exportAuditAction(params: Record<string, string | undefined>) {
  const session = await auth();
  if (!session?.user || !hasPermission(session.user.role as any, PERMISSIONS.VIEW_AUDIT_LOGS)) {
    return { success: false as const, error: "No tenés permiso para descargar la Auditoría." };
  }
  try {
    const rows = await exportAuditLogs(parseAuditFilters(params));
    return {
      success: true as const,
      rows: rows.map((log) => ({
        "Fecha y hora": formatFechaHora(log.createdAt),
        Persona: log.user.name || log.user.username || log.user.email || "",
        Área: log.user.area?.name || "",
        "Qué hizo": describeAuditAction(log.action, log.entity).label,
        Sobre: auditEntityLabel(log.entity),
        Detalle: formatAuditDetails(log.details),
      })),
    };
  } catch (error) {
    return { success: false as const, error: actionErrorMessage(error, "No se pudo armar la descarga") };
  }
}
