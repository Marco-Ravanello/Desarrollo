import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { GET } from "@/app/api/ficha-social/buscar/route";
import { saveStormVictimAction } from "@/app/(dashboard)/admin/actions/emergency-actions";
import { createArea, createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local.
const buscar = async (dni: string) => {
  const res = await GET(new Request(`http://localhost/api/ficha-social/buscar?dni=${encodeURIComponent(dni)}`));
  return { status: res.status, body: await res.json() };
};

describe("Ficha Social 360° con historial", () => {
  let operativo: Awaited<ReturnType<typeof createUser>>;
  let violencia: Awaited<ReturnType<typeof createUser>>;
  let relevador: Awaited<ReturnType<typeof createUser>>;

  beforeAll(async () => {
    const social = await createArea("Desarrollo Humano (prueba)");
    const vg = await createArea("Violencia de Género (prueba)");
    operativo = await createUser("OPERATIVO", social.id);
    violencia = await createUser("VIOLENCIA_GENERO", vg.id);
    relevador = await createUser("RELEVADOR_EMERGENCIA", social.id);

    await prisma.padronUnificado.create({
      data: { dni: "92000001", nombre_completo: "Persona Ficha Completa", cantidad_programas: 1, programas_activos: "Centro de Familia", prog_centro_de_familia: 1 },
    });
    const person = await prisma.person.create({ data: { dni: "92000001", firstName: "Persona", lastName: "Ficha" } });
    const caso = await prisma.case.create({ data: { title: "Acompañamiento familiar", personId: person.id, areaId: social.id, status: "EN_PROCESO" } });
    const casoVg = await prisma.case.create({ data: { title: "Caso reservado", personId: person.id, areaId: vg.id } });
    await prisma.intervention.create({ data: { caseId: caso.id, personId: person.id, userId: operativo.id, description: "Visita domiciliaria" } });
    await prisma.intervention.create({ data: { caseId: casoVg.id, personId: person.id, userId: violencia.id, description: "Entrevista reservada" } });

    loginAs(operativo);
    await saveStormVictimAction({ nombreApellido: "Persona Ficha", dni: "92000001", domicilio: "Calle de Prueba 1", requiereColchon: true, cantidadColchon: 2 });
    const record = await prisma.stormVictimRecord.findFirstOrThrow({ where: { dni: "92000001" } });
    await prisma.stormDelivery.create({ data: { recordId: record.id, colchones: 1, userName: "Depósito de prueba" } });

    // Alguien que no está en el padrón, solo con una ficha de tormenta.
    await prisma.stormVictimRecord.create({ data: { nombreApellido: "Solo Ficha", dni: "92000002", domicilio: "Calle de Prueba 2", cantidadFrazada: 3, requiereFrazada: true } });
  });

  it("muestra expedientes, intervenciones, fichas de tormenta y entregas, sin los casos de Violencia de Género", async () => {
    loginAs(operativo);
    const { body } = await buscar("92.000.001");
    expect(body.encontrado).toBe(true);
    expect(body.en_padron).toBe(true);
    expect(body.programas_activos).toEqual(["Centro de Familia", "Emergencia climática"]);

    const h = body.historial;
    const titulos = h.expedientes.map((c: any) => c.titulo);
    expect(titulos).toContain("Acompañamiento familiar");
    expect(titulos.some((t: string) => t.includes("CONTINGENCIA TORMENTA"))).toBe(true);
    expect(titulos).not.toContain("Caso reservado");
    expect(h.intervenciones.map((i: any) => i.descripcion)).toContain("Visita domiciliaria");
    expect(h.intervenciones.map((i: any) => i.descripcion)).not.toContain("Entrevista reservada");
    expect(h.intervencionesTotal).toBe(h.intervenciones.length);

    expect(h.fichasTormenta).toHaveLength(1);
    expect(h.fichasTormenta[0].pedido).toBe("2 colchones");
    expect(h.fichasTormenta[0].entregas).toMatchObject([{ elementos: "1 colchón", entregadoPor: "Depósito de prueba" }]);
    expect(h.personaId).toBeTruthy();
  });

  it("quien tiene permiso ve también los casos de Violencia de Género", async () => {
    loginAs(violencia);
    const { body } = await buscar("92000001");
    expect(body.historial.expedientes.map((c: any) => c.titulo)).toContain("Caso reservado");
    expect(body.historial.intervenciones.map((i: any) => i.descripcion)).toContain("Entrevista reservada");
  });

  it("si no está en el padrón pero tiene historial, igual se muestra la ficha", async () => {
    loginAs(operativo);
    const { body } = await buscar("92000002");
    expect(body).toMatchObject({ encontrado: true, en_padron: false, nombre_detectado: "Solo Ficha", total_programas: 0 });
    expect(body.historial.fichasTormenta[0]).toMatchObject({ pedido: "3 frazadas", entregas: [] });
  });

  it("un DNI sin nada no se encuentra", async () => {
    loginAs(operativo);
    const { body } = await buscar("92000003");
    expect(body.encontrado).toBe(false);
  });

  it("el relevador de emergencia y quien no inició sesión no pueden consultar", async () => {
    loginAs(relevador);
    expect((await buscar("92000001")).status).toBe(403);
    loginAs(null);
    expect((await buscar("92000001")).status).toBe(401);
  });
});
