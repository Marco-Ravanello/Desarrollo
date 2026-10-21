import { describe, expect, it } from "vitest";
import { isProvisionalDni, splitCaseTitle } from "@/lib/case-summary";

describe("splitCaseTitle", () => {
  it("separa la marca de tormenta como etiqueta", () => {
    expect(splitCaseTitle("[CONTINGENCIA TORMENTA] Asistencia a Juan Pérez - Caseros")).toEqual({
      tag: "Tormenta",
      title: "Asistencia a Juan Pérez - Caseros",
    });
  });

  it("deja igual los títulos sin marca", () => {
    expect(splitCaseTitle("Caso protección urgente")).toEqual({ tag: null, title: "Caso protección urgente" });
  });

  it("si solo está la marca, muestra el título completo", () => {
    expect(splitCaseTitle("[CONTINGENCIA TORMENTA]")).toEqual({ tag: "Tormenta", title: "[CONTINGENCIA TORMENTA]" });
  });
});

describe("isProvisionalDni", () => {
  it("reconoce los DNI provisorios", () => {
    expect(isProvisionalDni("TEMP-1792428226045-m3j9dd")).toBe(true);
    expect(isProvisionalDni("30123456")).toBe(false);
    expect(isProvisionalDni(null)).toBe(false);
  });
});
