import { describe, expect, it } from "vitest";
import { nombrePropio } from "@/lib/nombres";

describe("nombres con mayúscula inicial", () => {
  it("pasa a mayúscula inicial lo que viene todo en mayúsculas", () => {
    expect(nombrePropio("GÓMEZ, MARÍA")).toBe("Gómez, María");
    expect(nombrePropio("PEREZ DE LA FUENTE, JUAN JOSE")).toBe("Perez de la Fuente, Juan Jose");
    expect(nombrePropio("DEL VALLE, ANA")).toBe("Del Valle, Ana");
    expect(nombrePropio("O'NEILL, SEAN")).toBe("O'Neill, Sean");
    expect(nombrePropio("GARCÍA-LÓPEZ, IÑAKI")).toBe("García-López, Iñaki");
    expect(nombrePropio("NUÑEZ Y ROSAS, ÁNGEL")).toBe("Nuñez y Rosas, Ángel");
  });

  it("respeta lo que ya tiene minúsculas y lo vacío", () => {
    expect(nombrePropio("McAllister, Mary")).toBe("McAllister, Mary");
    expect(nombrePropio("Sin nombre")).toBe("Sin nombre");
    expect(nombrePropio("")).toBe("");
    expect(nombrePropio(null)).toBe(null);
    expect(nombrePropio(undefined)).toBe(undefined);
    expect(nombrePropio("12345678")).toBe("12345678");
  });
});
