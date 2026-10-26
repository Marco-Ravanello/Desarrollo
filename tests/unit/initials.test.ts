import { describe, expect, it } from "vitest";
import { INITIALS_COLORS, initialsColor, initialsOf } from "@/lib/initials";

describe("iniciales", () => {
  it("con nombre y apellido separados", () => {
    expect(initialsOf("Juan", "Pérez")).toBe("JP");
    expect(initialsOf("ángela", "de la Fuente")).toBe("ÁF");
    expect(initialsOf("", "")).toBe("?");
  });

  it("con el nombre entero, primero el nombre aunque venga con coma", () => {
    expect(initialsOf("Juan Pérez")).toBe("JP");
    expect(initialsOf("Pérez, Juan Carlos")).toBe("JP");
    expect(initialsOf("María de los Ángeles")).toBe("MÁ");
    expect(initialsOf("admin")).toBe("A");
    expect(initialsOf(null)).toBe("?");
  });
});

describe("color de las iniciales", () => {
  it("siempre el mismo para el mismo dato, de la paleta", () => {
    expect(initialsColor("30111222")).toBe(initialsColor("30111222"));
    expect(INITIALS_COLORS).toContain(initialsColor("30111222"));
    expect(initialsColor(" ABC ")).toBe(initialsColor("abc"));
  });

  it("reparte los colores entre muchas personas", () => {
    const used = new Set(Array.from({ length: 200 }, (_, i) => initialsColor(String(20000000 + i * 7919))));
    expect(used.size).toBe(INITIALS_COLORS.length);
  });
});
