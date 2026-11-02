import { describe, expect, it } from "vitest";
import { isUrgentOpenCase, URGENT_OPEN_CASE_WHERE } from "@/lib/case-urgency";
import {
  AREA_DEFAULT_PAGE_SIZE,
  areaCaseListQuery,
  areaCaseListWhere,
  canOpenAreaPage,
  isAreaPageSlug,
  parseAreaCaseFilters,
} from "@/lib/area-cases";
import { TASK_PRIORITIES } from "@/lib/tasks";

describe("expedientes urgentes", () => {
  it("cuenta solo los abiertos o en proceso con prioridad urgente", () => {
    expect(isUrgentOpenCase({ status: "ABIERTO", priority: "URGENTE" })).toBe(true);
    expect(isUrgentOpenCase({ status: "EN_PROCESO", priority: "URGENTE" })).toBe(true);
    expect(isUrgentOpenCase({ status: "CERRADO", priority: "URGENTE" })).toBe(false);
    expect(isUrgentOpenCase({ status: "PENDIENTE", priority: "URGENTE" })).toBe(false);
    expect(isUrgentOpenCase({ status: "ABIERTO", priority: "ALTA" })).toBe(false);
  });

  it("la condición para la base dice lo mismo", () => {
    expect(URGENT_OPEN_CASE_WHERE).toEqual({ priority: "URGENTE", status: { in: ["ABIERTO", "EN_PROCESO"] } });
  });
});

describe("prioridad del medio en tareas", () => {
  it("se llama Media, como en el resto de la app", () => {
    expect(TASK_PRIORITIES.find((o) => o.value === "MEDIA")?.label).toBe("Media");
  });
});

describe("filtros de la página de área", () => {
  it("sin nada en la dirección muestra activos, primera página", () => {
    expect(parseAreaCaseFilters({})).toEqual({ tab: "ACTIVOS", priority: null, q: "", page: 1, limit: AREA_DEFAULT_PAGE_SIZE });
  });

  it("lee pestaña, prioridad, búsqueda y página, y descarta lo raro", () => {
    expect(parseAreaCaseFilters({ pestana: "cerrados", prioridad: "urgente", q: "  pérez ", page: "3", limit: "50" })).toEqual({
      tab: "CERRADOS", priority: "URGENTE", q: "pérez", page: 3, limit: 50,
    });
    expect(parseAreaCaseFilters({ pestana: "x", prioridad: "y", page: "-2", limit: "999" })).toEqual({
      tab: "ACTIVOS", priority: null, q: "", page: 1, limit: AREA_DEFAULT_PAGE_SIZE,
    });
  });

  it("arma la condición de la lista", () => {
    expect(areaCaseListWhere("a1", { tab: "ACTIVOS", priority: null, q: "" })).toEqual({
      areaId: "a1", status: { in: ["ABIERTO", "EN_PROCESO"] },
    });
    const w = areaCaseListWhere("a1", { tab: "TODOS", priority: "ALTA", q: "123" });
    expect(w.areaId).toBe("a1");
    expect(w.status).toBeUndefined();
    expect(w.priority).toBe("ALTA");
    expect(w.OR).toHaveLength(4);
  });

  it("la dirección solo lleva lo que no es por defecto", () => {
    expect(areaCaseListQuery({ tab: "ACTIVOS", page: 1, limit: AREA_DEFAULT_PAGE_SIZE, q: "" })).toBe("");
    expect(areaCaseListQuery({ tab: "DERIVADOS", priority: "BAJA", q: "ana", page: 2 })).toBe("?pestana=derivados&prioridad=baja&q=ana&page=2");
  });

  it("Violencia de Género solo para los roles de siempre", () => {
    const all = () => true;
    expect(isAreaPageSlug("violence")).toBe(true);
    expect(isAreaPageSlug("otra")).toBe(false);
    expect(canOpenAreaPage("VIOLENCIA_GENERO", "violence", all)).toBe(true);
    expect(canOpenAreaPage("ADMIN_GENERAL", "violence", all)).toBe(false);
    expect(canOpenAreaPage("OPERATIVO", "social", all)).toBe(true);
    expect(canOpenAreaPage("OPERATIVO", "social", () => false)).toBe(false);
    expect(canOpenAreaPage(null, "social", all)).toBe(false);
  });
});
