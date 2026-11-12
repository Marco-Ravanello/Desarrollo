import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { closeCaseAction, undoCloseCaseAction } from "@/app/(dashboard)/people/actions/close-case";
import { addTaskAction, toggleTaskAction, undoTaskDoneAction } from "@/app/(dashboard)/tasks/actions";
import { enrollInProgramAction, undoWithdrawFromProgramAction, withdrawFromProgramAction } from "@/app/(dashboard)/people/actions/program-enrollment-actions";
import { markAllAsRead, undoMarkAllAsRead } from "@/app/(dashboard)/actions/notifications";
import { undoCloseCase } from "@/services/case-closing";
import { undoWithdrawFromProgram } from "@/services/program-enrollment";
import { getCaseEvents } from "@/services/case-timeline";
import { todayInArgentina } from "@/lib/follow-up-dates";
import { UNDO_WINDOW_MS } from "@/lib/undo";
import { createArea, createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local que se vacía en cada archivo.

const errorOf = (r: { success: boolean; error?: string }) => (r.success ? null : r.error);
const later = () => new Date(Date.now() + UNDO_WINDOW_MS + 60_000);

describe("deshacer el cierre de un expediente", () => {
  it("vuelve a quedar abierto, sin el cierre en la historia, y Auditoría lo guarda como deshecho", async () => {
    const area = await createArea("Protección Social (prueba deshacer)");
    const operativo = await createUser("OPERATIVO", area.id);
    const otro = await createUser("OPERATIVO", area.id);
    const person = await prisma.person.create({ data: { dni: "95100001", firstName: "Titular", lastName: "Deshacer" } });
    const c = await prisma.case.create({ data: { title: "Caso a deshacer", personId: person.id, areaId: area.id } });

    loginAs(operativo as any);
    // Sin cierre, no hay nada que deshacer.
    expect(errorOf(await undoCloseCaseAction(c.id))).toMatch(/no está cerrado/);
    expect((await closeCaseAction(c.id, "Me equivoqué de expediente")).success).toBe(true);

    // Otra persona no puede deshacer el cierre ajeno.
    loginAs(otro as any);
    expect(errorOf(await undoCloseCaseAction(c.id))).toMatch(/acabás de hacer/);
    // Pasado el rato, tampoco quien lo cerró.
    expect(errorOf(await undoCloseCase({ id: operativo.id, role: operativo.role }, c.id, later()))).toMatch(/Ya pasó/);

    loginAs(operativo as any);
    expect(await undoCloseCaseAction(c.id)).toEqual({ success: true });
    expect((await prisma.case.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("ABIERTO");
    expect(await prisma.auditLog.count({ where: { entityId: c.id, action: "CLOSE_CASE" } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { entityId: c.id, action: "CLOSE_CASE_DESHECHO" } })).toBe(1);
    const events = await getCaseEvents({ id: c.id, createdAt: c.createdAt, areaName: area.name }, []);
    expect(events.filter((e) => e.kind === "CIERRE")).toEqual([]);
    // Dos veces no.
    expect(errorOf(await undoCloseCaseAction(c.id))).toMatch(/no está cerrado/);
  });

  it("si después del cierre se cargó algo, hay que reabrir con motivo", async () => {
    const area = await createArea("Niñez (prueba deshacer)");
    const operativo = await createUser("OPERATIVO", area.id);
    const person = await prisma.person.create({ data: { dni: "95100002", firstName: "Titular", lastName: "Deshacer dos" } });
    const c = await prisma.case.create({ data: { title: "Caso con algo después", personId: person.id, areaId: area.id } });
    loginAs(operativo as any);
    expect((await closeCaseAction(c.id, "Se resolvió")).success).toBe(true);
    await prisma.intervention.create({ data: { caseId: c.id, personId: person.id, userId: operativo.id, description: "Llamado inventado" } });
    expect(errorOf(await undoCloseCaseAction(c.id))).toMatch(/Reabrilo con un motivo/);
    expect((await prisma.case.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("CERRADO");
  });
});

describe("deshacer una tarea marcada como hecha", () => {
  it("vuelve a quedar pendiente y la próxima recién creada se borra", async () => {
    const owner = await createUser("OPERATIVO");
    const mate = await createUser("OPERATIVO");
    loginAs(owner as any);
    expect((await addTaskAction("Rendición deshacer", undefined, todayInArgentina(), "MEDIA", "SEMANAL")).success).toBe(true);
    const task = await prisma.task.findFirstOrThrow({ where: { userId: owner.id, title: "Rendición deshacer" } });
    expect(errorOf(await undoTaskDoneAction(task.id))).toMatch(/ya está pendiente/);
    expect((await toggleTaskAction(task.id, "PENDIENTE")).success).toBe(true);
    expect(await prisma.task.count({ where: { userId: owner.id, title: "Rendición deshacer" } })).toBe(2);

    loginAs(mate as any);
    expect(errorOf(await undoTaskDoneAction(task.id))).toMatch(/Solo quien creó/);

    loginAs(owner as any);
    expect(await undoTaskDoneAction(task.id)).toEqual({ success: true });
    const after = await prisma.task.findMany({ where: { userId: owner.id, title: "Rendición deshacer" } });
    expect(after).toEqual([expect.objectContaining({ id: task.id, status: "PENDIENTE", nextTaskId: null })]);
  });

  it("si la próxima ya avisó en la campana, queda", async () => {
    const owner = await createUser("OPERATIVO");
    loginAs(owner as any);
    expect((await addTaskAction("Informe deshacer", undefined, todayInArgentina(), "MEDIA", "MENSUAL")).success).toBe(true);
    const task = await prisma.task.findFirstOrThrow({ where: { userId: owner.id, title: "Informe deshacer" } });
    expect((await toggleTaskAction(task.id, "PENDIENTE")).success).toBe(true);
    const next = await prisma.task.findFirstOrThrow({ where: { userId: owner.id, title: "Informe deshacer", status: "PENDIENTE" } });
    await prisma.task.update({ where: { id: next.id }, data: { notifiedAt: new Date() } });
    expect((await undoTaskDoneAction(task.id)).success).toBe(true);
    expect(await prisma.task.count({ where: { userId: owner.id, title: "Informe deshacer" } })).toBe(2);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).nextTaskId).toBe(next.id);
  });
});

describe("deshacer una baja de un programa", () => {
  const TA = "prog_tarjeta_alimentar";

  it("vuelve a quedar en el programa y la baja no queda en la historia ni en Reportes", async () => {
    const operativo = await createUser("OPERATIVO");
    const otro = await createUser("OPERATIVO");
    await prisma.padronUnificado.create({
      data: { dni: "97200001", nombre_completo: "Prueba, Deshacer", programas_activos: "Centro de Familia", prog_centro_de_familia: 1, cantidad_programas: 1 },
    });
    loginAs(operativo as any);
    expect((await enrollInProgramAction("97200001", TA, todayInArgentina())).success).toBe(true);
    expect((await withdrawFromProgramAction("97200001", TA, todayInArgentina(), "Me equivoqué de persona")).success).toBe(true);
    let row = await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "97200001" } });
    expect(row).toMatchObject({ prog_tarjeta_alimentar: 0, cantidad_programas: 1 });

    loginAs(otro as any);
    expect(errorOf(await undoWithdrawFromProgramAction("97200001", TA))).toMatch(/acabás de dar/);
    expect(errorOf(await undoWithdrawFromProgram(operativo, { dni: "97200001", column: TA }, later()))).toMatch(/Ya pasó/);

    loginAs(operativo as any);
    expect(await undoWithdrawFromProgramAction("97200001", TA)).toEqual({ success: true });
    row = await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "97200001" } });
    expect(row).toMatchObject({ prog_tarjeta_alimentar: 1, prog_centro_de_familia: 1, cantidad_programas: 2, programas_activos: "Centro de Familia | Tarjeta Alimentar" });
    const movs = await prisma.padronMovimiento.findMany({ where: { dni: "97200001" } });
    expect(movs.map((m) => m.tipo)).toEqual(["ALTA"]);
    expect(await prisma.auditLog.count({ where: { entityId: "97200001", action: "PADRON_PROGRAMA_BAJA" } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { entityId: "97200001", action: "PADRON_PROGRAMA_BAJA_DESHECHA" } })).toBe(1);
    // Ya no hay baja para deshacer.
    expect(errorOf(await undoWithdrawFromProgramAction("97200001", TA))).toMatch(/acabás de dar/);
  });
});

