import { describe, expect, it } from "vitest";
import { NOVEDADES, ULTIMA_NOVEDAD, claveNovedad, fechaNovedad } from "@/lib/novedades";

describe("novedades", () => {
  it("van de la más nueva a la más vieja, sin repetirse", () => {
    const claves = NOVEDADES.map(claveNovedad);
    expect(new Set(claves).size).toBe(claves.length);
    const orden = NOVEDADES.map((n) => `${n.fecha}-${String(n.parte ?? 1).padStart(2, "0")}`);
    expect([...orden].sort().reverse()).toEqual(orden);
    expect(ULTIMA_NOVEDAD).toBe(NOVEDADES[0]);
  });

  it("cada entrada tiene fecha válida, título y al menos un cambio", () => {
    for (const n of NOVEDADES) {
      expect(n.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(n.titulo.trim()).not.toBe("");
      expect(n.cambios.length).toBeGreaterThan(0);
    }
  });

  it("escribe la fecha en castellano sin correrse de día", () => {
    expect(fechaNovedad("2026-11-02")).toBe("2 de noviembre de 2026");
  });
});
