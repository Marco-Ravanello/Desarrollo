import { describe, expect, it } from "vitest";
import { isTaskRepeat, nextOccurrence, repeatLabel } from "@/lib/tasks";

// 10:30 de Argentina = 13:30 UTC.
const ar = (day: string, time = "10:30") => new Date(`${day}T${time}:00-03:00`);

describe("tareas que se repiten", () => {
  it("la próxima es la misma hora, una semana, 15 días o un mes después", () => {
    expect(nextOccurrence(ar("2026-10-28"), "SEMANAL", "2026-10-28")).toEqual(ar("2026-11-04"));
    expect(nextOccurrence(ar("2026-10-28"), "QUINCENAL", "2026-10-28")).toEqual(ar("2026-11-11"));
    expect(nextOccurrence(ar("2026-10-28"), "MENSUAL", "2026-10-28")).toEqual(ar("2026-11-28"));
    // De noche en Argentina ya es otro día en UTC: igual cuenta el día de acá.
    expect(nextOccurrence(ar("2026-10-31", "22:00"), "MENSUAL", "2026-10-31")).toEqual(ar("2026-11-30", "22:00"));
  });

  it("después del 31 viene el último día del mes, y en diciembre pasa al año siguiente", () => {
    expect(nextOccurrence(ar("2027-01-31"), "MENSUAL", "2027-01-31")).toEqual(ar("2027-02-28"));
    expect(nextOccurrence(ar("2026-12-15"), "MENSUAL", "2026-12-15")).toEqual(ar("2027-01-15"));
  });

  it("si quedó atrasada, la próxima es de hoy en adelante", () => {
    expect(nextOccurrence(ar("2026-10-01"), "SEMANAL", "2026-10-28")).toEqual(ar("2026-10-29"));
    expect(nextOccurrence(ar("2026-10-07"), "SEMANAL", "2026-10-28")).toEqual(ar("2026-10-28"));
    expect(nextOccurrence(ar("2026-07-31"), "MENSUAL", "2026-10-28")).toEqual(ar("2026-10-31"));
  });

  it("las fechas sin hora (medianoche UTC) siguen sin correrse de día", () => {
    expect(nextOccurrence(new Date("2026-10-30T00:00:00Z"), "MENSUAL", "2026-10-28")).toEqual(new Date("2026-11-30T00:00:00Z"));
    expect(nextOccurrence(new Date("2026-10-30T00:00:00Z"), "SEMANAL", "2026-10-28")).toEqual(new Date("2026-11-06T00:00:00Z"));
  });

  it("nombres y valores", () => {
    expect(repeatLabel("QUINCENAL")).toBe("Se repite cada 15 días");
    expect(repeatLabel(null)).toBeNull();
    expect(isTaskRepeat("MENSUAL")).toBe(true);
    expect(isTaskRepeat("DIARIA")).toBe(false);
  });
});
