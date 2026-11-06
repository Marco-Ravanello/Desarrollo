import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { bulkEnroll, bulkWithdraw, previewBulkEnroll } from "@/services/program-bulk";
import { clearPersonStatus, getPersonStatus, markPersonStatus } from "@/services/person-status";
import { listExpiringDocuments, setDocumentExpiry } from "@/services/document-expiry";
import { notifyExpirations } from "@/services/expiry-notices";
import { addDays, todayInArgentina } from "@/lib/follow-up-dates";
import { createArea, createUser } from "./helpers";

// Datos inventados, solo en la base de prueba local que se vacía en cada archivo.

const TA = "prog_tarjeta_alimentar";
const ENV = "prog_envion";
const padron = (dni: string, nombre: string, extra: Record<string, unknown> = {}) =>
  prisma.padronUnificado.create({ data: { dni, nombre_completo: nombre, cantidad_programas: 0, ...extra } as any });

describe("altas y bajas de varias personas juntas", () => {
  it("da las altas que se pueden y dice por qué no las otras", async () => {
    const operativo = await createUser("OPERATIVO");
    const auditor = await createUser("AUDITOR");
    await padron("97200001", "PRUEBA ANA");
    await padron("97200002", "PRUEBA BETO", { prog_tarjeta_alimentar: 1, programas_activos: "Tarjeta Alimentar", cantidad_programas: 1 });
    await padron("97200003", "PRUEBA CARLA");

    expect((await bulkEnroll(auditor, { column: TA, dnis: ["97200001"] })).success).toBe(false);

    const preview = await previewBulkEnroll(operativo, TA, "97.200.001\n97200002, 97200009 hola");
    expect(preview.success && preview.rows.map((r) => r.estado)).toEqual(["ok", "ya-esta", "no-encontrada"]);
    expect(preview.success && preview.invalid).toEqual(["hola"]);

    const res = await bulkEnroll(operativo, { column: TA, dnis: ["97200001", "97200002", "97200003", "97200001"], day: "2026-10-01", note: "Operativo" });
    expect(res.success && res.done).toBe(2);
    expect(res.success && res.skipped.map((s) => [s.dni, s.nombre])).toEqual([["97200002", "Prueba Beto"]]);
    const rows = await prisma.padronUnificado.findMany({ where: { dni: { in: ["97200001", "97200003"] } }, select: { prog_tarjeta_alimentar: true } });
    expect(rows.every((r) => r.prog_tarjeta_alimentar === 1)).toBe(true);
    expect(await prisma.padronMovimiento.count({ where: { tipo: "ALTA", programa: TA } })).toBe(2);

    // Las bajas piden motivo, con la misma fecha para todas.
    expect((await bulkWithdraw(operativo, { column: TA, dnis: ["97200001"], reason: " " })).success).toBe(false);
    const bajas = await bulkWithdraw(operativo, { column: TA, dnis: ["97200001", "97200003", "97200009"], day: "2026-10-15", reason: "Terminó el ciclo" });
    expect(bajas.success && bajas.done).toBe(2);
    expect(bajas.success && bajas.skipped.map((s) => s.dni)).toEqual(["97200009"]);
    const movs = await prisma.padronMovimiento.findMany({ where: { tipo: "BAJA" }, select: { motivo: true, fecha: true } });
    expect(movs.map((m) => [m.motivo, m.fecha.toISOString().slice(0, 10)])).toEqual([["Terminó el ciclo", "2026-10-15"], ["Terminó el ciclo", "2026-10-15"]]);
  });

  it("respeta el área a cargo del programa", async () => {
    const area = await createArea("Niñez prueba");
    const otra = await createArea("Otra prueba");
    await prisma.programaArea.create({ data: { programa: ENV, areaId: area.id } });
    const deOtra = await createUser("OPERATIVO", otra.id);
    await padron("97200010", "PRUEBA DIEGO");
    const res = await bulkEnroll(deOtra, { column: ENV, dnis: ["97200010"] });
    expect(res.success).toBe(false);
  });
});

