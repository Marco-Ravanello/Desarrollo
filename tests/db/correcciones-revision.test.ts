import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { createPersonAction } from "@/app/(dashboard)/people/actions/create-person";
import { GET as programasGET } from "@/app/api/ficha-social/programas/route";
import { getAreaDashboardData } from "@/services/cases";
import { createArea, createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local.

function personForm(data: Record<string, string>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(data)) form.set(k, v);
  return form;
}

describe("Cargar persona con un DNI que ya existe", () => {
  beforeAll(async () => {
    loginAs(await createUser("ADMIN_GENERAL"));
    // Sin internet: la búsqueda de la dirección no encuentra nada.
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    await prisma.padronUnificado.create({
      data: {
        dni: "93000001", nombre_completo: "Prueba, Original", direccion: "Calle Inventada 1",
        telefono: "1155550001", latitude: -34.6, longitude: -58.56, barrio: "Barrio Prueba",
      },
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("avisa, ofrece su ficha y no cambia nada del padrón", async () => {
    const res = await createPersonAction(personForm({
      dni: " 93.000.001 ", firstName: "Otro", lastName: "Nombre", direccion: "Calle que no existe 99999", phone: "",
    }));
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.existingId).toBe("93000001");
    expect(res.error).toContain("Prueba, Original");

    const row = await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "93000001" } });
    expect(row).toMatchObject({
      nombre_completo: "Prueba, Original", direccion: "Calle Inventada 1", telefono: "1155550001",
      latitude: -34.6, longitude: -58.56,
    });
    expect(await prisma.person.count({ where: { dni: "93000001" } })).toBe(0);
  });

  it("también avisa si la persona ya está en el Registro Único", async () => {
    await prisma.person.create({ data: { id: "93000002", dni: "93000002", firstName: "Ya", lastName: "Cargada" } });
    const res = await createPersonAction(personForm({ dni: "93000002", firstName: "Otro", lastName: "Nombre", direccion: "Calle 2" }));
    expect(res).toMatchObject({ success: false, existingId: "93000002" });
    expect(await prisma.person.findUniqueOrThrow({ where: { id: "93000002" } })).toMatchObject({ firstName: "Ya", lastName: "Cargada" });
  });

  it("una persona nueva se carga y entra al padrón", async () => {
    const res = await createPersonAction(personForm({ dni: "93000003", firstName: "Nueva", lastName: "Prueba", direccion: "Calle 3" }));
    expect(res).toMatchObject({ success: true, id: "93000003" });
    expect(await prisma.padronUnificado.findUnique({ where: { dni: "93000003" } })).toMatchObject({ nombre_completo: "Prueba, Nueva" });
  });
});

describe("Cruces: cantidad real de personas por programa", () => {
  it("cuenta las personas del padrón de cada programa", async () => {
    loginAs(await createUser("ADMIN_GENERAL"));
    const before = (await (await programasGET()).json()) as { id: string; total_personas: number | null }[];
    const countOf = (list: typeof before, id: string) => list.find((p) => p.id === id)?.total_personas;
    const prev = countOf(before, "prog_tarjeta_alimentar") ?? 0;

    await prisma.padronUnificado.createMany({
      data: [
        { dni: "93100001", prog_tarjeta_alimentar: 1 },
        { dni: "93100002", prog_tarjeta_alimentar: 1 },
        { dni: "93100003", prog_tarjeta_alimentar: 0 },
      ] as any,
    });
    const after = (await (await programasGET()).json()) as typeof before;
    expect(countOf(after, "prog_tarjeta_alimentar")).toBe(prev + 2);
    expect(after.every((p) => typeof p.total_personas === "number")).toBe(true);
  });

  it("pide sesión iniciada", async () => {
    loginAs(null);
    expect((await programasGET()).status).toBe(401);
  });
});

describe("páginas de Áreas", () => {
  it("Protección Social y Hábitat muestran su área y no la Dirección General", async () => {
    // La Dirección General se crea primero, como en la carga inicial.
    const general = await createArea("Dirección General de Desarrollo Humano y Hábitat (prueba)");
    const social = await createArea("Dirección de Protección Social (prueba)");
    const habitat = await createArea("Dirección de Hábitat, Vivienda y Regularización Dominial (prueba)");
    const person = await prisma.person.create({ data: { dni: "93200001", firstName: "Prueba", lastName: "Áreas" } });
    await prisma.case.create({ data: { title: "Caso de la Dirección General", personId: person.id, areaId: general.id } });
    await prisma.case.create({ data: { title: "Caso de Protección Social", personId: person.id, areaId: social.id } });

    const socialPage = await getAreaDashboardData(["Protección Social", "Proteccion Social", "Social"]);
    expect(socialPage.area?.id).toBe(social.id);
    expect(socialPage.cases.map((c) => c.title)).toEqual(["Caso de Protección Social"]);

    const habitatPage = await getAreaDashboardData(["Vivienda", "Regularización", "Hábitat", "Habitat"]);
    expect(habitatPage.area?.id).toBe(habitat.id);
    expect(habitatPage.cases).toHaveLength(0);
  });
});
