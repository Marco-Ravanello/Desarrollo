import { describe, expect, it } from "vitest";
import { formatNumber, formatPercent, formatPesos, formatPesosExactos, plural, textoNormal } from "@/lib/formato";

describe("formato de números", () => {
  it("usa punto de miles y coma decimal", () => {
    expect(formatNumber(1200)).toBe("1.200");
    expect(formatNumber(82435)).toBe("82.435");
    expect(formatPercent(0)).toBe("0,0 %");
    expect(formatPercent(12.345)).toBe("12,3 %");
    expect(formatPesos(1500)).toBe("$ 1.500");
  });
});

describe("plural", () => {
  it("usa singular solo con 1", () => {
    expect(plural(1, "registro")).toBe("1 registro");
    expect(plural(0, "registro")).toBe("0 registros");
    expect(plural(3, "programa activo")).toBe("3 programas activos");
    expect(plural(1, "programa activo")).toBe("1 programa activo");
    expect(plural(2, "intervención")).toBe("2 intervenciones");
    expect(plural(1200, "persona")).toBe("1.200 personas");
    expect(plural(2, "expediente cerrado hoy", "expedientes cerrados hoy")).toBe("2 expedientes cerrados hoy");
  });
});

describe("textoNormal", () => {
  it("pasa valores en mayúsculas a texto normal", () => {
    expect(textoNormal("MEDIA")).toBe("Media");
    expect(textoNormal("EN_PROCESO")).toBe("En proceso");
    expect(textoNormal(null)).toBe("");
  });
});

describe("formatPesosExactos", () => {
  it("muestra centavos solo cuando hay", () => {
    expect(formatPesosExactos(1500)).toBe("$ 1.500");
    expect(formatPesosExactos(12.5)).toBe("$ 12,50");
    expect(formatPesosExactos(1234.567)).toBe("$ 1.234,57");
    expect(formatPesosExactos(null)).toBe("$ 0");
  });
});
