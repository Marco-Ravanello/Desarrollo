import { describe, expect, it } from "vitest";
import {
  BARRIOS_3F, barrioFromSlug, barrioKey, barrioOfRow, barrioSlug, canDeleteLugar, canEditLugares, matchBarrio, parseLugarInput,
} from "@/lib/barrios";

describe("barrios de Tres de Febrero", () => {
  it("son los 29 de la lista, sin repetidos y cada uno con su dirección propia", () => {
    expect(BARRIOS_3F).toHaveLength(29);
    expect(new Set(BARRIOS_3F).size).toBe(29);
    const slugs = BARRIOS_3F.map(barrioSlug);
    expect(new Set(slugs).size).toBe(29);
    expect(barrioSlug("Sáenz Peña")).toBe("saenz-pena");
    expect(barrioSlug("Puerta 8")).toBe("puerta-8");
    for (const b of BARRIOS_3F) expect(barrioFromSlug(barrioSlug(b))).toBe(b);
    expect(barrioFromSlug("el-palomar")).toBeNull();
    expect(barrioFromSlug(undefined)).toBeNull();
  });

  it("reconoce cómo se escribe a mano y los otros nombres de uso común", () => {
    expect(barrioKey("  Barrio  Villa   BOSCH ")).toBe("villa bosch");
    expect(matchBarrio("saenz pena")).toBe("Sáenz Peña");
    expect(matchBarrio("Los russos")).toBe("Los Rusos");
    expect(matchBarrio("los rusos")).toBe("Los Rusos");
    expect(matchBarrio("Fuerte Apache")).toBe("Ejército de los Andes");
    expect(matchBarrio("11 de Septiembre")).toBe("Once de Septiembre");
    expect(matchBarrio("El Libertador")).toBe("Libertador");
    expect(matchBarrio("Puerta Ocho")).toBe("Puerta 8");
    expect(matchBarrio("Escalada")).toBe("Escalada");
    expect(matchBarrio("Remedios de Escalada")).toBe("Remedios de Escalada");
    expect(matchBarrio("El Palomar")).toBeNull();
    expect(matchBarrio("Evita / Mercado")).toBeNull();
    expect(matchBarrio(null)).toBeNull();
  });

  it("el barrio de una persona del padrón es su barrio y, si no es de la lista, su localidad", () => {
    expect(barrioOfRow("Barrio Evita", "Caseros")).toBe("Evita");
    expect(barrioOfRow("El Palomar", "Caseros")).toBe("Caseros");
    expect(barrioOfRow("", "Santos Lugares")).toBe("Santos Lugares");
    expect(barrioOfRow(null, "Tres de Febrero")).toBeNull();
  });
});

describe("lugares de referencia", () => {
  it("revisa el formulario y limpia los espacios", () => {
    expect(parseLugarInput({ nombre: "Escuela 12" })).toEqual({ ok: false, error: "Elegí qué tipo de lugar es." });
    expect(parseLugarInput({ tipo: "ESCUELA", nombre: "   " })).toEqual({ ok: false, error: "Escribí el nombre del lugar." });
    expect(parseLugarInput({ tipo: "CASINO", nombre: "X" }).ok).toBe(false);
    expect(
      parseLugarInput({ tipo: "SALITA", nombre: "  CAPS   San Martín ", telefono: " 4750-0000 ", direccion: "", notas: " Atiende a la mañana \n" })
    ).toEqual({
      ok: true,
      data: { tipo: "SALITA", nombre: "CAPS San Martín", direccion: null, telefono: "4750-0000", contacto: null, horario: null, notas: "Atiende a la mañana" },
    });
  });

  it("cargan quienes cargan datos sociales; borran quien lo cargó o la conducción", () => {
    expect(canEditLugares("OPERATIVO")).toBe(true);
    expect(canEditLugares("AUDITOR")).toBe(false);
    expect(canEditLugares("RELEVADOR_EMERGENCIA")).toBe(false);
    expect(canDeleteLugar({ id: "u1", role: "OPERATIVO" }, "u1")).toBe(true);
    expect(canDeleteLugar({ id: "u1", role: "OPERATIVO" }, "u2")).toBe(false);
    expect(canDeleteLugar({ id: "u1", role: "DIRECTOR_AREA" }, null)).toBe(false);
    expect(canDeleteLugar({ id: "u9", role: "DIRECCION_GENERAL" }, "u2")).toBe(true);
    expect(canDeleteLugar({ id: "u1", role: "AUDITOR" }, "u1")).toBe(false);
  });
});