describe("falleció o se mudó", () => {
  it("sale de los programas y de las recorridas pendientes, y no se le puede dar el alta", async () => {
    const operativo = await createUser("OPERATIVO");
    const otro = await createUser("OPERATIVO");
    await padron("97200020", "PRUEBA ELENA");
    await bulkEnroll(operativo, { column: "prog_centro_de_familia", dnis: ["97200020"], day: "2026-09-01" });
    await bulkEnroll(operativo, { column: TA, dnis: ["97200020"], day: "2026-09-01" });

    const planificada = await prisma.recorrida.create({ data: { barrio: "Ciudadela", fecha: new Date(`${addDays(todayInArgentina(), 3)}T00:00:00Z`) } });
    const hecha = await prisma.recorrida.create({ data: { barrio: "Ciudadela", fecha: new Date("2026-10-01T00:00:00Z"), estado: "HECHA" } });
    await prisma.recorridaVisita.createMany({
      data: [
        { recorridaId: planificada.id, dni: "97200020" },
        { recorridaId: hecha.id, dni: "97200020", resultado: "VISITADA" },
      ],
    });

    expect((await markPersonStatus(operativo, { dni: "97200020", estado: "OTRA" })).success).toBe(false);
    const res = await markPersonStatus(operativo, { dni: "97200020", estado: "FALLECIDA", day: "2026-11-01", note: "Avisó la familia" });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.programas.sort()).toEqual(["Centro de Familia", "Tarjeta Alimentar"]);
    expect(res.visitas).toBe(1);

    const row = await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "97200020" } });
    expect(row.prog_tarjeta_alimentar).toBe(0);
    expect(row.prog_centro_de_familia).toBe(0);
    const bajas = await prisma.padronMovimiento.findMany({ where: { dni: "97200020", tipo: "BAJA" }, select: { motivo: true, fecha: true } });
    expect(bajas.every((b) => b.motivo === "Falleció. Avisó la familia" && b.fecha.toISOString().startsWith("2026-11-01"))).toBe(true);
    // La visita que ya se hizo queda.
    expect(await prisma.recorridaVisita.count({ where: { dni: "97200020" } })).toBe(1);

    const status = await getPersonStatus("97200020");
    expect(status?.texto).toBe("Falleció el 01/11/2026");

    const again = await bulkEnroll(operativo, { column: TA, dnis: ["97200020"] });
    expect(again.success && again.skipped[0].reason).toMatch(/falleció/);
    const preview = await previewBulkEnroll(operativo, TA, "97200020");
    expect(preview.success && preview.rows[0].estado).toBe("marcada");

    // La saca quien la puso (o la conducción); las bajas quedan.
    expect((await clearPersonStatus(otro, "97200020")).success).toBe(false);
    expect((await clearPersonStatus(operativo, "97200020")).success).toBe(true);
    expect(await getPersonStatus("97200020")).toBeNull();
    expect((await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "97200020" } })).prog_tarjeta_alimentar).toBe(0);
  });
});

describe("documentos que vencen", () => {
  it("lista los que vencen, avisa a quien los cargó y deja cambiar la fecha", async () => {
    const operativo = await createUser("OPERATIVO");
    const auditor = await createUser("AUDITOR");
    const today = todayInArgentina();
    const ana = await prisma.person.create({ data: { dni: "97200030", firstName: "Ana", lastName: "Prueba" } });
    const beto = await prisma.person.create({ data: { dni: "97200031", firstName: "Beto", lastName: "Prueba" } });
    const at = (d: string) => new Date(`${d}T00:00:00.000Z`);
    const cud = await prisma.document.create({ data: { name: "CUD", kind: "CUD", personId: ana.id, expiresAt: at(addDays(today, 10)), uploadedById: operativo.id } });
    await prisma.document.create({ data: { name: "dni.pdf", url: "/x", kind: "DNI", personId: ana.id, expiresAt: at(addDays(today, -20)), uploadedById: operativo.id } });
    await prisma.document.create({ data: { name: "CUD", kind: "CUD", personId: beto.id, expiresAt: at(addDays(today, 5)), uploadedById: operativo.id } });
    await prisma.document.create({ data: { name: "lejos", kind: "OTRO", personId: ana.id, expiresAt: at(addDays(today, 200)) } });

    // Beto se mudó: sus documentos ya no aparecen.
    await prisma.personaEstado.create({ data: { dni: "97200031", estado: "MUDADA" } });

    const list = await listExpiringDocuments("OPERATIVO", "por-vencer", today);
    expect(list.docs.map((d) => [d.persona, d.kind, d.hasFile])).toEqual([["Prueba, Ana", "CUD", false]]);
    expect([list.porVencer, list.vencidos]).toEqual([1, 1]);

    const sent = await notifyExpirations({ id: operativo.id, role: "OPERATIVO" });
    expect(sent).toBe(2);
    const notes = await prisma.notification.findMany({ where: { userId: operativo.id }, orderBy: { title: "asc" } });
    expect(notes.map((n) => n.title)).toEqual(["El CUD de Prueba, Ana vence este mes", "Venció el DNI de Prueba, Ana"]);
    expect(notes.find((n) => n.title.includes("CUD"))?.link).toBe(`/people/97200030?tab=documentos&doc=${cud.id}`);
    // No se repiten.
    expect(await notifyExpirations({ id: operativo.id, role: "OPERATIVO" })).toBe(0);

    expect((await setDocumentExpiry(auditor, cud.id, { kind: "CUD", day: "2030-01-01" })).success).toBe(false);
    expect(await setDocumentExpiry(operativo, cud.id, { kind: "CUD", day: "2030-01-01" })).toEqual({ success: true, dni: "97200030" });
    expect((await prisma.document.findUniqueOrThrow({ where: { id: cud.id } })).expiresAt?.toISOString().slice(0, 10)).toBe("2030-01-01");
    expect(await prisma.auditLog.count({ where: { action: "DOCUMENT_VENCIMIENTO", entityId: cud.id } })).toBe(1);
    expect((await listExpiringDocuments("OPERATIVO", "por-vencer", today)).porVencer).toBe(0);
  });
});
