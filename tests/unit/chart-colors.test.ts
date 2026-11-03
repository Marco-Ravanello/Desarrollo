import { describe, expect, it } from "vitest";
import { CHART_COLORS, CHART_COLORS_DARK, chartPalette } from "@/lib/chart-colors";
import { INITIALS_COLORS, initialsColor } from "@/lib/initials";

describe("colores de los gráficos", () => {
  it("empiezan con el azul y el naranja de la Municipalidad", () => {
    expect(chartPalette(false).slice(0, 2)).toEqual(["#163C68", "#F69321"]);
  });

  it("en modo oscuro cambian el azul oscuro por uno claro y tienen la misma cantidad", () => {
    expect(chartPalette(true)).toBe(CHART_COLORS_DARK);
    expect(CHART_COLORS_DARK).toHaveLength(CHART_COLORS.length);
    expect(CHART_COLORS_DARK[0]).not.toBe(CHART_COLORS[0]);
  });

  it("no repiten colores", () => {
    expect(new Set(CHART_COLORS).size).toBe(CHART_COLORS.length);
    expect(new Set(CHART_COLORS_DARK).size).toBe(CHART_COLORS_DARK.length);
  });
});

describe("colores de las iniciales", () => {
  it("son 6 tonos suaves y la misma persona siempre tiene el mismo", () => {
    expect(INITIALS_COLORS).toHaveLength(6);
    expect(initialsColor("30275822")).toBe(initialsColor("30275822"));
    expect(INITIALS_COLORS).toContain(initialsColor("30275822"));
  });
});