describe("deshacer \"Marcar todas como leídas\"", () => {
  it("vuelven a quedar sin leer solo esos avisos, y solo los propios", async () => {
    const yo = await createUser("OPERATIVO");
    const otra = await createUser("OPERATIVO");
    await prisma.notification.createMany({
      data: [
        { userId: yo.id, title: "Aviso uno", message: "Inventado" },
        { userId: yo.id, title: "Aviso dos", message: "Inventado" },
        { userId: yo.id, title: "Aviso viejo", message: "Inventado", read: true },
        { userId: otra.id, title: "Aviso de otra", message: "Inventado", read: true },
      ],
    });
    loginAs(yo as any);
    const ids = await markAllAsRead();
    expect(ids).toHaveLength(2);
    expect(await prisma.notification.count({ where: { userId: yo.id, read: false } })).toBe(0);

    const ajeno = await prisma.notification.findFirstOrThrow({ where: { userId: otra.id } });
    expect(await undoMarkAllAsRead([...ids, ajeno.id])).toEqual({ success: true });
    const unread = await prisma.notification.findMany({ where: { read: false }, select: { title: true } });
    expect(unread.map((n) => n.title).sort()).toEqual(["Aviso dos", "Aviso uno"]);
    expect(await markAllAsRead()).toHaveLength(2);
    expect(await markAllAsRead()).toEqual([]);
  });
});
