import { describe, expect, it } from "vitest";
import { argentinaDay, canEditIntervention, interventionTypeLabel, isInterventionType } from "@/lib/intervention-types";

describe("corregir intervenciones", () => {
  it("el día se cuenta con la hora de Buenos Aires", () => {
    // 01:30 en UTC del 20 es todavía el 19 a la noche en Argentina.
    expect(argentinaDay(new Date("2026-10-20T01:30:00Z"))).toBe("2026-10-19");
    expect(argentinaDay(new Date("2026-10-20T03:30:00Z"))).toBe("2026-10-20");
  });

  it("solo quien la cargó y el mismo día", () => {
    const i = { userId: "u1", createdAt: new Date("2026-10-19T12:00:00Z") };
    expect(canEditIntervention(i, "u1", new Date("2026-10-20T02:00:00Z"))).toBe(true); // 23 h del mismo día en Argentina
    expect(canEditIntervention(i, "u1", new Date("2026-10-20T03:30:00Z"))).toBe(false); // ya es el día siguiente
    expect(canEditIntervention(i, "u2", new Date("2026-10-19T13:00:00Z"))).toBe(false);
    expect(canEditIntervention(i, null, new Date("2026-10-19T13:00:00Z"))).toBe(false);
  });

  it("tipos válidos con nombre legible", () => {
    expect(interventionTypeLabel("VISITA")).toBe("Visita domiciliaria");
    expect(interventionTypeLabel(null)).toBeNull();
    expect(isInterventionType("LLAMADA")).toBe(true);
    expect(isInterventionType("visita")).toBe(false);
  });
});
