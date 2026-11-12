import { describe, expect, it } from "vitest";
import { canEditCase, caseEditTitle, checkCaseEdit, rebuildCaseTitle, splitCaseEditDetails } from "@/lib/case-edit";
import { awayFromRecord, awayPhrase, awayText, suggestUserForRecord } from "@/lib/staff-away";
import { awayWithCases, pickLeastLoaded, suggestAssignee, type WorkloadMember } from "@/lib/team-workload";
import { BELL_POLL_MS, NOTICES_RECHECK_MS, noticesRecheckCutoff, shouldPollBell } from "@/lib/bell";
import { describeAuditAction } from "@/lib/audit-labels";

const d = (day: string) => new Date(`${day}T00:00:00Z`);

describe("121: editar el expediente", () => {
  const current = { title: "Pedido de módulo alimentario", description: "Familia de 4.", priority: "MEDIA" };

  it("cambiar solo la prioridad deja una línea clara", () => {
    const r = checkCaseEdit(current, { title: current.title, description: current.description, priority: "URGENTE" });
    expect(r).toMatchObject({ ok: true, changed: true, details: "Prioridad: media → urgente." });
    if (r.ok && r.changed) {
      expect(r.data.priority).toBe("URGENTE");
      expect(caseEditTitle(splitCaseEditDetails(r.details).summary)).toBe("Cambió la prioridad a urgente");
    }
  });

  it("guarda la descripción anterior para que no se pierda", () => {
    const r = checkCaseEdit(current, { title: "Pedido de módulo y colchón", description: "Familia de 5.", priority: "MEDIA" });
    expect(r.ok && r.changed).toBe(true);
    if (r.ok && r.changed) {
      const { summary, previousDescription } = splitCaseEditDetails(r.details);
      expect(summary).toBe("Carátula: “Pedido de módulo alimentario” → “Pedido de módulo y colchón”.\nCorrigió la descripción.");
      expect(previousDescription).toBe("Familia de 4.");
      expect(caseEditTitle(summary)).toBe("Corrigió los datos del expediente");
    }
  });

  it("sin cambios no guarda nada; sin carátula o prioridad rara, avisa", () => {
    expect(checkCaseEdit(current, { title: " Pedido de módulo alimentario ", description: "Familia de 4.", priority: "MEDIA" })).toEqual({ ok: true, changed: false });
    expect(checkCaseEdit(current, { title: "  ", description: "", priority: "MEDIA" })).toMatchObject({ ok: false });
    expect(checkCaseEdit(current, { title: "x", description: "", priority: "MUY_ALTA" })).toMatchObject({ ok: false });
    expect(checkCaseEdit(current, { title: "x".repeat(201), description: "", priority: "MEDIA" })).toMatchObject({ ok: false });
  });

  it("agregar o borrar la descripción", () => {
    const sin = { ...current, description: null };
    const r1 = checkCaseEdit(sin, { title: current.title, description: "Nueva", priority: "MEDIA" });
    expect(r1.ok && r1.changed && r1.details).toBe("Agregó una descripción.");
    const r2 = checkCaseEdit(current, { title: current.title, description: "", priority: "MEDIA" });
    expect(r2.ok && r2.changed && r2.data.description).toBeNull();
    expect(r2.ok && r2.changed && splitCaseEditDetails(r2.details).summary).toBe("Borró la descripción.");
  });

  it("conserva la marca de tormenta de la carátula", () => {
    expect(rebuildCaseTitle("[CONTINGENCIA TORMENTA] Familia Pérez", "Familia Pérez y Gómez")).toBe("[CONTINGENCIA TORMENTA] Familia Pérez y Gómez");
    expect(rebuildCaseTitle("Familia Pérez", "Familia Gómez")).toBe("Familia Gómez");
    expect(rebuildCaseTitle("[CONTINGENCIA TORMENTA]", "[CONTINGENCIA TORMENTA]")).toBe("[CONTINGENCIA TORMENTA]");
  });

  it("quién puede: no Auditoría, no cerrados, VG solo con permiso", () => {
    const open = { status: "ABIERTO", areaName: "Dirección de Protección Social" };
    expect(canEditCase({ role: "OPERATIVO" }, open)).toBe(true);
    expect(canEditCase({ role: "AUDITOR" }, open)).toBe(false);
    expect(canEditCase({ role: "RELEVADOR_EMERGENCIA" }, open)).toBe(false);
    expect(canEditCase({ role: "OPERATIVO" }, { ...open, status: "CERRADO" })).toBe(false);
    const vg = { status: "ABIERTO", areaName: "Coordinación de Asistencia y Protección a Mujeres Víctimas de Violencia" };
    expect(canEditCase({ role: "OPERATIVO" }, vg)).toBe(false);
    expect(canEditCase({ role: "VIOLENCIA_GENERO" }, vg)).toBe(true);
  });

  it("la corrección tiene nombre en Auditoría", () => {
    expect(describeAuditAction("CASE_EDIT", "Case")).toMatchObject({ group: "expedientes", label: expect.stringContaining("Corrigió") });
    expect(describeAuditAction("HR_CUENTA", "HRRecord").label).toContain("legajo");
  });
});

