import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { addTaskAction, toggleTaskAction, updateTaskAction } from "@/app/(dashboard)/tasks/actions";
import { createSharedTaskAction } from "@/app/(dashboard)/admin/actions/calendar-actions";
import { getTasksSharedWith, setTaskDone } from "@/services/tasks";
import { todayInArgentina, addDays } from "@/lib/follow-up-dates";
import { createArea, createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local que se vacía en cada archivo.

const errorOf = (r: { success: boolean; error?: string }) => (r.success ? null : r.error);
const hoy = todayInArgentina();
const ar = (day: string, time = "10:30") => new Date(`${day}T${time}:00-03:00`);

describe("tareas que se repiten", () => {
  it("al marcarla como hecha se crea la próxima, una sola vez", async () => {
    const owner = await createUser("OPERATIVO");
    const mate = await createUser("OPERATIVO");
    loginAs(owner as any);
    expect(errorOf(await addTaskAction("Rendición", undefined, null, "MEDIA", "SEMANAL"))).toMatch(/ponele una fecha/);
    expect(errorOf(await addTaskAction("Rendición", undefined, hoy, "MEDIA", "DIARIA"))).toMatch(/cada cuánto/);
    expect(await addTaskAction("Rendición", "Llevar las planillas", hoy, "ALTA", "SEMANAL")).toEqual({ success: true });
    const task = await prisma.task.findFirstOrThrow({ where: { userId: owner.id, title: "Rendición" } });
    expect(task.repeat).toBe("SEMANAL");
    await prisma.task.update({ where: { id: task.id }, data: { viewerIds: mate.id } });

    const done = await toggleTaskAction(task.id, "PENDIENTE");
    expect(done.success).toBe(true);
    const nextDay = addDays(hoy, 7);
    expect(done.success && done.next?.slice(0, 10)).toBe(nextDay);
    const next = await prisma.task.findFirstOrThrow({ where: { userId: owner.id, title: "Rendición", status: "PENDIENTE" } });
    expect(next).toMatchObject({ description: "Llevar las planillas", priority: "ALTA", viewerIds: mate.id, repeat: "SEMANAL", notifiedAt: null });
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).nextTaskId).toBe(next.id);

    // Abrirla y volver a cerrarla no crea otra.
    await toggleTaskAction(task.id, "COMPLETADA");
    expect((await toggleTaskAction(task.id, "PENDIENTE")).success).toBe(true);
    expect(await prisma.task.count({ where: { userId: owner.id, title: "Rendición" } })).toBe(2);

    // Si se borró la próxima, al cerrarla de nuevo se vuelve a crear.
    await prisma.task.delete({ where: { id: next.id } });
    await toggleTaskAction(task.id, "COMPLETADA");
    await toggleTaskAction(task.id, "PENDIENTE");
    expect(await prisma.task.count({ where: { userId: owner.id, title: "Rendición" } })).toBe(2);
  });

  it("una atrasada salta a la próxima fecha desde hoy, y solo la marca quien la creó o la conducción", async () => {
    const owner = await createUser("OPERATIVO");
    const viewer = await createUser("OPERATIVO");
    const dg = await createUser("DIRECCION_GENERAL");
    const task = await prisma.task.create({
      data: { userId: owner.id, title: "Reunión de equipo", dueDate: ar("2026-07-31"), repeat: "MENSUAL", viewerIds: viewer.id },
    });
    const now = ar("2026-10-28");
    expect(errorOf(await setTaskDone(viewer, task.id, true, now))).toMatch(/Solo quien creó/);
    const res = await setTaskDone(dg, task.id, true, now);
    expect(res.success && res.next).toEqual(ar("2026-10-31"));
  });

  it("sin repetir no crea nada; editar pide fecha para repetir", async () => {
    const owner = await createUser("OPERATIVO");
    const task = await prisma.task.create({ data: { userId: owner.id, title: "Llamar", dueDate: ar("2026-11-02") } });
    expect(await setTaskDone(owner, task.id, true)).toEqual({ success: true, next: null });
    loginAs(owner as any);
    const edit = { title: "Llamar", priority: "MEDIA", viewerIds: [], repeat: "QUINCENAL" };
    expect(errorOf(await updateTaskAction(task.id, { ...edit, day: null }))).toMatch(/ponele una fecha/);
    expect(await updateTaskAction(task.id, { ...edit, day: "2026-11-02", time: "09:00" })).toEqual({ success: true });
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).repeat).toBe("QUINCENAL");
    expect(await updateTaskAction(task.id, { ...edit, repeat: null, day: "2026-11-02" })).toEqual({ success: true });
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).repeat).toBeNull();
  });

  it("desde la Agenda también se puede elegir que se repita", async () => {
    const owner = await createUser("OPERATIVO");
    loginAs(owner as any);
    expect(await createSharedTaskAction("Visita al comedor", "", ar("2026-11-05").toISOString(), "", "MENSUAL")).toEqual({ success: true });
    expect((await prisma.task.findFirstOrThrow({ where: { userId: owner.id } })).repeat).toBe("MENSUAL");
  });
});

describe("compartidas conmigo", () => {
  it("lista las tareas de otros que me incluyen, con quién la creó, sin las propias ni ids parecidos", async () => {
    const me = await createUser("OPERATIVO");
    const other = await prisma.user.create({ data: { email: "otra@prueba.test", name: "Prueba Otra", username: "prueba.otra" } });
    const someoneElse = await createUser("OPERATIVO");
    await prisma.task.createMany({
      data: [
        { userId: other.id, title: "Compartida", viewerIds: `${someoneElse.id},${me.id}` },
        { userId: other.id, title: "Hecha", viewerIds: me.id, status: "COMPLETADA" },
        { userId: other.id, title: "Con un id parecido", viewerIds: `${me.id}x` },
        { userId: other.id, title: "No compartida" },
        { userId: me.id, title: "Mía", viewerIds: someoneElse.id },
      ],
    });
    const area = await createArea("Prueba Violencia de Género");
    const person = await prisma.person.create({ data: { dni: "97500001", firstName: "Ana", lastName: "Prueba" } });
    const caso = await prisma.case.create({ data: { title: "Expediente reservado", priority: "MEDIA", personId: person.id, areaId: area.id } });
    await prisma.task.create({ data: { userId: other.id, title: "Seguimiento", viewerIds: me.id, caseId: caso.id } });

    const list = await getTasksSharedWith(me.id);
    expect(list.map((t) => t.title).sort()).toEqual(["Compartida", "Hecha", "Seguimiento"]);
    expect(list[0].status).toBe("PENDIENTE");
    expect(list.find((t) => t.title === "Compartida")!.ownerName).toBe("Prueba Otra");
    const seguimiento = list.find((t) => t.title === "Seguimiento")!;
    expect(seguimiento.caseId).toBe(caso.id);
    expect(JSON.stringify(seguimiento)).not.toContain("Expediente reservado");
  });
});
