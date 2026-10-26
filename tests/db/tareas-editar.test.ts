import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { updateTaskAction } from "@/app/(dashboard)/tasks/actions";
import { getShareableUsers } from "@/services/tasks";
import { createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local que se vacía en cada archivo.

const errorOf = (r: { success: true } | { success: false; error: string }) => (r.success ? null : r.error);
const edit = (over: Record<string, unknown> = {}) => ({
  title: "Visita a la familia",
  description: "Llevar la constancia",
  day: "2026-11-03",
  time: "10:30",
  priority: "ALTA",
  viewerIds: [] as string[],
  ...over,
});

describe("editar una tarea", () => {
  it("cambia título, notas, fecha, prioridad y con quién se comparte", async () => {
    const owner = await createUser("OPERATIVO");
    const mate = await createUser("OPERATIVO");
    const inactive = await prisma.user.create({ data: { email: "inactiva@prueba.test", name: "Prueba Inactiva", isActive: false } });
    const task = await prisma.task.create({
      data: { userId: owner.id, title: "Llamar", dueDate: new Date("2026-11-01T12:00:00Z"), notifiedAt: new Date() },
    });

    loginAs(owner as any);
    expect(errorOf(await updateTaskAction(task.id, edit({ title: "  " })))).toMatch(/título/);
    expect(errorOf(await updateTaskAction(task.id, edit({ priority: "CRITICA" })))).toMatch(/prioridad/);
    expect(errorOf(await updateTaskAction(task.id, edit({ day: "2026-02-30" })))).toMatch(/fecha válida/);

    expect(await updateTaskAction(task.id, edit({ viewerIds: [mate.id, inactive.id, owner.id, "no-existe"] }))).toEqual({ success: true });
    let saved = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(saved).toMatchObject({
      title: "Visita a la familia",
      description: "Llevar la constancia",
      priority: "ALTA",
      viewerIds: mate.id,
      // Otra fecha: el aviso de la campanita vuelve a salir.
      notifiedAt: null,
    });
    expect(saved.dueDate?.toISOString()).toBe("2026-11-03T13:30:00.000Z");

    // Sin fecha y sin compartir.
    expect(await updateTaskAction(task.id, edit({ day: "", description: "", viewerIds: [] }))).toEqual({ success: true });
    saved = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(saved).toMatchObject({ dueDate: null, description: null, viewerIds: null });
  });

  it("solo la cambia quien la creó o la conducción", async () => {
    const owner = await createUser("OPERATIVO");
    const other = await createUser("DIRECTOR_AREA");
    const dg = await createUser("DIRECCION_GENERAL");
    const task = await prisma.task.create({ data: { userId: owner.id, title: "Llamar" } });

    loginAs(other as any);
    expect(errorOf(await updateTaskAction(task.id, edit()))).toMatch(/Solo quien creó/);
    loginAs(dg as any);
    expect(await updateTaskAction(task.id, edit({ title: "Llamar otra vez" }))).toEqual({ success: true });
    loginAs(null);
    expect(errorOf(await updateTaskAction(task.id, edit()))).toMatch(/sesión/);
    loginAs(owner as any);
    expect(errorOf(await updateTaskAction("no-existe", edit()))).toMatch(/ya no existe/);
  });

  it("la lista para compartir tiene a los usuarios activos menos uno mismo", async () => {
    const me = await createUser("OPERATIVO");
    const users = await getShareableUsers(me.id);
    expect(users.some((u) => u.id === me.id)).toBe(false);
    expect(users.some((u) => u.name === "Prueba Inactiva")).toBe(false);
  });
});
