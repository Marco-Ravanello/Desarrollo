import { describe, expect, it } from "vitest";
import { caseLabelName, describeLabelChange, isCaseLabel, normalizeCaseLabels } from "@/lib/case-labels";
import { isPadronGap, share } from "@/lib/padron-quality";

describe("etiquetas de los expedientes", () => {
  it("acepta solo las de la lista, sin repetir y en su orden", () => {
    expect(normalizeCaseLabels(["INTERNACION", "ADULTO_MAYOR", "INTERNACION", "OTRA", 3])).toEqual(["ADULTO_MAYOR", "INTERNACION"]);
    expect(normalizeCaseLabels("ADULTO_MAYOR")).toEqual([]);
    expect(normalizeCaseLabels(["VIVIENDA", "SALUD"])).toEqual([]);
    expect(isCaseLabel("DISCAPACIDAD")).toBe(true);
    expect(isCaseLabel("discapacidad")).toBe(false);
    expect(caseLabelName("NINEZ")).toBe("Niñez y adolescencia");
  });

  it("describe el cambio para la historia", () => {
    expect(describeLabelChange([], ["ADULTO_MAYOR"])).toBe("Agregó: Adulto mayor.");
    expect(describeLabelChange(["INTERNACION", "EMBARAZO"], ["EMBARAZO"])).toBe("Quitó: Internación.");
    expect(describeLabelChange(["INTERNACION"], ["INTERNACION"])).toBeNull();
  });
});

describe("calidad del padrón", () => {
  it("reconoce los filtros y redondea el porcentaje", () => {
    expect(isPadronGap("telefono")).toBe(true);
    expect(isPadronGap("toString")).toBe(false);
    expect(share(1, 3)).toBe(33.3);
    expect(share(5, 0)).toBe(0);
  });
});
