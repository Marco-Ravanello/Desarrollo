import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { updateCaseLabelsAction } from "@/app/(dashboard)/cases/actions/case-actions";
import { getAllCases } from "@/services/cases";
import { getCaseLabelCounts } from "@/services/case-labels";
import { getCaseEvents } from "@/services/case-timeline";
import { getPadronQuality } from "@/services/padron-quality";
import { getPaginatedPeople } from "@/services/people";
import { createArea, createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local que se vacía en cada archivo.

describe("etiquetas de los expedientes", () => {
  it("se guardan solo las de la lista, quedan en la historia y sirven para filtrar y contar", async () => {
    const social = await createArea("Desarrollo Social (prueba)");
    const vg = await createArea("Violencia de Género (prueba)");
    const operativo = await createUser("OPERATIVO", social.id);
    const auditor = await createUser("AUDITOR");
    const person = await prisma.person.create({ data: { dni: "95000001", firstName: "Ana", lastName: "Prueba" } });
    const a = await prisma.case.create({ data: { title: "Uno", areaId: social.id, personId: person.id } });
    const b = await prisma.case.create({ data: { title: "Dos", areaId: social.id, personId: person.id, status: "CERRADO", labels: ["ADULTO_MAYOR"] } });
    const c = await prisma.case.create({ data: { title: "Tres", areaId: vg.id, personId: person.id, labels: ["ADULTO_MAYOR", "SALUD"] } });

    loginAs(auditor as any);
    expect((await updateCaseLabelsAction(a.id, ["SALUD"])).success).toBe(false);

    loginAs(operativo as any);
    // Las que no son de la lista se ignoran; el orden es el de la lista.
    const res = await updateCaseLabelsAction(a.id, ["DISCAPACIDAD", "INVENTADA", "ADULTO_MAYOR", "ADULTO_MAYOR"]);
    expect(res).toMatchObject({ success: true, labels: ["ADULTO_MAYOR", "DISCAPACIDAD"] });
    expect((await prisma.case.findUniqueOrThrow({ where: { id: a.id } })).labels).toEqual(["ADULTO_MAYOR", "DISCAPACIDAD"]);
    // Sin permiso para Violencia de Género no se pueden cambiar las de ese expediente.
    expect((await updateCaseLabelsAction(c.id, [])).success).toBe(false);

    await updateCaseLabelsAction(a.id, ["ADULTO_MAYOR", "SALUD"]);
    const events = await getCaseEvents({ id: a.id, createdAt: a.createdAt, areaName: social.name }, []);
    expect(events.filter((e) => e.kind === "ETIQUETAS").map((e) => e.detail)).toEqual([
      "Agregó: Adulto mayor, Discapacidad.",
      "Agregó: Salud. Quitó: Discapacidad.",
    ]);
    // Guardar lo mismo no agrega nada a la historia.
    await updateCaseLabelsAction(a.id, ["SALUD", "ADULTO_MAYOR"]);
    expect(await prisma.auditLog.count({ where: { action: "CASE_LABELS", entityId: a.id } })).toBe(2);

    const filtered = await getAllCases({ label: "ADULTO_MAYOR", canViewSensitive: false });
    expect(filtered.cases.map((x) => x.title).sort()).toEqual(["Dos", "Uno"]);
    expect((await getAllCases({ label: "ADULTO_MAYOR", canViewSensitive: true })).total).toBe(3);
    expect((await getAllCases({ label: "NO_EXISTE", canViewSensitive: true })).total).toBe(3 /* se ignora el filtro */);

    const counts = await getCaseLabelCounts({ canViewSensitive: false });
    expect(counts.find((x) => x.key === "ADULTO_MAYOR")).toMatchObject({ total: 2, open: 1 });
    expect(counts.find((x) => x.key === "SALUD")).toMatchObject({ total: 1, open: 1 });
    expect(counts.find((x) => x.key === "VIVIENDA")).toMatchObject({ total: 0, open: 0 });
    const all = await getCaseLabelCounts({ canViewSensitive: true });
    expect(all.find((x) => x.key === "SALUD")).toMatchObject({ total: 2, open: 2 });
    // Reportes: solo los abiertos en el período.
    const none = await getCaseLabelCounts({ canViewSensitive: true, createdFrom: new Date("2099-01-01") });
    expect(none.every((x) => x.total === 0)).toBe(true);
    expect(b.id).toBeTruthy();
  });
});

describe("calidad de datos del padrón", () => {
  it("cuenta lo que falta y lista a quiénes les falta", async () => {
    const p = (dni: string, data: Record<string, unknown>) => prisma.padronUnificado.create({ data: { dni, nombre_completo: `Prueba ${dni}`, ...data } as any });
    // Completa: dirección con altura, teléfono y punto.
    await p("96000001", { direccion: "Calle Inventada 123", telefono: "11 5555-0000", latitude: -34.6, longitude: -58.56, geo_estado: "UBICADA" });
    // Sin dirección ni teléfono ni punto.
    await p("96000002", { direccion: "  " });
    // Dirección sin altura, teléfono corto, no se encontró en el mapa.
    await p("96000003", { direccion: "Calle Inventada", telefono: "123", geo_estado: "NO_ENCONTRADA" });
    // Con altura y teléfono, falta buscarla en el mapa.
    await p("96000004", { direccion: "Otra Calle 45", telefono: "1144443333" });

    const q = await getPadronQuality();
    expect(q).toMatchObject({
      total: 4,
      completos: 1,
      sinDireccion: 1,
      sinAltura: 1,
      sinTelefono: 2,
      sinUbicar: 3,
      ubicacion: { porBuscar: 1, noEncontradas: 1, sinDireccion: 1 },
      paresDuplicados: 0,
    });

    const sinTelefono = await getPaginatedPeople({ falta: "telefono" });
    expect(sinTelefono.people.map((x) => x.dni).sort()).toEqual(["96000002", "96000003"]);
    expect((await getPaginatedPeople({ falta: "altura" })).people.map((x) => x.dni)).toEqual(["96000003"]);
    // Si a nadie le falta, la lista queda vacía (no muestra el Registro Único entero).
    await prisma.person.create({ data: { dni: "96000099", firstName: "Otra", lastName: "Prueba" } });
    await prisma.padronUnificado.update({ where: { dni: "96000002" }, data: { direccion: "Calle Inventada 9" } });
    expect((await getPaginatedPeople({ falta: "direccion" })).people).toEqual([]);
  });
});
