import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { assignCasesAction, openCasesInAreaAction } from "@/app/(dashboard)/cases/actions/case-actions";
import { borrarFiltroAction, guardarFiltroAction } from "@/app/(dashboard)/cases/actions/filtros";
import { createArea, createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local.
describe("asignar varios, aviso de expediente abierto y filtros guardados", () => {
  let social: Awaited<ReturnType<typeof createArea>>;
  let ninez: Awaited<ReturnType<typeof createArea>>;
  let vg: Awaited<ReturnType<typeof createArea>>;
  let director: Awaited<ReturnType<typeof createUser>>;
  let operativo: Awaited<ReturnType<typeof createUser>>;
  let directorNinez: Awaited<ReturnType<typeof createUser>>;
  let ids: string[] = [];
  let cerrado: string;
  let deNinez: string;

  beforeAll(async () => {
    social = await createArea("Protección Social (prueba varios)");
    ninez = await createArea("Niñez (prueba varios)");
    vg = await createArea("Violencia de Género (prueba varios)");
    director = await createUser("DIRECTOR_AREA", social.id);
    operativo = await createUser("OPERATIVO", social.id);
    directorNinez = await createUser("DIRECTOR_AREA", ninez.id);
    const person = await prisma.person.create({ data: { dni: "93100001", firstName: "Titular", lastName: "Varios" } });
    ids = [];
    for (let i = 0; i < 3; i++) {
      ids.push((await prisma.case.create({ data: { title: `Caso ${i}`, personId: person.id, areaId: social.id } })).id);
    }
    cerrado = (await prisma.case.create({ data: { title: "Cerrado", personId: person.id, areaId: social.id, status: "CERRADO" } })).id;
    deNinez = (await prisma.case.create({ data: { title: "De niñez", personId: person.id, areaId: ninez.id } })).id;
    await prisma.case.create({ data: { title: "Reservado", personId: person.id, areaId: vg.id } });
  });

  it("quien dirige el área deja a una persona a cargo de varios juntos, con un solo aviso", async () => {
    loginAs(director);
    const res = await assignCasesAction([...ids, cerrado, deNinez], operativo.id);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.assigned).toBe(3);
      expect(res.skipped).toBe(2);
    }
    const asignados = await prisma.case.findMany({ where: { assignedToId: operativo.id } });
    expect(asignados.map((c) => c.id).sort()).toEqual([...ids].sort());
    const avisos = await prisma.notification.findMany({ where: { userId: operativo.id } });
    expect(avisos).toHaveLength(1);
    expect(avisos[0].title).toBe("Te asignaron 3 expedientes");
    const auditoria = await prisma.auditLog.count({ where: { action: "ASSIGN_CASE", entityId: { in: ids } } });
    expect(auditoria).toBe(3);
  });

  it("el director de otra área no puede asignar expedientes que no son suyos", async () => {
    loginAs(directorNinez);
    const res = await assignCasesAction(ids, directorNinez.id);
    expect(res.success).toBe(false);
  });

  it("avisa si la persona ya tiene un expediente abierto en esa área (sin mostrar los reservados)", async () => {
    loginAs(operativo);
    const enSocial = await openCasesInAreaAction("93100001", social.id);
    expect(enSocial.total).toBe(3);
    expect(enSocial.cases.map((c) => c.title)).not.toContain("Cerrado");
    const enVg = await openCasesInAreaAction("93100001", vg.id);
    expect(enVg.total).toBe(1);
    expect(enVg.cases).toHaveLength(0);
    expect((await openCasesInAreaAction("00000000", social.id)).total).toBe(0);
  });

  it("guarda, reemplaza y borra filtros de la lista, solo para quien los guarda", async () => {
    loginAs(operativo);
    const uno = await guardarFiltroAction("Urgentes", "status=ACTIVOS&priority=URGENTE&page=3");
    expect(uno.success).toBe(true);
    if (uno.success) expect(uno.filtros).toEqual([{ nombre: "Urgentes", consulta: "status=ACTIVOS&priority=URGENTE" }]);
    const vacio = await guardarFiltroAction("Nada", "page=2");
    expect(vacio.success).toBe(false);
    const dos = await guardarFiltroAction("urgentes", "priority=URGENTE");
    expect(dos.success && dos.filtros).toEqual([{ nombre: "urgentes", consulta: "priority=URGENTE" }]);
    const otro = await prisma.user.findUniqueOrThrow({ where: { id: director.id } });
    expect(otro.caseFilters).toBeNull();
    const borrado = await borrarFiltroAction("URGENTES");
    expect(borrado.success && borrado.filtros).toEqual([]);
  });
});