describe("127: licencias de los usuarios", () => {
  const today = "2026-11-12";

  it("una licencia que incluye hoy cuenta, sin decir de qué tipo", () => {
    const a = awayFromRecord({ status: "ACTIVO", statusUntil: null, leaves: [{ kind: "ENFERMEDAD", startDate: d("2026-11-10"), endDate: d("2026-11-20") }] }, today);
    expect(a).toEqual({ kind: "LICENCIA", until: "2026-11-20" });
    expect(awayText(a!)).toBe("De licencia hasta el 20/11");
    expect(awayPhrase(a!)).toBe("de licencia hasta el 20/11");
  });

  it("vacaciones, situación sin fecha y vuelta vencida", () => {
    expect(awayText(awayFromRecord({ status: "VACACIONES", statusUntil: d("2026-11-15"), leaves: [] }, today)!)).toBe("De vacaciones hasta el 15/11");
    expect(awayText(awayFromRecord({ status: "LICENCIA", statusUntil: null, leaves: [] }, today)!)).toBe("De licencia");
    expect(awayFromRecord({ status: "LICENCIA", statusUntil: d("2026-11-11"), leaves: [] }, today)).toBeNull();
    expect(awayFromRecord({ status: "ACTIVO", statusUntil: null, leaves: [{ kind: "VACACIONES", startDate: d("2026-11-13"), endDate: d("2026-11-20") }] }, today)).toBeNull();
    expect(awayFromRecord({ status: "BAJA", statusUntil: null, leaves: [{ kind: "VACACIONES", startDate: d("2026-11-10"), endDate: d("2026-11-20") }] }, today)).toBeNull();
  });

  it("sugiere la cuenta por correo o por nombre, si hay una sola", () => {
    const users = [
      { id: "1", name: "Lucía Gómez", email: "lgomez@muni.gob.ar" },
      { id: "2", name: "Martín Pérez", email: null },
      { id: "3", name: "Martín Pérez", email: "otro@muni.gob.ar" },
    ];
    expect(suggestUserForRecord({ firstName: "Lucia", lastName: "GOMEZ", email: null }, users)?.id).toBe("1");
    expect(suggestUserForRecord({ firstName: "X", lastName: "Y", email: "LGomez@muni.gob.ar " }, users)?.id).toBe("1");
    expect(suggestUserForRecord({ firstName: "Martín", lastName: "Pérez", email: null }, users)).toBeNull();
  });

  const row = (over: Partial<WorkloadMember>): WorkloadMember => ({
    userId: "u", name: "N", role: "OPERATIVO", member: true, eligible: true, open: 0, urgent: 0, stale: 0, recent: 0, away: null, ...over,
  });

  it("no propone a quien está de licencia, y avisa si tiene expedientes", () => {
    const rows = [
      row({ userId: "a", name: "Ana", open: 0, away: "De licencia hasta el 20/11" }),
      row({ userId: "b", name: "Beto", open: 3 }),
      row({ userId: "c", name: "Caro", open: 5, urgent: 2, away: "De vacaciones" }),
    ];
    expect(pickLeastLoaded(rows)?.userId).toBe("b");
    expect(awayWithCases(rows).map((r) => r.userId)).toEqual(["c"]);
    expect(pickLeastLoaded([rows[0]])).toBeNull();
    const options = [
      { id: "a", name: "Ana", role: "OPERATIVO" as const, open: 0, sameArea: true, away: "De licencia" },
      { id: "b", name: "Beto", role: "OPERATIVO" as const, open: 3, sameArea: true, away: null },
    ];
    expect(suggestAssignee(options)?.id).toBe("b");
  });
});

describe("130: campanita más liviana", () => {
  it("con la pestaña escondida no pregunta", () => {
    expect(shouldPollBell({ visible: false, lastFetchAt: 0, now: 10 * BELL_POLL_MS })).toBe(false);
    expect(shouldPollBell({ visible: true, lastFetchAt: 0, now: BELL_POLL_MS })).toBe(true);
    expect(shouldPollBell({ visible: true, lastFetchAt: 1000, now: 2000 })).toBe(false);
    expect(shouldPollBell({ visible: true, lastFetchAt: 1000, now: 20_000, minGapMs: 15_000 })).toBe(true);
  });

  it("seguimientos y vencimientos, cada media hora como mucho", () => {
    expect(NOTICES_RECHECK_MS).toBe(30 * 60 * 1000);
    const now = new Date("2026-11-12T14:00:00Z");
    expect(noticesRecheckCutoff(now).toISOString()).toBe("2026-11-12T13:30:00.000Z");
  });
});
