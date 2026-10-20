import { describe, expect, it } from "vitest";
import { canAssignCase, canTakeCase, isEligibleAssignee } from "@/lib/case-assignment";
import { edadDe, normalizarDireccion, parseFamiliaresDeclarados } from "@/lib/grupo-familiar";

describe("profesional a cargo: reglas", () => {
  it("asigna la conducción o quien dirige el área del expediente", () => {
    expect(canAssignCase({ role: "SUPERADMIN", areaId: null }, "a1")).toBe(true);
    expect(canAssignCase({ role: "DIRECCION_GENERAL", areaId: "x" }, "a1")).toBe(true);
    expect(canAssignCase({ role: "DIRECTOR_AREA", areaId: "a1" }, "a1")).toBe(true);
    expect(canAssignCase({ role: "DIRECTOR_AREA", areaId: "a2" }, "a1")).toBe(false);
    expect(canAssignCase({ role: "OPERATIVO", areaId: "a1" }, "a1")).toBe(false);
  });

  it("lo toma alguien del área que carga datos, nunca Auditoría ni el relevador", () => {
    expect(canTakeCase({ role: "OPERATIVO", areaId: "a1" }, "a1")).toBe(true);
    expect(canTakeCase({ role: "OPERATIVO", areaId: "a2" }, "a1")).toBe(false);
    expect(canTakeCase({ role: "AUDITOR", areaId: "a1" }, "a1")).toBe(false);
    expect(canTakeCase({ role: "RELEVADOR_EMERGENCIA", areaId: "a1" }, "a1")).toBe(false);
  });

  it("solo queda a cargo quien puede ver el expediente", () => {
    const social = { areaId: "a1", areaName: "Protección Social" };
    const vg = { areaId: "vg", areaName: "Violencia de Género" };
    expect(isEligibleAssignee({ role: "OPERATIVO", areaId: "a1", isActive: true }, social)).toBe(true);
    expect(isEligibleAssignee({ role: "OPERATIVO", areaId: "a1", isActive: false }, social)).toBe(false);
    expect(isEligibleAssignee({ role: "ADMIN_GENERAL", areaId: null, isActive: true }, social)).toBe(true);
    expect(isEligibleAssignee({ role: "OPERATIVO", areaId: "vg", isActive: true }, vg)).toBe(false);
    expect(isEligibleAssignee({ role: "VIOLENCIA_GENERO", areaId: "vg", isActive: true }, vg)).toBe(true);
  });
});

describe("grupo familiar: lectura de datos", () => {
  it("separa nombre, vínculo y DNI de cada familiar cargado", () => {
    expect(parseFamiliaresDeclarados("Ana Pérez (Hija); Juan Pérez", "20-30111222-3, 40222333")).toEqual([
      { nombre: "Ana Pérez", vinculo: "Hija", dni: "30111222" },
      { nombre: "Juan Pérez", vinculo: "Familiar", dni: "40222333" },
    ]);
    expect(parseFamiliaresDeclarados(null, "50111222")).toEqual([{ nombre: "", vinculo: "Familiar", dni: "50111222" }]);
    // El vínculo es el último paréntesis.
    expect(parseFamiliaresDeclarados("Gómez, Tomás (h) (Hijo)", null)[0]).toMatchObject({ nombre: "Gómez, Tomás (h)", vinculo: "Hijo" });
  });

  it("calcula la edad por fecha de nacimiento o usa la aproximada", () => {
    const now = new Date(2026, 9, 20);
    expect(edadDe("21/10/2000", null, now)).toBe(25);
    expect(edadDe("2000-10-20", null, now)).toBe(26);
    expect(edadDe(null, "70 años", now)).toBe(70);
    expect(edadDe("sin dato", null, now)).toBeNull();
  });

  it("compara direcciones sin importar mayúsculas ni espacios", () => {
    expect(normalizarDireccion("  Calle Inventada   100 ")).toBe(normalizarDireccion("calle inventada 100"));
  });
});
