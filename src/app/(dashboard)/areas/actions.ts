"use server";

import { auth } from "@/auth";
import { canAccessPath } from "@/lib/permissions";
import { AREA_PAGES, canOpenAreaPage, isAreaPageSlug, parseAreaCaseFilters } from "@/lib/area-cases";
import { getAreaCasesForExport } from "@/services/cases";
import { CASE_PRIORITY_LABEL, CASE_STATUS_LABEL, isProvisionalDni, splitCaseTitle } from "@/lib/case-summary";
import { formatFecha } from "@/lib/fechas";
import { nombrePropio } from "@/lib/nombres";

export interface AreaExportRow {
  title: string;
  tag: string;
  citizenName: string;
  dni: string;
  status: string;
  priority: string;
  updatedAt: string;
  interventionsCount: number;
}

/**
 * Exporta todos los expedientes del área que cumplen los filtros de la pantalla (no solo la página
 * que se ve). Vuelve a revisar quién pide: las mismas reglas que para abrir la página del área.
 */
export async function getAreaExportAction(
  slug: string,
  rawFilters: { pestana?: string; prioridad?: string; q?: string }
): Promise<{ success: true; rows: AreaExportRow[]; truncated: boolean } | { success: false; error: string }> {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id || !role) return { success: false, error: "Tu sesión se cerró. Volvé a entrar." };
  if (!isAreaPageSlug(slug)) return { success: false, error: "No encontramos esa área." };
  if (!canOpenAreaPage(role, slug, (path) => canAccessPath(role, path))) {
    return { success: false, error: "No tenés permiso para exportar esta área." };
  }

  const filters = parseAreaCaseFilters({
    pestana: rawFilters?.pestana,
    prioridad: rawFilters?.prioridad,
    q: rawFilters?.q,
  });

  try {
    const { cases, truncated } = await getAreaCasesForExport(AREA_PAGES[slug].keywords, filters);
    const rows = cases.map((c) => {
      const shown = splitCaseTitle(c.title);
      return {
        title: shown.title,
        tag: shown.tag ?? "",
        citizenName: c.person ? nombrePropio(`${c.person.lastName}, ${c.person.firstName}`) : "Sin titular",
        dni: !c.person ? "" : isProvisionalDni(c.person.dni) ? "Sin DNI" : c.person.dni,
        status: CASE_STATUS_LABEL[c.status] ?? c.status,
        priority: CASE_PRIORITY_LABEL[c.priority] ?? c.priority,
        updatedAt: formatFecha(c.updatedAt),
        interventionsCount: c._count.interventions,
      };
    });
    return { success: true, rows, truncated };
  } catch (error) {
    console.error("getAreaExportAction", error);
    return { success: false, error: "No se pudo preparar la planilla. Probá de nuevo en un rato." };
  }
}
