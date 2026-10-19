import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { addCaseInterventionAction, editCaseInterventionAction } from "@/app/(dashboard)/cases/actions/case-actions";
import { getCaseInterventions } from "@/services/interventions";
import { createArea, createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local.
describe("intervenciones con tipo y correcciones", () => {
  let autor: Awaited<ReturnType<typeof createUser>>;
  let otro: Awaited<ReturnType<typeof createUser>>;
  let auditor: Awaited<ReturnType<typeof createUser>>;
  let caseId: string;

  beforeAll(async () => {
    const area = await createArea("Desarrollo Social (prueba)");
    autor = await createUser("OPERATIVO", area.id);
    otro = await createUser("DIRECCION_GENERAL");
    auditor = await createUser("AUDITOR", area.id);
    const person = await prisma.person.create({ data: { dni: "95000001", firstName: "Persona", lastName: "Intervenida" } });
    caseId = (await prisma.case.create({ data: { title: "Caso con intervenciones", personId: person.id, areaId: area.id } })).id;
  });

  const ultima = () => prisma.intervention.findFirstOrThrow({ where: { caseId }, orderBy: { createdAt: "desc" } });

  it("se carga con su tipo y se ve quién la hizo", async () => {
    loginAs(autor);
    expect(await addCaseInterventionAction(caseId, "Visita al domicilio, se encontró a la familia.", "VISITA")).toMatchObject({ success: true });
    expect(await addCaseInterventionAction(caseId, "Texto", "CUALQUIERA")).toMatchObject({ success: false });

    const rows = await getCaseInterventions(caseId, autor.id);
    expect(rows[0]).toMatchObject({ type: "VISITA", author: autor.name, canEdit: true, editedAt: null, edits: [] });
    expect((await getCaseInterventions(caseId, otro.id))[0].canEdit).toBe(false);
  });

  it("quien la cargó la corrige el mismo día y queda guardado lo que decía antes", async () => {
    const i = await ultima();
    loginAs(autor);
    expect(await editCaseInterventionAction(i.id, "Llamada telefónica: no atendieron.", "LLAMADA")).toEqual({ success: true });

    const rows = await getCaseInterventions(caseId, autor.id);
    expect(rows[0]).toMatchObject({ description: "Llamada telefónica: no atendieron.", type: "LLAMADA" });
    expect(rows[0].editedAt).toBeTruthy();
    expect(rows[0].edits).toMatchObject([
      { previousDescription: "Visita al domicilio, se encontró a la familia.", previousType: "VISITA", editedBy: autor.name },
    ]);
    expect(await prisma.auditLog.count({ where: { action: "EDIT_INTERVENTION", entityId: caseId } })).toBe(1);

    expect(await editCaseInterventionAction(i.id, "   ", "LLAMADA")).toMatchObject({ success: false });
    expect(await editCaseInterventionAction(i.id, "Texto", "NO_EXISTE")).toMatchObject({ success: false });
  });

  it("nadie más la puede corregir, ni Auditoría", async () => {
    const i = await ultima();
    loginAs(otro);
    expect(await editCaseInterventionAction(i.id, "Cambio ajeno", "OTRA")).toMatchObject({ success: false });
    loginAs(auditor);
    expect(await editCaseInterventionAction(i.id, "Cambio ajeno", "OTRA")).toMatchObject({ success: false });
    loginAs(null);
    expect(await editCaseInterventionAction(i.id, "Cambio ajeno", "OTRA")).toMatchObject({ success: false });
    expect((await ultima()).description).toBe("Llamada telefónica: no atendieron.");
  });

  it("al día siguiente ya no se puede corregir", async () => {
    const i = await ultima();
    await prisma.intervention.update({ where: { id: i.id }, data: { createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } });
    loginAs(autor);
    expect(await editCaseInterventionAction(i.id, "Tarde", "OTRA")).toMatchObject({ success: false });
    expect((await getCaseInterventions(caseId, autor.id))[0].canEdit).toBe(false);
  });
});
