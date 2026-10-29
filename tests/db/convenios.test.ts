import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { createAgreementAction } from "@/app/(dashboard)/admin/actions/agreement-actions";
import { createArea, createUser, loginAs } from "./helpers";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

// Datos inventados, solo en la base de prueba local.
describe("cargar un convenio", () => {
  let area: Awaited<ReturnType<typeof createArea>>;

  beforeAll(async () => {
    area = await createArea("Promoción Social (prueba convenios)");
  });

  it("un director de área no puede cargar convenios", async () => {
    loginAs(await createUser("DIRECTOR_AREA", area.id));
    const res = await createAgreementAction(form({ title: "Convenio X", parties: "Municipio y Club" }));
    expect(res).toMatchObject({ success: false, error: expect.stringMatching(/Administración General/) });
  });

  it("dice exactamente qué falta", async () => {
    loginAs(await createUser("ADMIN_GENERAL"));
    expect(await createAgreementAction(form({ title: " ", parties: "Municipio y Club" }))).toMatchObject({
      success: false,
      error: expect.stringMatching(/título/),
    });
    expect(await createAgreementAction(form({ title: "Convenio X", parties: "" }))).toMatchObject({
      success: false,
      error: expect.stringMatching(/con quién se firma/),
    });
    expect(
      await createAgreementAction(
        form({ title: "Convenio X", parties: "Municipio y Club", startDate: "2026-05-01", endDate: "2026-04-01" }),
      ),
    ).toMatchObject({ success: false, error: expect.stringMatching(/anterior/) });
    expect(
      await createAgreementAction(form({ title: "Convenio X", parties: "Municipio y Club", areaId: "no-existe" })),
    ).toMatchObject({ success: false, error: expect.stringMatching(/ya no existe/) });
  });

  it("sin número se guarda vacío y se pueden cargar varios así", async () => {
    loginAs(await createUser("DIRECCION_GENERAL"));
    const a = await createAgreementAction(form({ title: "Sin número 1", parties: "Municipio y Escuela", number: "" }));
    const b = await createAgreementAction(form({ title: "Sin número 2", parties: "Municipio y Escuela", number: "" }));
    expect(a.success && b.success).toBe(true);
    if (!a.success) return;
    expect((await prisma.agreement.findUniqueOrThrow({ where: { id: a.id } })).number).toBeNull();
  });

  it("guarda el estado elegido, el área y las fechas como día", async () => {
    loginAs(await createUser("SUPERADMIN"));
    const res = await createAgreementAction(
      form({
        title: "Convenio con la Asociación",
        parties: "Municipio y Asociación Civil",
        number: "CONV-PRUEBA-1",
        amount: "150000",
        areaId: area.id,
        startDate: "2026-03-01",
        endDate: "2026-12-31",
        status: "EN_REVISION",
      }),
    );
    expect(res.success).toBe(true);
    if (!res.success) return;
    const saved = await prisma.agreement.findUniqueOrThrow({ where: { id: res.id } });
    expect(saved.status).toBe("EN_REVISION");
    expect(saved.areaId).toBe(area.id);
    expect(saved.startDate?.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(saved.endDate?.toISOString()).toBe("2026-12-31T00:00:00.000Z");
    expect(await prisma.auditLog.count({ where: { entity: "Agreement", entityId: res.id, action: "CREATE" } })).toBe(1);

    const repetido = await createAgreementAction(
      form({ title: "Otro", parties: "Municipio y Otro", number: "CONV-PRUEBA-1" }),
    );
    expect(repetido).toMatchObject({ success: false, error: expect.stringMatching(/Ya hay un convenio/) });
  });

  it("no acepta un estado inicial que no sea vigente o en revisión", async () => {
    loginAs(await createUser("SUPERADMIN"));
    const res = await createAgreementAction(form({ title: "Convenio Y", parties: "Municipio y Club", status: "VENCIDO" }));
    expect(res.success).toBe(false);
  });
});
