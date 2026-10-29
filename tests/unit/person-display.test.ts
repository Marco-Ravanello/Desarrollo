import { describe, expect, it } from "vitest";
import { personAddress, programChips } from "@/lib/person-display";

describe("personAddress", () => {
  it("no repite el barrio cuando ya está en la dirección", () => {
    expect(personAddress("Barrio Ejército de los Andes", "Ejército de los Andes")).toBe("Barrio Ejército de los Andes");
  });
  it("suma el barrio cuando la dirección no lo tiene", () => {
    expect(personAddress("Calle 123", "Villa Bosch")).toBe("Calle 123 - Barrio Villa Bosch");
  });
  it("sin dirección usa el barrio o la localidad", () => {
    expect(personAddress(null, "Loma Hermosa")).toBe("Barrio Loma Hermosa");
    expect(personAddress("", "", "Caseros")).toBe("Caseros");
    expect(personAddress(null, null, null)).toBe("Sin dirección");
  });
});

describe("programChips", () => {
  it("sin programas no muestra nada", () => {
    expect(programChips([])).toEqual({ shown: [], rest: 0 });
    expect(programChips(null)).toEqual({ shown: [], rest: 0 });
  });

  it("suma programas cortos mientras entran y deja el resto como +N", () => {
    expect(programChips(["AUH", "Tarjeta Alimentar", "Envión", "Potenciar"])).toEqual({ shown: ["AUH", "Tarjeta Alimentar", "Envión"], rest: 1 });
  });

  it("siempre muestra el primero aunque sea largo", () => {
    expect(programChips(["Programa de acompañamiento a adultos mayores", "AUH"])).toEqual({
      shown: ["Programa de acompañamiento a adultos mayores"],
      rest: 1,
    });
  });
});
