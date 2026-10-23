import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { getProviderOptions, resolveOrderProvider } from "@/services/providers";
import { createPurchaseOrderAction } from "@/app/(dashboard)/admin/actions/create-purchase-order";
import { getStaffAwayToday } from "@/services/hr";
import { notifyExpirations } from "@/services/expiry-notices";
import { getWarRoomData } from "@/services/war-room";
import { createArea, createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local que se vacía en cada corrida.

function form(data: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.append(k, v);
  return fd;
}

describe("proveedor de la orden de compra", () => {
  it("lista los proveedores con el último N° de proveedor usado", async () => {
    const p = await prisma.provider.create({ data: { name: "Ferretería Prueba", cuit: "20111111112" } });
    await prisma.provider.create({ data: { name: "Almacén Prueba", cuit: "20-22222222-3" } });
    await prisma.purchaseOrder.create({ data: { number: "OC-P1", amount: 10, providerCuit: "20-11111111-2", providerNumber: "111", createdAt: new Date("2026-01-01") } });
    await prisma.purchaseOrder.create({ data: { number: "OC-P2", amount: 10, providerId: p.id, providerNumber: "222", createdAt: new Date("2026-02-01") } });

    const options = await getProviderOptions();
    expect(options.map((o) => o.name)).toEqual(["Almacén Prueba", "Ferretería Prueba"]);
    expect(options[1]).toMatchObject({ cuit: "20-11111111-2", lastNumber: "222" });
    expect(options[0].lastNumber).toBeNull();
  });

  it("guarda el nombre y el CUIT del alta, y une al proveedor un CUIT escrito a mano", async () => {
    const p = await prisma.provider.create({ data: { name: "Corralón Prueba", cuit: "30-33333333-4" } });
    expect(await resolveOrderProvider({ providerId: p.id, providerName: "otro nombre", providerCuit: "1" }))
      .toEqual({ ok: true, providerId: p.id, providerName: "Corralón Prueba", providerCuit: "30-33333333-4" });
    expect(await resolveOrderProvider({ providerName: "corralon", providerCuit: "30333333334" }))
      .toMatchObject({ providerId: p.id, providerName: "Corralón Prueba" });
    expect(await resolveOrderProvider({ providerName: "Nuevo SRL", providerCuit: "27444444445" }))
      .toEqual({ ok: true, providerId: null, providerName: "Nuevo SRL", providerCuit: "27-44444444-5" });
    expect((await resolveOrderProvider({ providerId: "no-existe" })).ok).toBe(false);

    loginAs(await createUser("ADMIN_GENERAL"));
    const res = await createPurchaseOrderAction(form({ number: "OC-P3", providerId: p.id, providerName: "cualquier cosa", amount: "100", items: "[]" }));
    expect(res.success).toBe(true);
    expect(await prisma.purchaseOrder.findUniqueOrThrow({ where: { number: "OC-P3" } })).toMatchObject({
      providerId: p.id, providerName: "Corralón Prueba", providerCuit: "30-33333333-4",
    });
  });
});

describe("quién está de licencia hoy", () => {
  it("trae licencias y vacaciones vigentes, y cuenta aparte las de fecha vencida", async () => {
    const area = await createArea("Protección Social (prueba licencias)");
    const base = { contractType: "MENSUALIZADO" as const };
    await prisma.hRRecord.createMany({
      data: [
        { ...base, dni: "90000001", firstName: "Ana", lastName: "Licencia", status: "LICENCIA", statusUntil: new Date("2026-10-30T00:00:00Z"), areaId: area.id },
        { ...base, dni: "90000002", firstName: "Beto", lastName: "Vacaciones", status: "VACACIONES", statusUntil: new Date("2026-10-23T00:00:00Z") },
        { ...base, dni: "90000003", firstName: "Caro", lastName: "SinFecha", status: "LICENCIA" },
        { ...base, dni: "90000004", firstName: "Dani", lastName: "Vencida", status: "LICENCIA", statusUntil: new Date("2026-10-22T00:00:00Z") },
        { ...base, dni: "90000005", firstName: "Eli", lastName: "Activa", status: "ACTIVO" },
      ],
    });
    // 23/10 a las 23 h en Argentina (ya es 24/10 en UTC).
    const { away, expired } = await getStaffAwayToday(new Date("2026-10-24T02:00:00Z"));
    expect(away.map((p) => [p.name, p.until])).toEqual([
      ["Vacaciones, Beto", "2026-10-23"],
      ["Licencia, Ana", "2026-10-30"],
      ["SinFecha, Caro", null],
    ]);
    expect(away[1].area).toBe("Protección Social (prueba licencias)");
    expect(expired).toBe(1);
  });
});

describe("vencimientos en la campanita", () => {
  it("avisa a quien corresponde, una vez por etapa, y de nuevo cuando se renueva", async () => {
    const area = await createArea("Hábitat (prueba vencimientos)");
    const otra = await createArea("Otra (prueba vencimientos)");
    const now = new Date("2026-10-23T15:00:00Z");
    const v = await prisma.vehicle.create({ data: { plate: "VEN111", brand: "Marca", model: "Prueba", vtvExpiry: new Date("2026-10-28T00:00:00Z"), insuranceExpiry: new Date("2027-05-01T00:00:00Z") } });
    await prisma.vehicle.create({ data: { plate: "VEN222", brand: "Marca", model: "Prueba", status: "FUERA_DE_SERVICIO", vtvExpiry: new Date("2026-10-01T00:00:00Z") } });
    await prisma.agreement.create({ data: { title: "Convenio del área", areaId: area.id, endDate: new Date("2026-11-10T00:00:00Z") } });
    await prisma.agreement.create({ data: { title: "Convenio de otra área", areaId: otra.id, endDate: new Date("2026-10-01T00:00:00Z") } });
    await prisma.agreement.create({ data: { title: "Convenio ya cerrado", status: "FINALIZADO", endDate: new Date("2026-10-01T00:00:00Z") } });

    const admin = await createUser("ADMIN_GENERAL");
    expect(await notifyExpirations(admin, now)).toBe(3);
    const titles = (await prisma.notification.findMany({ where: { userId: admin.id } })).map((n) => n.title).sort();
    expect(titles).toEqual([
      "El convenio de Convenio del área termina este mes",
      "La VTV de VEN111 vence esta semana",
      "Terminó el convenio de Convenio de otra área",
    ]);
    expect(await notifyExpirations(admin, now)).toBe(0);

    const director = await createUser("DIRECTOR_AREA", area.id);
    expect(await notifyExpirations(director, now)).toBe(1);
    expect(await notifyExpirations(await createUser("OPERATIVO", area.id), now)).toBe(0);
    // Dirección General: convenios sí, flota no.
    expect(await notifyExpirations(await createUser("DIRECCION_GENERAL"), now)).toBe(2);

    // Pasa la fecha: llega el aviso de vencida. Se renueva por un año: vuelve a avisar cuando falte un mes.
    expect(await notifyExpirations(admin, new Date("2026-10-29T15:00:00Z"))).toBe(1);
    await prisma.vehicle.update({ where: { id: v.id }, data: { vtvExpiry: new Date("2027-10-28T00:00:00Z") } });
    expect(await notifyExpirations(admin, new Date("2027-10-01T15:00:00Z"))).toBeGreaterThanOrEqual(1);
    expect(await prisma.notification.count({ where: { userId: admin.id, title: "La VTV de VEN111 vence este mes" } })).toBe(1);
  });
});

describe("Sala de Situación", () => {
  it("sin permiso, no lista ni cuenta los expedientes de Violencia de Género", async () => {
    const vg = await createArea("Violencia de Género (prueba sala)");
    const social = await createArea("Protección Social (prueba sala)");
    await prisma.case.create({ data: { title: "Reservado", areaId: vg.id, priority: "URGENTE" } });
    await prisma.case.create({ data: { title: "[CONTINGENCIA TORMENTA] Asistencia", areaId: social.id, priority: "URGENTE" } });

    const sin = await getWarRoomData({ canViewSensitive: false });
    expect(sin.territorialAlerts.map((a) => a.title)).toEqual(["Asistencia"]);
    expect(sin.territorialAlerts[0]).toMatchObject({ tag: "Tormenta", priorityLabel: "Urgente" });
    expect(sin.areaStatus.some((a) => a.fullName === vg.name)).toBe(false);
    expect(sin.activeCriticalCases).toBe(1);

    const con = await getWarRoomData({ canViewSensitive: true });
    expect(con.territorialAlerts).toHaveLength(2);
    expect(con.activeCriticalCases).toBe(2);
  });
});
