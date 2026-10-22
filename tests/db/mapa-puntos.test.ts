import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { getMapData, getMapStats } from "@/services/map";
import { unpackMapData } from "@/lib/map-points";

// Datos inventados, solo en la base de prueba local.
describe("puntos del Mapa Social", () => {
  it("llegan exactos primero, con sus coordenadas, cifras y programas", async () => {
    await prisma.padronUnificado.createMany({
      data: [
        { dni: "97200002", nombre_completo: "Mapapunto, Beto", direccion: "Calle Real 1234", latitude: -34.600004, longitude: -58.5655, geo_estado: "UBICADA", geo_fuente: "GEOREF", programas_activos: "Programa Prueba" },
        { dni: "97200001", nombre_completo: "Mapapunto, Ana", direccion: "Barrio Libertador", latitude: -34.61, longitude: -58.57 },
        { dni: "97200003", nombre_completo: "Mapapunto, Caro", direccion: "Calle Real 99" },
      ],
    });
    const filtros = { query: "Mapapunto" };
    const data = unpackMapData(await getMapData(filtros));
    expect(data.dnis).toEqual(["97200002", "97200001"]);
    expect(data.coords).toEqual([-34.6, -58.5655, -34.61, -58.57]);
    expect(data.exactCount).toBe(1);
    expect(data.programMask).toBeUndefined();
    expect(data.stats).toEqual({ total: 3, located: 2, approximate: 1, topBarrio: "Sin datos", topProgram: "Programa Prueba" });
    expect(await getMapStats(filtros)).toEqual(data.stats);

    const comparando = unpackMapData(await getMapData({ ...filtros, programs: ["Programa Prueba"] }));
    expect(comparando.dnis).toEqual(["97200002"]);
    expect(comparando.programMask).toEqual([1]);

    const nada = unpackMapData(await getMapData({ query: "Nadie con este nombre" }));
    expect(nada).toMatchObject({ dnis: [], coords: [], exactCount: 0, stats: { total: 0, located: 0, approximate: 0 } });
  });
});
