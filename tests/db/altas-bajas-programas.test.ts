import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { enrollInProgramAction, withdrawFromProgramAction } from "@/app/(dashboard)/people/actions/program-enrollment-actions";
import { getProgramEnrollment, getProgramHistory, getProgramMovementCounts, getWithdrawnPrograms } from "@/services/program-enrollment";
import { getFichaSocialByDniFromDb } from "@/services/ficha-social-db";
import { applyPadronImport } from "@/services/padron-import";
import { todayInArgentina } from "@/lib/follow-up-dates";
import { createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local que se vacía en cada archivo.

const TA = "prog_tarjeta_alimentar";
const errorOf = (r: { success: true } | { success: false; error: string }) => (r.success ? null : r.error);

describe("altas y bajas en los programas desde la ficha", () => {
  it("da el alta, la baja y vuelve a dar el alta, con historia y sin pisar otros programas", async () => {
    const operativo = await createUser("OPERATIVO");
    const auditor = await createUser("AUDITOR");
    const relevador = await createUser("RELEVADOR_EMERGENCIA");
    await prisma.padronUnificado.create({
      data: { dni: "97100001", nombre_completo: "Prueba, Ana", programas_activos: "Centro de Familia", prog_centro_de_familia: 1, cantidad_programas: 1 },
    });

    loginAs(auditor as any);
    expect((await enrollInProgramAction("97100001", TA, "2026-10-01")).success).toBe(false);
    loginAs(relevador as any);
    expect((await enrollInProgramAction("97100001", TA, "2026-10-01")).success).toBe(false);

    loginAs(operativo as any);
    expect((await enrollInProgramAction("97100001", "prog_inventado", "2026-10-01")).success).toBe(false);
    expect(errorOf(await enrollInProgramAction("97100001", TA, "2099-01-01"))).toMatch(/posterior a hoy/);

    expect(await enrollInProgramAction("97100001", TA, "2026-10-01", "Ingresa por derivación")).toEqual({ success: true });
    let row = await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "97100001" } });
    expect(row).toMatchObject({ prog_tarjeta_alimentar: 1, prog_centro_de_familia: 1, cantidad_programas: 2, programas_activos: "Centro de Familia | Tarjeta Alimentar" });
    expect(await prisma.participacionPrograma.count({ where: { dni: "97100001", programa: "Tarjeta Alimentar" } })).toBe(1);
    // Dos veces no.
    expect(errorOf(await enrollInProgramAction("97100001", TA, "2026-10-02"))).toMatch(/Ya está/);

    let ficha = await getFichaSocialByDniFromDb("97100001");
    expect(Object.keys(ficha.detalle_programas ?? {})).toContain("Tarjeta Alimentar");

    // La baja pide motivo y no puede ser antes del alta.
    expect((await withdrawFromProgramAction("97100001", TA, "2026-10-10", "  ")).success).toBe(false);
    expect(errorOf(await withdrawFromProgramAction("97100001", TA, "2026-09-30", "Se mudó"))).toMatch(/antes del alta/);
    expect(await withdrawFromProgramAction("97100001", TA, "2026-10-10", "Se mudó fuera del partido")).toEqual({ success: true });
    row = await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "97100001" } });
    expect(row).toMatchObject({ prog_tarjeta_alimentar: 0, prog_centro_de_familia: 1, cantidad_programas: 1, programas_activos: "Centro de Familia" });
    expect(errorOf(await withdrawFromProgramAction("97100001", TA, "2026-10-11", "Otra vez"))).toMatch(/No está/);

    // La ficha ya no muestra el detalle del programa; la historia sí.
    ficha = await getFichaSocialByDniFromDb("97100001");
    expect(Object.keys(ficha.detalle_programas ?? {})).not.toContain("Tarjeta Alimentar");
    expect(ficha.programas_activos).toEqual(["Centro de Familia"]);
    expect(await getWithdrawnPrograms("97100001")).toEqual(new Set([TA]));

    expect(await enrollInProgramAction("97100001", TA, "2026-10-20")).toEqual({ success: true });
    expect(await getWithdrawnPrograms("97100001")).toEqual(new Set());
    const history = await getProgramHistory("97100001");
    expect(history.map((m) => `${m.tipo} ${m.fecha.slice(0, 10)}`)).toEqual(["ALTA 2026-10-20", "BAJA 2026-10-10", "ALTA 2026-10-01"]);
    expect(history[1]).toMatchObject({ programa: "Tarjeta Alimentar", motivo: "Se mudó fuera del partido", autor: "Prueba OPERATIVO", origen: "APP" });
    expect(await prisma.auditLog.count({ where: { entityId: "97100001", action: { in: ["PADRON_PROGRAMA_ALTA", "PADRON_PROGRAMA_BAJA"] } } })).toBe(3);

    const counts = await getProgramMovementCounts(new Date("2026-10-01T00:00:00-03:00"), new Date("2026-10-15T23:59:59-03:00"));
    expect(counts).toEqual([{ column: TA, label: "Tarjeta Alimentar", altas: 1, bajas: 1 }]);
  });

  it("saca el programa aunque esté escrito de otra forma en el padrón", async () => {
    const operativo = await createUser("OPERATIVO");
    loginAs(operativo as any);
    await prisma.padronUnificado.create({
      data: { dni: "97100002", nombre_completo: "Prueba, Beto", programas_activos: "TARJETA ALIMENTAR | Envión", cantidad_programas: 2 },
    });
    expect((await getProgramEnrollment("97100002")).active.map((p) => p.column)).toEqual([TA]);
    expect(await withdrawFromProgramAction("97100002", TA, todayInArgentina(), "Ya no cumple los requisitos")).toEqual({ success: true });
    const row = await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "97100002" } });
    // La columna estaba en 0 (datos viejos): la cantidad no se toca.
    expect(row).toMatchObject({ programas_activos: "Envión", cantidad_programas: 2 });
  });

  it("suma al padrón a quien solo está en el Registro Único", async () => {
    const operativo = await createUser("OPERATIVO");
    loginAs(operativo as any);
    await prisma.person.create({ data: { dni: "97100003", firstName: "Carla", lastName: "Prueba", address: "Calle Inventada 10", phone: "1144440000" } });
    expect((await getProgramEnrollment("97100003")).inPadron).toBe(false);
    expect(await enrollInProgramAction("97100003", "prog_centro_de_familia", todayInArgentina())).toEqual({ success: true });
    expect(await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "97100003" } })).toMatchObject({
      nombre_completo: "Prueba, Carla", direccion: "Calle Inventada 10", telefono: "1144440000", cantidad_programas: 1, prog_centro_de_familia: 1,
    });
    expect(errorOf(await enrollInProgramAction("97100099", TA, todayInArgentina()))).toMatch(/No se encontró/);
  });

  it("la importación de planillas también deja el alta en la historia", async () => {
    const admin = await createUser("ADMIN_GENERAL");
    await applyPadronImport([{ row: 2, dni: "97100004", nombreCompleto: "Prueba, Dora" }], TA, "Tarjeta Alimentar", "alimentar.xlsx", admin.id);
    const history = await getProgramHistory("97100004");
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ tipo: "ALTA", origen: "IMPORTACION", motivo: "Planilla alimentar.xlsx" });
  });
});
