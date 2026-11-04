import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { createHRRecordAction, updateHRRecordAction } from "@/app/(dashboard)/admin/actions/hr-actions";
import { createArea, createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local que se vacía en cada archivo.

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const errorOf = (r: { success: boolean; error?: string }) => (r.success ? null : r.error);

describe("nuevo agente", () => {
  it("guarda el contacto y el horario, y deja sin número a quien no lo tiene", async () => {
    const area = await createArea("Prueba RRHH");
    loginAs(await createUser("ADMIN_GENERAL"));
    const base = { lastName: "Prueba", areaId: area.id, position: "Administrativa", contractType: "MENSUALIZADO", status: "ACTIVO", fileNumber: "" };
    const a = await createHRRecordAction(
      fd({ ...base, firstName: "Uno", dni: "40111222", phone: "11 5555 0001", emergencyContactName: "Persona de prueba", schedule: "Lunes a viernes, de 8 a 14 h", birthDate: "1990-01-15" })
    );
    expect(errorOf(a)).toBeNull();
    // Al navegador vuelven solo datos simples (el sueldo es Decimal y Next no lo puede mandar).
    expect(a.success && a.data).toEqual({ id: expect.any(String), firstName: "Uno", lastName: "Prueba" });
    // Antes, dos legajos sin número chocaban (texto vacío repetido en un campo único).
    const b = await createHRRecordAction(fd({ ...base, firstName: "Dos", dni: "40111333" }));
    expect(errorOf(b)).toBeNull();

    const row = await prisma.hRRecord.findUnique({ where: { dni: "40111222" } });
    expect(row).toMatchObject({ phone: "11 5555 0001", emergencyContactName: "Persona de prueba", schedule: "Lunes a viernes, de 8 a 14 h", fileNumber: null });
    expect(row?.birthDate?.toISOString()).toBe("1990-01-15T00:00:00.000Z");

    // DNI repetido: mensaje claro, al crear y al editar.
    expect(errorOf(await createHRRecordAction(fd({ ...base, firstName: "Tres", dni: "40.111.222" })))).toContain("Ya hay un legajo con ese DNI");
    const dos = await prisma.hRRecord.findUnique({ where: { dni: "40111333" } });
    expect(errorOf(await updateHRRecordAction(dos!.id, fd({ ...base, firstName: "Dos", dni: "40111222" })))).toContain("Ya hay otro legajo");
    expect(errorOf(await updateHRRecordAction(dos!.id, fd({ ...base, firstName: "Dos", dni: "40111333", email: "dos@prueba.local" })))).toBeNull();
  });

  it("Dirección General ve Recursos Humanos pero no crea legajos", async () => {
    const area = await createArea("Prueba RRHH 2");
    loginAs(await createUser("DIRECCION_GENERAL"));
    const r = await createHRRecordAction(fd({ firstName: "X", lastName: "Y", dni: "40111444", areaId: area.id, position: "Z" }));
    expect(r.success).toBe(false);
  });
});
