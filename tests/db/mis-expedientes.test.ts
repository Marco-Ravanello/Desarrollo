import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { getMyAssignedCases } from "@/services/cases";
import { createArea, createUser } from "./helpers";

// Expedientes inventados, solo en la base de prueba local.
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

describe("Mis expedientes a cargo (inicio)", () => {
  it("trae los abiertos del usuario, primero los más quietos", async () => {
    const area = await createArea("Área (prueba mis expedientes)");
    const yo = await createUser("OPERATIVO", area.id);
    const otro = await createUser("OPERATIVO", area.id);
    const persona = await prisma.person.create({ data: { id: "95000001", dni: "95000001", firstName: "Ana", lastName: "Prueba" } });

    const reciente = await prisma.case.create({ data: { title: "Reciente", areaId: area.id, personId: persona.id, assignedToId: yo.id, createdAt: daysAgo(50) } });
    await prisma.intervention.create({ data: { caseId: reciente.id, personId: persona.id, description: "Visita", userId: yo.id, date: daysAgo(2) } });
    await prisma.case.create({ data: { title: "Quieto", areaId: area.id, assignedToId: yo.id, createdAt: daysAgo(40) } });
    await prisma.case.create({ data: { title: "Cerrado", areaId: area.id, assignedToId: yo.id, status: "CERRADO" } });
    await prisma.case.create({ data: { title: "De otro", areaId: area.id, assignedToId: otro.id } });

    const res = await getMyAssignedCases(yo.id);
    expect(res.total).toBe(2);
    expect(res.cases.map((c) => c.title)).toEqual(["Quieto", "Reciente"]);
    expect(res.cases[0]).toMatchObject({ stale: true, quietDays: 40, titular: null, status: "Abierto" });
    expect(res.cases[1]).toMatchObject({ stale: false, quietDays: 2, titular: "Prueba, Ana" });

    expect(await getMyAssignedCases((await createUser("DIRECCION_GENERAL")).id)).toEqual({ total: 0, cases: [] });
  });
});
