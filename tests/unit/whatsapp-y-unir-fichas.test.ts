import { describe, expect, it } from "vitest";
import { nationalNumber, whatsappHref, whatsappNumber, whatsappNumbers } from "@/lib/whatsapp";
import { mergedInto, movedSummary, namesLookDifferent, recommendedKeep, type MergeSide } from "@/lib/person-merge";

describe("WhatsApp con los teléfonos como están cargados", () => {
  it("pasa los formatos de siempre a +54 9", () => {
    expect(nationalNumber("11 5004-1004")).toBe("1150041004");
    expect(nationalNumber("011 15 5004-1004")).toBe("1150041004");
    expect(nationalNumber("15 6123-4567")).toBe("1161234567");
    expect(nationalNumber("4750-1234")).toBe("1147501234");
    expect(nationalNumber("+54 9 11 5004-1004")).toBe("1150041004");
    expect(nationalNumber("54 11 5004 1004")).toBe("1150041004");
    expect(nationalNumber("0221 15 456-7890")).toBe("2214567890");
    expect(nationalNumber("(0351) 456-7890")).toBe("3514567890");
  });

  it("no arma nada con números cortos, raros o sin cifras", () => {
    expect(nationalNumber("123")).toBeNull();
    expect(nationalNumber("no tiene")).toBeNull();
    expect(nationalNumber("1234567890123456")).toBeNull();
    expect(whatsappNumber("")).toBeNull();
  });

  it("muestra el número como lo va a usar y arma el enlace", () => {
    const n = whatsappNumber("011 15 5004-1004")!;
    expect(n.display).toBe("+54 9 11 5004-1004");
    expect(whatsappHref(n)).toBe("https://wa.me/5491150041004");
    expect(whatsappNumber("0221 15 456-7890")!.display).toBe("+54 9 221 456-7890");
  });

  it("separa varios teléfonos en el mismo campo, sin repetir", () => {
    expect(whatsappNumbers("4750-1234 / 15 6123-4567").map((n) => n.wa)).toEqual(["5491147501234", "5491161234567"]);
    expect(whatsappNumbers("11 5004-1004 o 1150041004")).toHaveLength(1);
    expect(whatsappNumbers(null)).toEqual([]);
  });
});

const side = (dni: string, extra: Partial<MergeSide> = {}): MergeSide => ({
  dni,
  nombre: "Pérez, Ana",
  enPadron: true,
  enRegistro: true,
  direccion: null,
  telefono: null,
  nacimiento: null,
  programas: [],
  expedientes: 0,
  intervenciones: 0,
  documentos: 0,
  cursos: 0,
  visitas: 0,
  fichasTormenta: 0,
  convenios: 0,
  ...extra,
});

describe("unir dos fichas", () => {
  it("recomienda dejar el DNI real, después el del padrón y después el que tiene más cosas", () => {
    expect(recommendedKeep(side("TEMP-123", { expedientes: 5 }), side("30111222"))).toBe("30111222");
    expect(recommendedKeep(side("30111222", { enPadron: false }), side("30111223"))).toBe("30111223");
    expect(recommendedKeep(side("30111222"), side("30111223", { expedientes: 1 }))).toBe("30111223");
    expect(recommendedKeep(side("30111222"), side("30111223"))).toBe("30111222");
  });

  it("avisa cuando los nombres no tienen nada en común", () => {
    expect(namesLookDifferent("PÉREZ, Ana María", "Ana Perez")).toBe(false);
    expect(namesLookDifferent("Pérez, Ana", "Gómez, Juan")).toBe(true);
    expect(namesLookDifferent(null, "Gómez, Juan")).toBe(false);
  });

  it("cuenta lo que pasa a la ficha que queda", () => {
    expect(movedSummary(side("1"))).toBe("nada más que sus datos");
    expect(movedSummary(side("1", { expedientes: 2, intervenciones: 1, cursos: 1 }))).toBe("2 expedientes, 1 intervención y 1 curso");
  });

  it("encuentra a qué DNI fue a parar una ficha unida", () => {
    expect(mergedInto("Se unió el DNI 94000007 en el DNI 94000001. Pasó: nada.", "94000007")).toBe("94000001");
    expect(mergedInto("Se unió el DNI TEMP-9 en el DNI 30111222. Registro…", "TEMP-9")).toBe("30111222");
    expect(mergedInto("Otra cosa", "94000007")).toBeNull();
  });
});
