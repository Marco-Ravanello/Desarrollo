import { describe, expect, it } from "vitest";
import { STORM_BARRIOS, matchStormBarrio } from "@/lib/storm-barrios";

describe("barrios de la ficha de tormenta", () => {
  it("tiene los 30 barrios de la lista, sin repetidos", () => {
    expect(STORM_BARRIOS).toHaveLength(30);
    expect(new Set(STORM_BARRIOS).size).toBe(30);
  });

  it("reconoce un barrio escrito a mano sin importar tildes, mayúsculas ni 'Barrio'", () => {
    expect(matchStormBarrio("saenz peña")).toBe("Sáenz Peña");
    expect(matchStormBarrio("  CAPITAN BERMUDEZ ")).toBe("Capitán Bermúdez");
    expect(matchStormBarrio("Barrio Derqui")).toBe("Derqui");
    expect(matchStormBarrio("evita/mercado")).toBe("Evita / Mercado");
  });

  it("lo que no está en la lista no se adivina", () => {
    expect(matchStormBarrio("Barrio Derqui / Caseros")).toBeNull();
    expect(matchStormBarrio("")).toBeNull();
    expect(matchStormBarrio(null)).toBeNull();
  });
});
