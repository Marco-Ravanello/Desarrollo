import { describe, expect, it } from "vitest";
import { barrioDelPunto, canEditLimites, parseLimite, puntoDentro, type Limite } from "@/lib/barrio-limites";
import { CONTORNOS_OSM } from "@/lib/barrios-contornos-osm";
import { BARRIOS_3F } from "@/lib/barrios";

const cuadrado: Limite = [[-34.60, -58.56], [-34.60, -58.55], [-34.61, -58.55], [-34.61, -58.56]];
const chico: Limite = [[-34.602, -58.558], [-34.602, -58.556], [-34.604, -58.556], [-34.604, -58.558]];

describe("límites de los barrios", () => {
  it("sabe si un punto está adentro", () => {
    expect(puntoDentro(-34.605, -58.555, cuadrado)).toBe(true);
    expect(puntoDentro(-34.615, -58.555, cuadrado)).toBe(false);
    expect(puntoDentro(-34.605, -58.545, cuadrado)).toBe(false);
  });

  it("elige el barrio más chico que contiene al punto", () => {
    const limites: ["Ciudadela" | "Ejército de los Andes", Limite][] = [["Ciudadela", cuadrado], ["Ejército de los Andes", chico]];
    expect(barrioDelPunto(-34.603, -58.557, limites)).toBe("Ejército de los Andes");
    expect(barrioDelPunto(-34.608, -58.552, limites)).toBe("Ciudadela");
    expect(barrioDelPunto(-34.7, -58.552, limites)).toBeNull();
  });

  it("revisa un límite dibujado", () => {
    expect(parseLimite([...cuadrado, cuadrado[0]])).toEqual({ ok: true, puntos: cuadrado });
    expect(parseLimite(cuadrado.slice(0, 2))).toEqual({ ok: false, error: "Marcá al menos 3 puntos en el mapa." });
    expect(parseLimite([[-34.6, -58.56], [-34.6, -58.55], [-34.6, -58.54]])).toEqual({ ok: false, error: "Los puntos están en línea: marcá un área." });
    expect(parseLimite([[-34.6, -58.56], [-34.6, -58.55], [-31.4, -64.18]])).toEqual({ ok: false, error: "El límite tiene puntos fuera de Tres de Febrero." });
    expect(parseLimite([[-34.6, "x"], [1], [2]]).ok).toBe(false);
    expect(parseLimite("nada").ok).toBe(false);
  });

  it("solo la conducción dibuja límites", () => {
    expect(canEditLimites("SUPERADMIN")).toBe(true);
    expect(canEditLimites("DIRECCION_GENERAL")).toBe(true);
    expect(canEditLimites("DIRECTOR_AREA")).toBe(false);
    expect(canEditLimites("OPERATIVO")).toBe(false);
  });

  it("los contornos de OpenStreetMap son de barrios de la lista y caen en el partido", () => {
    const nombres = Object.keys(CONTORNOS_OSM);
    expect(nombres.length).toBe(24);
    for (const n of nombres) {
      expect(BARRIOS_3F).toContain(n);
      const r = parseLimite(CONTORNOS_OSM[n as keyof typeof CONTORNOS_OSM]);
      expect(r.ok, n).toBe(true);
    }
    // La estación Caseros cae en Caseros; Fuerte Apache, en Ejército de los Andes (y no solo en Ciudadela).
    const limites = Object.entries(CONTORNOS_OSM) as [string, Limite][];
    expect(barrioDelPunto(-34.6066, -58.5634, limites)).toBe("Caseros");
    expect(barrioDelPunto(-34.6206, -58.5383, limites)).toBe("Ejército de los Andes");
  });
});
