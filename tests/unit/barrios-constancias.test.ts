import { describe, expect, it } from "vitest";
import { stormBarrioLabel } from "@/lib/storm-barrios";
import { receiptNumber } from "@/services/storm-receipts";
import { canViewStormDeliveries } from "@/lib/permissions";

describe("barrio para agrupar y filtrar fichas", () => {
  it("une las formas de escribir un barrio de la lista y conserva lo viejo", () => {
    expect(stormBarrioLabel("saenz peña")).toBe("Sáenz Peña");
    expect(stormBarrioLabel("Barrio Inventado Viejo")).toBe("Barrio Inventado Viejo");
    expect(stormBarrioLabel("  ")).toBe("Sin barrio");
    expect(stormBarrioLabel(null)).toBe("Sin barrio");
  });
});

describe("constancia de entrega", () => {
  it("el número lleva la fecha de Argentina y el final del identificador", () => {
    // 20 de octubre a las 1 de la mañana en UTC todavía es 19 en Argentina.
    expect(receiptNumber("cmabc123xyz789", new Date("2026-10-20T01:00:00Z"))).toBe("ENT-20261019-XYZ789");
  });

  it("la ven quienes manejan el stock y Auditoría, no el relevador", () => {
    expect(canViewStormDeliveries("OPERATIVO")).toBe(true);
    expect(canViewStormDeliveries("AUDITOR")).toBe(true);
    expect(canViewStormDeliveries("RELEVADOR_EMERGENCIA")).toBe(false);
    expect(canViewStormDeliveries(null)).toBe(false);
  });
});
