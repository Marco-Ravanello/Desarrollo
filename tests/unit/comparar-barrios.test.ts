import { describe, expect, it } from "vitest";
import {
  comparisonRows, decimalText, highDemandLowCoverage, isCompareSort, labelTotals, per1000, percent, sortComparison, topLabels, type ComparisonInput,
} from "@/lib/barrio-comparison";
import { ASSISTANT_TOOLS, validateToolArgs } from "@/lib/assistant-tools";

const barrio = (barrio: string, people: number, openCases: number, withPrograms: number, extra: Partial<ComparisonInput> = {}): ComparisonInput => ({
  barrio,
  slug: barrio.toLowerCase(),
  people,
  withPrograms,
  openCases,
  sinTelefono: 0,
  sinAltura: 0,
  sinUbicacion: 0,
  labels: {},
  ...extra,
});

describe("comparar barrios (idea 42)", () => {
  it("calcula cada 1.000 y porcentajes, sin dividir por cero", () => {
    expect(per1000(3, 200)).toBe(15);
    expect(per1000(1, 3)).toBe(333.3);
    expect(per1000(5, 0)).toBeNull();
    expect(percent(1, 3)).toBe(33.3);
    expect(decimalText(12.5)).toBe("12,5");
    expect(decimalText(null)).toBe("—");
    const [r] = comparisonRows([barrio("Caseros", 200, 4, 100, { sinTelefono: 50 })]);
    expect(r).toMatchObject({ casesPer1000: 20, coverage: 50, faltaTelefono: 25, faltaAltura: 0 });
  });

  it("ordena por la columna elegida y deja al final los barrios sin personas", () => {
    const rows = comparisonRows([barrio("Bosch", 100, 1, 80), barrio("Andes", 100, 9, 10), barrio("Vacío", 0, 0, 0), barrio("Ciudadela", 100, 5, 30)]);
    expect(sortComparison(rows, "expedientes").map((r) => r.barrio)).toEqual(["Andes", "Ciudadela", "Bosch", "Vacío"]);
    expect(sortComparison(rows, "cobertura").map((r) => r.barrio)).toEqual(["Andes", "Ciudadela", "Bosch", "Vacío"]);
    expect(sortComparison(rows, "barrio").map((r) => r.barrio)).toEqual(["Andes", "Bosch", "Ciudadela", "Vacío"]);
    expect(isCompareSort("telefono")).toBe(true);
    expect(isCompareSort("DROP")).toBe(false);
  });

  it("dónde mirar primero: mucha demanda y poca cobertura, solo con suficientes personas", () => {
    const rows = comparisonRows([
      barrio("A", 200, 10, 20), // 50 cada 1.000, 10 %
      barrio("B", 200, 2, 150),
      barrio("C", 200, 4, 100),
      barrio("D", 200, 1, 160),
      barrio("E", 200, 6, 90),
      barrio("F", 200, 3, 120),
      barrio("Chico", 10, 9, 0), // muy pocas personas: no entra
    ]);
    expect(highDemandLowCoverage(rows).map((r) => r.barrio)).toEqual(["A", "E"]);
    expect(highDemandLowCoverage(rows.slice(0, 2))).toEqual([]);
  });
});

describe("mapa de necesidades (idea 43)", () => {
  it("suma etiquetas y elige las que más aparecen", () => {
    const totals = labelTotals([{ NINEZ: 3, ADULTO_MAYOR: 1 }, { NINEZ: 2, CONSUMO: 0 }, {}]);
    expect(totals).toEqual({ NINEZ: 5, ADULTO_MAYOR: 1, CONSUMO: 0 });
    expect(topLabels(totals, 2)).toEqual([{ key: "NINEZ", total: 5 }, { key: "ADULTO_MAYOR", total: 1 }]);
    expect(topLabels({ CONSUMO: 0 }, 3)).toEqual([]);
  });

  it("el asistente tiene su consulta, con filtros válidos", () => {
    const tool = ASSISTANT_TOOLS.find((t) => t.name === "comparar_barrios");
    expect(tool?.path).toBe("/barrios/comparar");
    expect(validateToolArgs("comparar_barrios", { orden: "cobertura", etiqueta: "NINEZ", sql: "x" })).toEqual({ orden: "cobertura", etiqueta: "NINEZ" });
    expect(validateToolArgs("comparar_barrios", { orden: "borrar", etiqueta: "otra" })).toEqual({});
  });
});
