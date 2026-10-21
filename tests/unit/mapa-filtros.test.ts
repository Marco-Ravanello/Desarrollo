import { describe, expect, it } from "vitest";
import { buildMapWhere, normalizeMapFilters } from "@/lib/map-filters";

describe("filtros del Mapa Social", () => {
  it("sin filtros trae a todo el padrón", () => {
    expect(buildMapWhere({})).toEqual({ where: "TRUE", params: [] });
    expect(buildMapWhere(null)).toEqual({ where: "TRUE", params: [] });
  });

  it("una localidad que no existe se toma como todo el partido", () => {
    expect(normalizeMapFilters({ localityId: "inventada'; DROP TABLE x" }).localityId).toBe("all");
    expect(buildMapWhere({ localityId: "inventada" }).where).toBe("TRUE");
  });

  it("los textos van siempre como parámetros, nunca dentro del SQL", () => {
    const { where, params } = buildMapWhere({ localityId: "caseros", program: "Envión'--", query: "Pérez' OR 1=1" });
    expect(where).not.toContain("Envión");
    expect(where).not.toContain("Pérez");
    expect(params).toContain("Envión'--");
    expect(params).toContain("%pérez' or 1=1%");
  });

  it("la localidad incluye a quienes viven cerca de su centro", () => {
    const { where, params } = buildMapWhere({ localityId: "caseros" });
    expect(where).toContain("sqrt(");
    expect(params).toContain(1.8);
    expect(params).toContain("%caseros%");
  });

  it("buscar un DNI con puntos busca solo los números", () => {
    const { params } = buildMapWhere({ query: "30.123.456" });
    expect(params).toContain("%30123456%");
  });
});

describe("varios programas a la vez", () => {
  it("toma hasta tres, sin repetir, y suma el programa de la forma anterior", () => {
    expect(normalizeMapFilters({ programs: ["A", "B", "A", " ", "C", "D"] }).programs).toEqual(["A", "B", "C"]);
    expect(normalizeMapFilters({ program: "Envión" }).programs).toEqual(["Envión"]);
    expect(normalizeMapFilters({ program: "all" }).programs).toEqual([]);
  });

  it("la marca por programa usa parámetros propios, después de los del filtro", () => {
    const { where, params, mask } = buildMapWhere({ programs: ["Envión", "Tarjeta"] }, { withMask: true });
    expect(where).toContain("IN ($1, $2)");
    expect(mask).toContain("$3");
    expect(mask).toContain("THEN 2");
    expect(params).toEqual(["Envión", "Tarjeta", "Envión", "Tarjeta"]);
    expect(buildMapWhere({}, { withMask: true }).mask).toBe("0");
  });
});
