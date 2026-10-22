import { describe, expect, it } from "vitest";
import { personAddress } from "@/lib/person-display";

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
