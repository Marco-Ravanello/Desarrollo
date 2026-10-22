import { describe, expect, it } from "vitest";
import { getAreaDashboardUrl, getAreaShortName, pickAreaByKeywords } from "@/lib/area-theme";

// Las seis áreas como las crea la carga inicial (prisma/seed.ts).
const AREAS = [
  { id: "dg", name: "Dirección General de Desarrollo Humano y Hábitat" },
  { id: "ps", name: "Dirección de Protección Social" },
  { id: "nf", name: "Dirección de Niñez, Adolescencia y Familia" },
  { id: "hv", name: "Dirección de Hábitat, Vivienda y Regularización Dominial" },
  { id: "vg", name: "Coordinación de Asistencia y Protección a Mujeres Víctimas de Violencia" },
  { id: "cf", name: "Coordinación Centro de Formación" },
];

describe("pickAreaByKeywords (páginas de Áreas)", () => {
  it("cada página se queda con su área y no con la Dirección General", () => {
    expect(pickAreaByKeywords(AREAS, ["Protección Social", "Proteccion Social", "Social"])?.id).toBe("ps");
    expect(pickAreaByKeywords(AREAS, ["Vivienda", "Regularización", "Hábitat", "Habitat"])?.id).toBe("hv");
    expect(pickAreaByKeywords(AREAS, ["Niñez", "Ninez", "Adolescencia", "Familia"])?.id).toBe("nf");
    expect(pickAreaByKeywords(AREAS, ["Violencia", "Mujeres", "Género", "Genero"])?.id).toBe("vg");
  });

  it("no depende del orden en que vienen las áreas", () => {
    const reversed = [...AREAS].reverse();
    expect(pickAreaByKeywords(reversed, ["Hábitat", "Habitat"])?.id).toBe("hv");
    expect(pickAreaByKeywords(reversed, ["Protección Social", "Social"])?.id).toBe("ps");
  });

  it("si solo la Dirección General coincide, la devuelve; si nada coincide, null", () => {
    expect(pickAreaByKeywords([AREAS[0]], ["Hábitat"])?.id).toBe("dg");
    expect(pickAreaByKeywords(AREAS, ["Deportes"])).toBeNull();
  });
});

describe("getAreaShortName", () => {
  it("da el nombre corto correcto de cada área", () => {
    expect(AREAS.map((a) => getAreaShortName(a.name))).toEqual([
      "Dirección General",
      "Protección Social",
      "Niñez y Familia",
      "Hábitat y Vivienda",
      "Violencia de Género",
      "Centro de Formación",
    ]);
  });

  it("un área nueva muestra su nombre sin 'Dirección de'", () => {
    expect(getAreaShortName("Dirección de Deportes")).toBe("Deportes");
    expect(getAreaShortName(undefined)).toBe("Sin área");
  });
});

describe("getAreaDashboardUrl", () => {
  it("lleva a la página de cada área", () => {
    expect(getAreaDashboardUrl(AREAS[1].name)).toBe("/areas/social");
    expect(getAreaDashboardUrl(AREAS[2].name)).toBe("/areas/ninez");
    expect(getAreaDashboardUrl(AREAS[3].name)).toBe("/areas/habitat");
    expect(getAreaDashboardUrl(AREAS[4].name)).toBe("/areas/violence");
  });

  it("las áreas sin página van a Expedientes filtrado", () => {
    expect(getAreaDashboardUrl(AREAS[0].name, "dg")).toBe("/cases?area=dg");
    expect(getAreaDashboardUrl(AREAS[5].name, "cf")).toBe("/cases?area=cf");
  });
});
