import { describe, expect, it } from "vitest";
import { emptyMapData, unpackMapData } from "@/lib/map-points";

const stats = { total: 3, located: 2, approximate: 1, topBarrio: "Centro", topProgram: "Prueba" };

describe("puntos del Mapa Social como viajan al navegador", () => {
  it("arma los DNI y las coordenadas", () => {
    const data = unpackMapData({ dnis: "1001,1002", coords: "-3460123,-5856000,-3459000,-5857001", exactCount: 1, stats });
    expect(data).toEqual({ dnis: ["1001", "1002"], coords: [-34.60123, -58.56, -34.59, -58.57001], exactCount: 1, stats });
    expect(data.programMask).toBeUndefined();
  });

  it("arma la máscara de programas solo cuando viene", () => {
    expect(unpackMapData({ dnis: "1,2,3", coords: "1,1,2,2,3,3", programMask: "1,0,3", exactCount: 3, stats }).programMask).toEqual([1, 0, 3]);
    expect(unpackMapData({ dnis: "", coords: "", programMask: "", exactCount: 0, stats })).toEqual({ dnis: [], coords: [], programMask: [], exactCount: 0, stats });
  });

  it("sin puntos todavía, conserva las cifras", () => {
    expect(emptyMapData(stats)).toEqual({ dnis: [], coords: [], exactCount: 0, stats });
  });
});
