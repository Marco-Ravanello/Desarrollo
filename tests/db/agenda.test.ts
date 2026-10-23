import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { getAgendaTasks } from "@/services/agenda";
import { createUser } from "./helpers";

// Datos inventados, solo en la base de prueba local que se vacía en cada corrida.

describe("tareas de la Agenda", () => {
  it("manda solo las tareas propias y las compartidas, nunca las de los demás", async () => {
    const ana = await createUser("OPERATIVO");
    const beto = await createUser("OPERATIVO");
    const carla = await createUser("DIRECTOR_AREA");
    const day = new Date("2026-10-26T12:00:00.000Z");
    await prisma.task.create({ data: { userId: ana.id, title: "Propia de Ana", dueDate: day } });
    await prisma.task.create({ data: { userId: beto.id, title: "De Beto, compartida con Ana", dueDate: day, viewerIds: `${carla.id},${ana.id}` } });
    await prisma.task.create({ data: { userId: beto.id, title: "Seguimiento privado de Beto", dueDate: day } });
    await prisma.task.create({ data: { userId: ana.id, title: "Sin fecha", dueDate: null } });
    // Un id que contiene el de Ana no alcanza: tiene que estar entero en la lista.
    await prisma.task.create({ data: { userId: beto.id, title: "Con un id parecido", dueDate: day, viewerIds: `${ana.id}x` } });

    expect((await getAgendaTasks(ana.id)).map((t) => t.title).sort()).toEqual(["De Beto, compartida con Ana", "Propia de Ana"]);
    expect((await getAgendaTasks(carla.id)).map((t) => t.title)).toEqual(["De Beto, compartida con Ana"]);
    expect(await getAgendaTasks(beto.id)).toHaveLength(3);
  });
});
