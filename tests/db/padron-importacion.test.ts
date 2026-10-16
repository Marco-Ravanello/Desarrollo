import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { importPadronChunkAction, previewPadronImportAction } from "@/app/(dashboard)/people/actions/padron-import-actions";
import { createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local.
const ALIMENTAR = "prog_tarjeta_alimentar";

describe("importar personas al padrón", () => {
  beforeAll(async () => {
    loginAs(await createUser("ADMIN_GENERAL"));
    // Una persona que ya estaba en el padrón, en otro programa, con datos cargados.
    await prisma.padronUnificado.create({
      data: {
        dni: "93000001",
        nombre_completo: "Original, Persona",
        direccion: "Dirección original 1",
        telefono: null,
        cantidad_programas: 1,
        programas_activos: "Centro de Familia",
        prog_centro_de_familia: 1,
      },
    });
  });

  const planilla = [
    { row: 2, dni: "93000001", nombreCompleto: "Otro Nombre", direccion: "Otra dirección", telefono: "1144445555" },
    { row: 3, dni: "93000002", nombreCompleto: "Nueva, Persona", barrio: "Barrio de prueba", rol: "Titular" },
    { row: 4, dni: "93000003" },
  ];

  it("la revisión no guarda nada y cuenta nuevas, completadas y errores", async () => {
    const res = await previewPadronImportAction(ALIMENTAR, planilla);
    expect(res).toMatchObject({
      success: true,
      counts: { created: 1, completed: 1, joined: 2, alreadyInProgram: 0 },
      errors: [{ row: 4, message: "el DNI 93000003 no está en el padrón y la fila no trae nombre" }],
    });
    expect(await prisma.padronUnificado.count({ where: { dni: "93000002" } })).toBe(0);
  });

  it("suma a las nuevas y completa solo los datos vacíos de quien ya estaba", async () => {
    const res = await importPadronChunkAction(ALIMENTAR, planilla, "alimentar.xlsx", 1, 1);
    expect(res.success).toBe(true);

    const existente = await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "93000001" } });
    expect(existente.nombre_completo).toBe("Original, Persona");
    expect(existente.direccion).toBe("Dirección original 1");
    expect(existente.telefono).toBe("1144445555");
    expect(existente.prog_tarjeta_alimentar).toBe(1);
    expect(existente.prog_centro_de_familia).toBe(1);
    expect(existente.cantidad_programas).toBe(2);
    expect(existente.programas_activos).toBe("Centro de Familia | Tarjeta Alimentar");

    const nueva = await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "93000002" } });
    expect(nueva).toMatchObject({ nombre_completo: "Nueva, Persona", barrio: "Barrio de prueba", roles: "Titular", cantidad_programas: 1, prog_tarjeta_alimentar: 1, programas_activos: "Tarjeta Alimentar" });
    expect(await prisma.padronUnificado.count({ where: { dni: "93000003" } })).toBe(0);

    const participaciones = await prisma.participacionPrograma.findMany({ where: { programa: "Tarjeta Alimentar" }, orderBy: { dni: "asc" } });
    expect(participaciones.map((p) => p.dni)).toEqual(["93000001", "93000002"]);
    expect(participaciones[0].detalle_destacado).toMatch(/importación de planilla el \d{2}\/\d{2}\/\d{4} \(archivo alimentar\.xlsx\)/);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "PADRON_IMPORT" } });
    expect(audit.details).toContain("1 personas nuevas");
  });

  it("importar la misma planilla otra vez no duplica nada", async () => {
    const res = await importPadronChunkAction(ALIMENTAR, planilla, "alimentar.xlsx", 1, 1);
    expect(res).toMatchObject({ success: true, counts: { created: 0, joined: 0, alreadyInProgram: 2 } });
    expect((await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "93000001" } })).cantidad_programas).toBe(2);
    expect(await prisma.participacionPrograma.count({ where: { programa: "Tarjeta Alimentar" } })).toBe(2);
  });

  it("solo la conducción puede importar", async () => {
    for (const role of ["DIRECTOR_AREA", "OPERATIVO", "AUDITOR"] as const) {
      loginAs(await createUser(role));
      const res = await importPadronChunkAction(ALIMENTAR, [{ row: 2, dni: "93000009", nombreCompleto: "No, Debería" }], "x.xlsx", 1, 1);
      expect(res.success).toBe(false);
    }
    expect(await prisma.padronUnificado.count({ where: { dni: "93000009" } })).toBe(0);
  });

  it("rechaza un programa que no existe", async () => {
    loginAs(await createUser("SUPERADMIN"));
    const res = await importPadronChunkAction("prog_inventado; DROP TABLE x", planilla, "x.xlsx", 1, 1);
    expect(res).toEqual({ success: false, error: "Elegí un programa de la lista." });
  });
});
