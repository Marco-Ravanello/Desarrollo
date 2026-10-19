import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { createDerivationAction, respondDerivationAction } from "@/app/(dashboard)/cases/actions/case-actions";
import { countDerivationsToAnswer, getDerivationInbox, hasPendingDerivationFor } from "@/services/derivations";
import { createArea, createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local.
describe("Derivaciones con respuesta", () => {
  let social: Awaited<ReturnType<typeof createArea>>;
  let ninez: Awaited<ReturnType<typeof createArea>>;
  let vg: Awaited<ReturnType<typeof createArea>>;
  let deSocial: Awaited<ReturnType<typeof createUser>>;
  let deNinez: Awaited<ReturnType<typeof createUser>>;
  let otroDeNinez: Awaited<ReturnType<typeof createUser>>;
  let deVg: Awaited<ReturnType<typeof createUser>>;
  let auditor: Awaited<ReturnType<typeof createUser>>;
  let conduccion: Awaited<ReturnType<typeof createUser>>;
  let personId: string;

  const nuevoCaso = async (areaId: string, title: string, status: "ABIERTO" | "EN_PROCESO" | "CERRADO" = "EN_PROCESO") =>
    prisma.case.create({ data: { title, personId, areaId, status } });

  beforeAll(async () => {
    social = await createArea("Desarrollo Social (prueba)");
    ninez = await createArea("Niñez y Familia (prueba)");
    vg = await createArea("Violencia de Género (prueba)");
    deSocial = await createUser("OPERATIVO", social.id);
    deNinez = await createUser("OPERATIVO", ninez.id);
    otroDeNinez = await createUser("DIRECTOR_AREA", ninez.id);
    deVg = await createUser("VIOLENCIA_GENERO", vg.id);
    auditor = await createUser("AUDITOR", social.id);
    conduccion = await createUser("DIRECCION_GENERAL");
    personId = (await prisma.person.create({ data: { dni: "93000001", firstName: "Persona", lastName: "Derivada" } })).id;
  });

  it("derivar deja el expediente como Derivado, en su área, y avisa al área que lo recibe", async () => {
    const caso = await nuevoCaso(social.id, "Caso para derivar", "ABIERTO");
    loginAs(deSocial);
    expect(await createDerivationAction(caso.id, ninez.id, "Corresponde a Niñez")).toEqual({ success: true });

    const c = await prisma.case.findUniqueOrThrow({ where: { id: caso.id } });
    expect(c).toMatchObject({ status: "DERIVADO", areaId: social.id });
    const d = await prisma.derivation.findFirstOrThrow({ where: { caseId: caso.id } });
    expect(d).toMatchObject({ status: "PENDIENTE", previousStatus: "ABIERTO", createdById: deSocial.id, createdByName: deSocial.name });

    const avisos = await prisma.notification.findMany({ where: { link: `/cases/${caso.id}` } });
    expect(avisos.map((n) => n.userId).sort()).toEqual([deNinez.id, otroDeNinez.id].sort());

    // No se puede derivar dos veces a la vez ni a la misma área.
    expect(await createDerivationAction(caso.id, vg.id, "Otra")).toMatchObject({ success: false });
    const otro = await nuevoCaso(social.id, "Otro caso");
    expect(await createDerivationAction(otro.id, social.id, "Misma área")).toMatchObject({ success: false });
    expect(await createDerivationAction(otro.id, ninez.id, "   ")).toMatchObject({ success: false });
  });

  it("solo responde el área que la recibe (o la conducción), y aceptar pasa el expediente a esa área", async () => {
    const caso = await nuevoCaso(social.id, "Caso a aceptar");
    loginAs(deSocial);
    await createDerivationAction(caso.id, ninez.id, "Corresponde a Niñez");
    const d = await prisma.derivation.findFirstOrThrow({ where: { caseId: caso.id } });

    loginAs(deSocial);
    expect(await respondDerivationAction(d.id, true)).toMatchObject({ success: false });
    loginAs(auditor);
    expect(await respondDerivationAction(d.id, true)).toMatchObject({ success: false });

    loginAs(deNinez);
    expect(await respondDerivationAction(d.id, true)).toEqual({ success: true });
    expect(await prisma.case.findUniqueOrThrow({ where: { id: caso.id } })).toMatchObject({ areaId: ninez.id, status: "EN_PROCESO" });
    expect(await prisma.derivation.findUniqueOrThrow({ where: { id: d.id } })).toMatchObject({
      status: "ACEPTADA",
      respondedById: deNinez.id,
    });
    const aviso = await prisma.notification.findFirstOrThrow({ where: { userId: deSocial.id, title: "Derivación aceptada" } });
    expect(aviso.link).toBe(`/cases/${caso.id}`);

    // Ya respondida: nadie más la puede responder.
    loginAs(otroDeNinez);
    expect(await respondDerivationAction(d.id, false, "tarde")).toMatchObject({ success: false });
  });

  it("rechazar pide motivo, devuelve el expediente a su estado anterior y avisa a quien derivó", async () => {
    const caso = await nuevoCaso(social.id, "Caso a rechazar", "ABIERTO");
    loginAs(deSocial);
    await createDerivationAction(caso.id, ninez.id, "Ver si corresponde");
    const d = await prisma.derivation.findFirstOrThrow({ where: { caseId: caso.id } });

    loginAs(conduccion);
    expect(await respondDerivationAction(d.id, false, "  ")).toMatchObject({ success: false });
    expect(await respondDerivationAction(d.id, false, "No es de Niñez")).toEqual({ success: true });

    expect(await prisma.case.findUniqueOrThrow({ where: { id: caso.id } })).toMatchObject({ areaId: social.id, status: "ABIERTO" });
    expect(await prisma.derivation.findUniqueOrThrow({ where: { id: d.id } })).toMatchObject({ status: "RECHAZADA", response: "No es de Niñez" });
    const aviso = await prisma.notification.findFirstOrThrow({ where: { userId: deSocial.id, title: "Derivación rechazada" } });
    expect(aviso.message).toContain("No es de Niñez");

    // Después del rechazo se puede volver a derivar.
    loginAs(deSocial);
    expect(await createDerivationAction(caso.id, vg.id, "Mejor a Violencia")).toEqual({ success: true });
  });

  it("Auditoría y expedientes cerrados no se derivan", async () => {
    const caso = await nuevoCaso(social.id, "Caso cerrado", "CERRADO");
    loginAs(deSocial);
    expect(await createDerivationAction(caso.id, ninez.id, "Motivo")).toMatchObject({ success: false });
    const abierto = await nuevoCaso(social.id, "Caso abierto");
    loginAs(auditor);
    expect(await createDerivationAction(abierto.id, ninez.id, "Motivo")).toMatchObject({ success: false });
    loginAs(null);
    expect(await createDerivationAction(abierto.id, ninez.id, "Motivo")).toMatchObject({ success: false });
  });

  it("los casos reservados de Violencia de Género solo los ve el área que tiene que decidir", async () => {
    const caso = await nuevoCaso(vg.id, "Caso reservado");
    loginAs(deSocial);
    expect(await createDerivationAction(caso.id, ninez.id, "Sin permiso")).toMatchObject({ success: false });

    loginAs(deVg);
    expect(await createDerivationAction(caso.id, ninez.id, "Acompañamiento a la familia")).toEqual({ success: true });

    expect(await hasPendingDerivationFor(deNinez, caso.id)).toBe(true);
    expect(await hasPendingDerivationFor(deSocial, caso.id)).toBe(false);

    const ninezInbox = await getDerivationInbox(deNinez);
    expect(ninezInbox.toAnswer.map((d) => d.caseTitle)).toContain("Caso reservado");
    const socialInbox = await getDerivationInbox(deSocial);
    expect([...socialInbox.sent, ...socialInbox.received, ...socialInbox.toAnswer].map((d) => d.caseTitle)).not.toContain("Caso reservado");
  });

  it("la bandeja cuenta lo que espera respuesta de cada uno", async () => {
    expect(await countDerivationsToAnswer(deNinez)).toBe(await prisma.derivation.count({ where: { toAreaId: ninez.id, status: "PENDIENTE" } }));
    expect(await countDerivationsToAnswer(deNinez)).toBeGreaterThan(0);
    expect(await countDerivationsToAnswer(auditor)).toBe(0);
    expect(await countDerivationsToAnswer(conduccion)).toBe(await prisma.derivation.count({ where: { status: "PENDIENTE" } }));

    const inbox = await getDerivationInbox(deSocial);
    expect(inbox.toAnswer).toEqual([]);
    expect(inbox.sent.length).toBeGreaterThan(0);
    expect(inbox.sent.every((d) => d.fromArea === social.name)).toBe(true);
  });
});
