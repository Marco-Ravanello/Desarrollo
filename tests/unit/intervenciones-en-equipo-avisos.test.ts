import { describe, expect, it } from "vitest";
import { canAccompany, checkCompanions, companionsText, MAX_COMPANIONS } from "@/lib/intervention-companions";
import { tallyInterventions } from "@/lib/team-workload";
import { isOldReadNoticeDeletable, READ_NOTICE_KEEP_DAYS, readNoticesCutoff } from "@/lib/bell";

describe("intervenciones hechas entre varios (idea 124)", () => {
  const allowed = new Set(["lucia", "martin", "ana", "pedro", "sol"]);

  it("sin compañía es válido", () => {
    expect(checkCompanions(undefined, "yo", allowed)).toEqual({ ok: true, ids: [] });
    expect(checkCompanions([], "yo", allowed)).toEqual({ ok: true, ids: [] });
  });

  it("saca repetidos, vacíos y a quien la carga", () => {
    expect(checkCompanions(["lucia", "lucia", " ", "yo", "martin"], "yo", allowed)).toEqual({ ok: true, ids: ["lucia", "martin"] });
  });

  it("rechaza a quien no puede figurar y más del máximo", () => {
    expect(checkCompanions(["otro"], "yo", allowed).ok).toBe(false);
    expect(checkCompanions(["lucia", "martin", "ana", "pedro", "sol"], "yo", allowed).ok).toBe(false);
    expect(MAX_COMPANIONS).toBe(4);
    expect(checkCompanions("lucia", "yo", allowed).ok).toBe(false);
  });

  it("solo quien carga expedientes puede ir, y en Violencia de Género solo quien puede verlos", () => {
    expect(canAccompany("OPERATIVO", "Niñez")).toBe(true);
    expect(canAccompany("AUDITOR", "Niñez")).toBe(false);
    expect(canAccompany("OPERATIVO", "Violencia de Género")).toBe(false);
    expect(canAccompany("VIOLENCIA_GENERO", "Violencia de Género")).toBe(true);
  });

  it("arma el texto", () => {
    expect(companionsText([])).toBe("");
    expect(companionsText(["Lucía"])).toBe("Con Lucía");
    expect(companionsText(["Lucía", "Martín"])).toBe("Con Lucía y Martín");
    expect(companionsText(["Lucía", "", "Martín", "Ana"])).toBe("Con Lucía, Martín y Ana");
  });

  it("en Carga del equipo cuenta para cada uno", () => {
    const t = tallyInterventions([
      { userId: "lucia", withUserIds: ["martin"] },
      { userId: "lucia", withUserIds: [] },
      { userId: "martin", withUserIds: ["lucia", "martin"] },
      { userId: "ana", withUserIds: null },
    ]);
    expect(t.get("lucia")).toEqual({ total: 3, shared: 2 });
    expect(t.get("martin")).toEqual({ total: 2, shared: 2 });
    expect(t.get("ana")).toEqual({ total: 1, shared: 0 });
  });
});

describe("limpieza de avisos leídos (idea 132)", () => {
  const now = new Date("2026-11-12T12:00:00Z");
  const old = new Date(now.getTime() - (READ_NOTICE_KEEP_DAYS + 1) * 86_400_000);
  const recent = new Date(now.getTime() - 10 * 86_400_000);

  it("borra solo los leídos de más de 6 meses", () => {
    expect(readNoticesCutoff(now).getTime()).toBe(now.getTime() - 180 * 86_400_000);
    expect(isOldReadNoticeDeletable({ read: true, createdAt: old, title: "Seguimiento para hoy" }, now)).toBe(true);
    expect(isOldReadNoticeDeletable({ read: false, createdAt: old, title: "Seguimiento para hoy" }, now)).toBe(false);
    expect(isOldReadNoticeDeletable({ read: true, createdAt: recent, title: "Seguimiento para hoy" }, now)).toBe(false);
  });

  it("guarda los de algo vencido, para no volver a avisarlo", () => {
    expect(isOldReadNoticeDeletable({ read: true, createdAt: old, title: "Venció la VTV de AB123CD" }, now)).toBe(false);
    expect(isOldReadNoticeDeletable({ read: true, createdAt: old, title: "Terminó el convenio con X" }, now)).toBe(false);
  });
});
