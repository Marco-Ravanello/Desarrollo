import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { dismissPadronDuplicateAction, mergePadronDuplicatesAction } from "@/app/(dashboard)/people/actions/padron-duplicates-actions";
import { findPadronDuplicates } from "@/services/padron-duplicates";
import { createArea, createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local.
describe("posibles duplicados del padrón", () => {
  let admin: Awaited<ReturnType<typeof createUser>>;
  let operativo: Awaited<ReturnType<typeof createUser>>;

  const padron = (dni: string, data: Record<string, unknown> = {}) =>
    prisma.padronUnificado.create({ data: { dni, ...data } as any });

  beforeAll(async () => {
    const area = await createArea("Desarrollo Social (prueba)");
    admin = await createUser("ADMIN_GENERAL");
    operativo = await createUser("OPERATIVO", area.id);

    // DNI mal tipeado (un número) y mismo domicilio: el mismo vecino cargado dos veces.
    await padron("94000001", {
      nombre_completo: "Gómez, Ana Prueba", direccion: "Calle Inventada 123", cantidad_programas: 1,
      programas_activos: "Centro de Familia", prog_centro_de_familia: 1,
    });
    await padron("94000007", {
      nombre_completo: "ANA PRUEBA GOMEZ", direccion: "CALLE INVENTADA 123", telefono: "1155550000", fecha_nacimiento: "02/03/1980",
      latitude: -34.6, longitude: -58.56, cantidad_programas: 1, programas_activos: "Tarjeta Alimentar", prog_tarjeta_alimentar: 1,
    });
    // Homónimos sin nada más en común: no aparecen.
    await padron("94000100", { nombre_completo: "Juan Prueba Homónimo", direccion: "Calle Uno 1" });
    await padron("95999999", { nombre_completo: "JUAN PRUEBA HOMONIMO", direccion: "Calle Dos 2" });
    // Misma fecha de nacimiento: aparecen, y después se descartan.
    await padron("94000200", { nombre_completo: "Rosa Prueba Gemela", fecha_nacimiento: "10/10/2010" });
    await padron("96111111", { nombre_completo: "Rosa Prueba Gemela", fecha_nacimiento: "10/10/2010" });

    await prisma.participacionPrograma.create({ data: { dni: "94000007", programa: "Tarjeta Alimentar" } });
    const keep = await prisma.person.create({ data: { dni: "94000001", firstName: "Ana", lastName: "Gómez" } });
    const remove = await prisma.person.create({ data: { dni: "94000007", firstName: "Ana", lastName: "Gómez", phone: "1155550000" } });
    await prisma.case.create({ data: { title: "Expediente del duplicado", personId: remove.id, areaId: area.id } });
    await prisma.stormVictimRecord.create({ data: { nombreApellido: "Ana Gómez", dni: "94000007", domicilio: "Calle Inventada 123", personId: remove.id } });
    expect(keep.id).toBeTruthy();
  });

  it("encuentra los pares con un motivo además del nombre, y no los homónimos", async () => {
    const { pairs, total } = await findPadronDuplicates();
    expect(total).toBe(2);
    const ana = pairs.find((p) => p.a.dni === "94000001")!;
    expect(ana.b.dni).toBe("94000007");
    expect(ana.signals).toEqual(["DNI_PARECIDO", "MISMO_DOMICILIO"]);
    expect(ana.b.expedientes).toBe(1);
    expect(pairs.some((p) => p.a.dni === "94000100")).toBe(false);
  });

  it("solo la conducción puede unir o descartar", async () => {
    loginAs(operativo);
    expect(await mergePadronDuplicatesAction("94000001", "94000007")).toMatchObject({ success: false });
    expect(await dismissPadronDuplicateAction("94000200", "96111111")).toMatchObject({ success: false });
    loginAs(null);
    expect(await mergePadronDuplicatesAction("94000001", "94000007")).toMatchObject({ success: false });
  });

  it("descartar un par hace que no vuelva a aparecer", async () => {
    loginAs(admin);
    expect(await dismissPadronDuplicateAction("96111111", "94000200")).toEqual({ success: true });
    const { pairs } = await findPadronDuplicates();
    expect(pairs.map((p) => p.a.dni)).toEqual(["94000001"]);
  });

  it("unir deja una sola persona con todo lo de las dos, sin pisar datos", async () => {
    loginAs(admin);
    expect(await mergePadronDuplicatesAction("94000001", "94000007")).toEqual({ success: true });

    expect(await prisma.padronUnificado.findUnique({ where: { dni: "94000007" } })).toBeNull();
    const kept = await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "94000001" } });
    expect(kept).toMatchObject({
      nombre_completo: "Gómez, Ana Prueba", // no se pisa
      direccion: "Calle Inventada 123",
      telefono: "1155550000", // se completa
      fecha_nacimiento: "02/03/1980",
      latitude: -34.6,
      prog_centro_de_familia: 1,
      prog_tarjeta_alimentar: 1,
      cantidad_programas: 2,
      programas_activos: "Centro de Familia | Tarjeta Alimentar",
    });

    expect(await prisma.participacionPrograma.count({ where: { dni: "94000001" } })).toBe(1);
    expect(await prisma.person.findUnique({ where: { dni: "94000007" } })).toBeNull();
    const person = await prisma.person.findUniqueOrThrow({
      where: { dni: "94000001" },
      include: { cases: true, stormVictims: true },
    });
    expect(person.phone).toBe("1155550000");
    expect(person.cases.map((c) => c.title)).toEqual(["Expediente del duplicado"]);
    expect(person.stormVictims).toHaveLength(1);
    expect(await prisma.stormVictimRecord.count({ where: { dni: "94000001" } })).toBe(1);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "PADRON_DUPLICADO_UNIDO" } });
    expect(audit.details).toContain("94000007");
    expect((await findPadronDuplicates()).total).toBe(0);

    // Unir de nuevo el mismo par ya no se puede.
    expect(await mergePadronDuplicatesAction("94000001", "94000007")).toMatchObject({ success: false });
  });

  it("un nombre genérico repetido muchísimas veces no se compara (no traba la lista)", async () => {
    await prisma.padronUnificado.createMany({
      data: Array.from({ length: 45 }, (_, i) => ({ dni: String(99000000 + i), nombre_completo: "Sin Nombre Generico", direccion: "Calle Cuatro 4" })),
    });
    const { total, skippedNames } = await findPadronDuplicates();
    expect(skippedNames).toBe(1);
    expect(total).toBe(0);
  });

  it("si solo existe el legajo del que se une, pasa a tener el DNI que queda", async () => {
    await padron("97000001", { nombre_completo: "Luis Prueba Solo", direccion: "Calle Tres 3" });
    await padron("97000002", { nombre_completo: "Luis Prueba Solo", direccion: "Calle Tres 3" });
    const p = await prisma.person.create({ data: { dni: "97000002", firstName: "Luis", lastName: "Solo" } });
    loginAs(admin);
    expect(await mergePadronDuplicatesAction("97000001", "97000002")).toEqual({ success: true });
    expect(await prisma.person.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ dni: "97000001" });
  });
});
