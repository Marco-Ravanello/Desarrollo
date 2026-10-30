import { describe, expect, it } from "vitest";
import { FICHA_LIMITS, camposCambiados, parseFichaNnya } from "@/lib/convenio-nnya";

describe("ficha del niño, niña o adolescente en el convenio", () => {
  it("limpia los textos y deja vacío lo que no se cargó", () => {
    const { data } = parseFichaNnya({ interviene: "  Juzgado   de Familia 2 ", motivo: "", obraSocial: undefined, observaciones: null });
    expect(data).toEqual({ interviene: "Juzgado de Familia 2", motivo: null, obraSocial: null, observaciones: null });
  });

  it("corta los textos largos y mantiene los saltos de línea de las observaciones", () => {
    const { data } = parseFichaNnya({ obraSocial: "x".repeat(500), observaciones: "Línea 1\nLínea 2" });
    expect(data.obraSocial).toHaveLength(FICHA_LIMITS.obraSocial);
    expect(data.observaciones).toBe("Línea 1\nLínea 2");
  });

  it("dice qué datos cambiaron, sin los valores", () => {
    const antes = { interviene: "Juzgado", motivo: null, obraSocial: "IOMA", observaciones: null };
    expect(camposCambiados(antes, { ...antes })).toEqual([]);
    expect(camposCambiados(antes, { ...antes, motivo: "Abrigo", obraSocial: null })).toEqual(["Motivo del ingreso", "Obra social"]);
  });
});
