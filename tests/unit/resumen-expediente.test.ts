import { describe, expect, it } from "vitest";
import { agoText, daysBetween, daysText, summarizeCase } from "@/lib/case-summary";

const now = new Date("2026-10-20T15:00:00Z");

describe("resumen del expediente", () => {
  it("cuenta días de calendario en hora argentina", () => {
    // 20/10 01:00 UTC todavía es 19/10 en Argentina.
    expect(daysBetween(new Date("2026-10-20T01:00:00Z"), now)).toBe(1);
    expect(daysBetween(new Date("2026-10-20T12:00:00Z"), now)).toBe(0);
    expect(daysBetween(new Date("2026-09-20T15:00:00Z"), now)).toBe(30);
  });

  it("escribe los días como se leen", () => {
    expect(daysText(0)).toBe("hoy");
    expect(daysText(1)).toBe("1 día");
    expect(daysText(12)).toBe("12 días");
    expect(agoText(0)).toBe("hoy");
    expect(agoText(1)).toBe("ayer");
    expect(agoText(5)).toBe("hace 5 días");
  });

  it("marca como quieto un expediente abierto sin intervenciones hace 30 días o más", () => {
    const s = summarizeCase({
      status: "EN_PROCESO",
      createdAt: new Date("2026-08-01T12:00:00Z"),
      lastInterventionAt: new Date("2026-09-20T12:00:00Z"),
      now,
    });
    expect(s.lastInterventionDays).toBe(30);
    expect(s.stale).toBe(true);
    expect(s.openDays).toBe(80);
  });

  it("no marca un expediente con movimiento reciente", () => {
    const s = summarizeCase({
      status: "ABIERTO",
      createdAt: new Date("2026-08-01T12:00:00Z"),
      lastInterventionAt: new Date("2026-10-15T12:00:00Z"),
      now,
    });
    expect(s.stale).toBe(false);
    expect(s.lastInterventionDays).toBe(5);
  });

  it("sin intervenciones cuenta desde la apertura", () => {
    const nuevo = summarizeCase({ status: "ABIERTO", createdAt: new Date("2026-10-10T12:00:00Z"), now });
    expect(nuevo.lastInterventionDays).toBeNull();
    expect(nuevo.stale).toBe(false);
    const viejo = summarizeCase({ status: "ABIERTO", createdAt: new Date("2026-09-01T12:00:00Z"), now });
    expect(viejo.stale).toBe(true);
  });

  it("un expediente cerrado cuenta hasta el cierre y nunca se marca quieto", () => {
    const s = summarizeCase({
      status: "CERRADO",
      createdAt: new Date("2026-08-01T12:00:00Z"),
      closedAt: new Date("2026-08-11T12:00:00Z"),
      now,
    });
    expect(s.closed).toBe(true);
    expect(s.openDays).toBe(10);
    expect(s.stale).toBe(false);
  });
});
