import { describe, expect, it } from "vitest";
import { expiryNotice, expiryStage } from "@/lib/vencimientos";
import { formatPesosCorto } from "@/lib/formato";

describe("cuándo se avisa un vencimiento", () => {
  it("un mes antes, una semana antes y cuando ya venció", () => {
    expect(expiryStage("2026-12-01", "2026-10-23")).toBeNull();
    expect(expiryStage("2026-11-22", "2026-10-23")).toBe("mes");
    expect(expiryStage("2026-10-30", "2026-10-23")).toBe("semana");
    expect(expiryStage("2026-10-23", "2026-10-23")).toBe("semana");
    expect(expiryStage("2026-10-22", "2026-10-23")).toBe("vencido");
  });

  it("el texto dice qué vence, cuándo y cuánto falta", () => {
    expect(expiryNotice("vtv", "AB123CD", "2026-10-28", "2026-10-23")).toEqual({
      title: "La VTV de AB123CD vence esta semana",
      message: "Vence el 28/10/2026 (en 5 días).",
    });
    expect(expiryNotice("seguro", "AB123CD", "2026-10-24", "2026-10-23")?.message).toBe("Vence el 24/10/2026 (mañana).");
    expect(expiryNotice("convenio", "C-12 (Comedor)", "2026-11-15", "2026-10-23")?.title).toBe("El convenio de C-12 (Comedor) termina este mes");
    expect(expiryNotice("vtv", "AB123CD", "2026-10-01", "2026-10-23")?.title).toBe("Venció la VTV de AB123CD");
    expect(expiryNotice("convenio", "Comedor", "2026-10-01", "2026-10-23")?.title).toBe("Terminó el convenio de Comedor");
    expect(expiryNotice("vtv", "AB123CD", "2027-10-01", "2026-10-23")).toBeNull();
  });
});

describe("importes cortos para tarjetas angostas", () => {
  it("usa mil y M como se dice acá", () => {
    expect(formatPesosCorto(0)).toBe("$ 0");
    expect(formatPesosCorto(950)).toBe("$ 950");
    expect(formatPesosCorto(200000)).toBe("$ 200 mil");
    expect(formatPesosCorto(1234567)).toBe("$ 1,2 M");
    expect(formatPesosCorto(15000000)).toBe("$ 15 M");
    expect(formatPesosCorto(2500000000)).toBe("$ 2.500 M");
  });
});
