import { describe, expect, it } from "vitest";
import { STORM_BARRIOS, matchStormBarrio } from "@/lib/storm-barrios";

describe("barrios de la ficha de tormenta", () => {
  it("tiene los 29 barrios de la lista, sin repetidos", () => {
    expect(STORM_BARRIOS).toHaveLength(29);
    expect(new Set(STORM_BARRIOS).size).toBe(29);
  });

  it("reconoce un barrio escrito a mano sin importar tildes, mayúsculas ni 'Barrio'", () => {
    expect(matchStormBarrio("saenz peña")).toBe("Sáenz Peña");
    expect(matchStormBarrio("  CAPITAN BERMUDEZ ")).toBe("Capitán Bermúdez");
    expect(matchStormBarrio("Barrio Derqui")).toBe("Derqui");
    expect(matchStormBarrio("Fuerte Apache")).toBe("Ejército de los Andes");
  });

  it("lo que no está en la lista no se adivina", () => {
    expect(matchStormBarrio("Barrio Derqui / Caseros")).toBeNull();
    // "Evita / Mercado" salió de la lista el 27/10/2026: ahora son dos barrios.
    expect(matchStormBarrio("evita/mercado")).toBeNull();
    expect(matchStormBarrio("")).toBeNull();
    expect(matchStormBarrio(null)).toBeNull();
  });
});
