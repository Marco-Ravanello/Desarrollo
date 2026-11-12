import { describe, expect, it } from "vitest";
import { addressPreviewKey, parsePickedPoint, startingPointFor } from "@/lib/address-preview";
import { TRES_DE_FEBRERO_CENTER } from "@/lib/constants/localities";

describe("punto marcado en el mapa al cargar o editar (idea 157)", () => {
  it("acepta solo números dentro del partido", () => {
    expect(parsePickedPoint("-34.6011234", "-58.5622987")).toEqual({ lat: -34.601123, lon: -58.562299 });
    expect(parsePickedPoint(-34.6, -58.56)).toEqual({ lat: -34.6, lon: -58.56 });
    // Capital Federal, afuera del partido.
    expect(parsePickedPoint("-34.6037", "-58.3816")).toBeNull();
    expect(parsePickedPoint("", "")).toBeNull();
    expect(parsePickedPoint(null, null)).toBeNull();
    expect(parsePickedPoint("abc", "-58.56")).toBeNull();
  });

  it("no busca dos veces la misma dirección escrita distinto", () => {
    expect(addressPreviewKey(" Av. San Martín  2450", "Caseros", "")).toBe(addressPreviewKey("av. san martín 2450", "CASEROS ", " "));
    expect(addressPreviewKey("Av. San Martín 2450", "Caseros", "")).not.toBe(addressPreviewKey("Av. San Martín 2452", "Caseros", ""));
  });

  it("si no la encuentra, centra el mapa en la localidad escrita", () => {
    expect(startingPointFor("Ciudadela", "")).not.toEqual(TRES_DE_FEBRERO_CENTER);
    expect(startingPointFor("", "")).toEqual(TRES_DE_FEBRERO_CENTER);
    expect(startingPointFor("Otra ciudad", null)).toEqual(TRES_DE_FEBRERO_CENTER);
  });
});
