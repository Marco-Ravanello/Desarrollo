import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { getPersonById, getRegistroFamilyMembers } from "@/services/people";

// Datos inventados, solo en la base de prueba local.

describe("Ficha única de la persona", () => {
  it("abre por DNI a quien está solo en el Registro Único", async () => {
    const p = await prisma.person.create({ data: { dni: "94000001", firstName: "Solo", lastName: "Registro" } });
    const found: any = await getPersonById("94000001");
    expect(found?.id).toBe(p.id);
    expect((await getPersonById(p.id) as any)?.dni).toBe("94000001");
  });

  it("no repite el barrio en la dirección del padrón", async () => {
    await prisma.padronUnificado.create({
      data: { dni: "94000002", nombre_completo: "Prueba, Barrio", direccion: "Barrio Las Prueba", barrio: "Las Prueba" },
    });
    const found: any = await getPersonById("94000002");
    expect(found.address).toBe("Barrio Las Prueba");
  });

  it("lista el grupo familiar del Registro Único sin la persona misma", async () => {
    const family = await prisma.family.create({ data: { name: "Grupo de prueba" } });
    await prisma.person.create({ data: { dni: "94000003", firstName: "Titular", lastName: "Prueba", familyId: family.id } });
    await prisma.person.create({ data: { dni: "94000004", firstName: "Hija", lastName: "Prueba", familyId: family.id } });
    const members = await getRegistroFamilyMembers("94000003");
    expect(members.map((m) => m.dni)).toEqual(["94000004"]);
    expect(await getRegistroFamilyMembers("94000001")).toEqual([]);
  });
});
