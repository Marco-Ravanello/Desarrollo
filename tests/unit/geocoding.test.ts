import { describe, expect, it } from "vitest";
import { buildOsmQuery, cleanAddressForSearch, insideTresDeFebreroBounds } from "@/lib/geocoding";

describe("limpiar la dirección antes de buscarla", () => {
  it("saca N°, piso, departamento y aclaraciones", () => {
    expect(cleanAddressForSearch("Av. San Martín N° 2450")).toBe("Av. San Martín 2450");
    expect(cleanAddressForSearch("Lisandro Medina 1650 Piso 3 Depto B")).toBe("Lisandro Medina 1650");
    expect(cleanAddressForSearch("Bonifacini 3200, dto. 4")).toBe("Bonifacini 3200");
    expect(cleanAddressForSearch("Urquiza 4500 (portón verde)")).toBe("Urquiza 4500");
    expect(cleanAddressForSearch("Mitre 120 e/ Bolívar y Sarmiento")).toBe("Mitre 120");
    expect(cleanAddressForSearch("Nro. 300 Belgrano")).toBe("300 Belgrano");
  });

  it("no rompe calles que empiezan como esas palabras", () => {
    expect(cleanAddressForSearch("Nogoyá 2100")).toBe("Nogoyá 2100");
    expect(cleanAddressForSearch("Casares 850")).toBe("Casares 850");
    expect(cleanAddressForSearch("Pinto 1200, Pisoni")).toBe("Pinto 1200, Pisoni");
  });

  it("sin calle y altura no hay nada para buscar", () => {
    expect(cleanAddressForSearch(null)).toBeNull();
    expect(cleanAddressForSearch("")).toBeNull();
    expect(cleanAddressForSearch("Barrio Ejército de los Andes")).toBeNull();
    expect(cleanAddressForSearch("1234")).toBeNull();
    expect(cleanAddressForSearch("S/N")).toBeNull();
  });
});

describe("texto para OpenStreetMap", () => {
  it("suma la localidad (o el barrio) y el partido", () => {
    expect(buildOsmQuery("Mitre 120", "Caseros", "Centro")).toBe("Mitre 120, Caseros, Tres de Febrero, Buenos Aires, Argentina");
    expect(buildOsmQuery("Mitre 120", "Tres de Febrero", "Villa Bosch")).toBe("Mitre 120, Villa Bosch, Tres de Febrero, Buenos Aires, Argentina");
    expect(buildOsmQuery("Mitre 120", null, null)).toBe("Mitre 120, Tres de Febrero, Buenos Aires, Argentina");
  });
});

describe("¿cae dentro del partido?", () => {
  it("acepta puntos de Tres de Febrero y rechaza los de afuera", () => {
    expect(insideTresDeFebreroBounds(-34.603, -58.558)).toBe(true); // centro del partido
    expect(insideTresDeFebreroBounds(-34.6037, -58.3816)).toBe(false); // Obelisco
    expect(insideTresDeFebreroBounds(-34.92, -57.95)).toBe(false); // La Plata
    expect(insideTresDeFebreroBounds(NaN, -58.55)).toBe(false);
  });
});
