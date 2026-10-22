import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { updatePersonAction } from "@/app/(dashboard)/people/actions/update-person";
import { createPersonAction } from "@/app/(dashboard)/people/actions/create-person";
import { getPersonDataChanges } from "@/services/person-data";
import { updatePurchaseOrderStatusAction } from "@/app/(dashboard)/admin/actions/update-order-status";
import { updateItemFulfillmentAction } from "@/app/(dashboard)/admin/actions/order-fulfillment";
import { createVehicleReservationAction, updateReservationStatusAction } from "@/app/(dashboard)/admin/actions/vehicle-actions";
import { rescheduleReservationAction } from "@/app/(dashboard)/admin/actions/calendar-actions";
import { createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local que se vacía en cada corrida. Georef y OpenStreetMap se simulan.

const DENTRO = { lat: -34.6011, lon: -58.5622 };
const georef: Record<string, { lat: number; lon: number }> = { "Calle Nueva 1234": DENTRO, "Calle Alta 50": DENTRO };
const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });

async function fakeFetch(input: string | URL | Request, init?: RequestInit) {
  const url = new URL(String(input instanceof Request ? input.url : input));
  if (url.hostname === "apis.datos.gob.ar" && url.pathname.endsWith("/direcciones")) {
    const body = JSON.parse(String(init?.body));
    return json({ resultados: body.direcciones.map((d: any) => ({ direcciones: georef[d.direccion] ? [{ ubicacion: georef[d.direccion] }] : [] })) });
  }
  if (url.hostname === "apis.datos.gob.ar" && url.pathname.endsWith("/ubicacion")) {
    return json({ ubicacion: { departamento: { id: "06840" } } });
  }
  if (url.hostname === "nominatim.openstreetmap.org") return json([]);
  throw new Error(`Llamada inesperada en la prueba: ${url}`);
}

function form(data: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.append(k, v);
  return fd;
}

const BASE = {
  firstName: "Ana", lastName: "Prueba", direccion: "Calle Vieja 10", barrio: "Barrio Uno", localidad: "Caseros",
  telefono: "", email: "", fechaNacimiento: "", genero: "",
};

describe('"Editar datos" corrige el padrón y deja la historia', () => {
  beforeAll(async () => {
    vi.stubGlobal("fetch", vi.fn(fakeFetch));
    await prisma.padronUnificado.create({
      data: {
        dni: "95000001", nombre_completo: "PRUEBA, ANA", direccion: "Calle Vieja 10", barrio: "Barrio Uno", localidad: "Caseros",
        fecha_nacimiento: "05/03/1980", latitude: -34.6, longitude: -58.56,
      },
    });
    await prisma.person.create({ data: { id: "95000001", dni: "95000001", firstName: "Ana", lastName: "Prueba", address: "Calle Vieja 10" } });
  });

  it("Auditoría no puede editar", async () => {
    loginAs(await createUser("AUDITOR"));
    const res = await updatePersonAction("95000001", form({ ...BASE, telefono: "1111" }));
    expect(res.success).toBe(false);
  });

  it("guarda en el padrón, en el legajo, anota los cambios y busca el punto nuevo", async () => {
    loginAs(await createUser("OPERATIVO"));
    // El nombre se deja igual: no se reescribe el formato del padrón.
    const res = await updatePersonAction(
      "95000001",
      form({ ...BASE, firstName: "ANA", lastName: "PRUEBA", direccion: "Calle Nueva 1234", telefono: "11 5555-0000", fechaNacimiento: "1980-03-05" })
    );
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.cambios.map((c) => c.campo).sort()).toEqual(["Calle y altura", "Teléfono"]);
    expect(res.ubicacion).toBe("UBICADA");

    const p = await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "95000001" } });
    expect(p.nombre_completo).toBe("PRUEBA, ANA");
    expect(p.direccion).toBe("Calle Nueva 1234");
    expect(p.telefono).toBe("11 5555-0000");
    expect(p.fecha_nacimiento).toBe("05/03/1980");
    expect(p.latitude).toBe(DENTRO.lat);
    expect(p.geo_fuente).toBe("GEOREF");

    const legajo = await prisma.person.findUniqueOrThrow({ where: { dni: "95000001" } });
    expect(legajo.phone).toBe("11 5555-0000");
    expect(legajo.address).toContain("Calle Nueva 1234");

    const historia = await getPersonDataChanges("95000001");
    expect(historia).toHaveLength(1);
    expect(historia[0].cambios).toContain("Teléfono: sin dato → 11 5555-0000");
  });

  it("si la dirección nueva no aparece, saca el punto viejo y la deja para ubicar a mano", async () => {
    loginAs(await createUser("OPERATIVO"));
    const res = await updatePersonAction("95000001", form({ ...BASE, firstName: "ANA", lastName: "PRUEBA", direccion: "Calle Inexistente 999", telefono: "11 5555-0000", fechaNacimiento: "1980-03-05" }));
    expect(res.success && res.ubicacion).toBe("NO_ENCONTRADA");
    const p = await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "95000001" } });
    expect(p.latitude).toBeNull();
    expect(p.geo_estado).toBe("NO_ENCONTRADA");
  });

  it("sin cambios no anota nada, y el DNI no se puede cambiar", async () => {
    loginAs(await createUser("OPERATIVO"));
    const before = (await getPersonDataChanges("95000001")).length;
    const res = await updatePersonAction(
      "95000001",
      form({ ...BASE, dni: "12345678", firstName: "ANA", lastName: "PRUEBA", direccion: "Calle Inexistente 999", telefono: "11 5555-0000", fechaNacimiento: "1980-03-05" })
    );
    expect(res.success && res.cambios).toEqual([]);
    expect((await getPersonDataChanges("95000001")).length).toBe(before);
    expect(await prisma.padronUnificado.count({ where: { dni: "12345678" } })).toBe(0);
  });
});

describe("Cargar persona con localidad y barrio", () => {
  beforeAll(() => {
    vi.stubGlobal("fetch", vi.fn(fakeFetch));
  });

  it("la suma al padrón con localidad, barrio y fecha, y la ubica", async () => {
    loginAs(await createUser("OPERATIVO"));
    const res = await createPersonAction(
      form({ dni: "95.000.002", firstName: "Juan", lastName: "Nuevo", direccion: "Calle Alta 50", localidad: "Villa Bosch", barrio: "Barrio Dos", fechaNacimiento: "2001-12-31", telefono: "", email: "", genero: "Masculino" })
    );
    expect(res).toMatchObject({ success: true, id: "95000002", ubicacion: "UBICADA" });
    const p = await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "95000002" } });
    expect(p).toMatchObject({ nombre_completo: "Nuevo, Juan", localidad: "Villa Bosch", barrio: "Barrio Dos", fecha_nacimiento: "31/12/2001", genero: "Masculino" });
    expect(p.latitude).toBe(DENTRO.lat);
  });

  it("pide al menos calle o barrio, y no pisa a alguien ya cargado", async () => {
    loginAs(await createUser("OPERATIVO"));
    const sinDomicilio = await createPersonAction(form({ dni: "95000003", firstName: "A", lastName: "B" }));
    expect(sinDomicilio.success).toBe(false);
    const repetida = await createPersonAction(form({ dni: "95000002", firstName: "Otro", lastName: "Nombre", barrio: "X" }));
    expect(repetida).toMatchObject({ success: false, existingId: "95000002" });
    expect((await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "95000002" } })).nombre_completo).toBe("Nuevo, Juan");
  });
});

describe("órdenes de compra: cada paso, solo quien corresponde", () => {
  let orderId = "";
  beforeEach(async () => {
    const order = await prisma.purchaseOrder.create({
      data: {
        number: `P-${Math.random().toString(36).slice(2, 8)}`, amount: 1000, status: "PENDIENTE_APROBACION",
        items: { create: [{ quantity: 10, description: "Item de prueba", unitPrice: 100, totalPrice: 1000 }] },
      },
    });
    orderId = order.id;
  });

  it("Auditoría y Dirección de Área no pueden aprobar ni rechazar", async () => {
    for (const role of ["AUDITOR", "DIRECTOR_AREA", "DIRECCION_GENERAL"] as const) {
      loginAs(await createUser(role));
      expect((await updatePurchaseOrderStatusAction(orderId, "RECHAZADA")).success).toBe(false);
      expect((await updatePurchaseOrderStatusAction(orderId, "APROBADA")).success).toBe(false);
    }
    expect((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("PENDIENTE_APROBACION");
  });

  it("Administración General aprueba; la entrega completa la pasa a Cumplida; Auditoría no registra entregas", async () => {
    loginAs(await createUser("ADMIN_GENERAL"));
    expect((await updatePurchaseOrderStatusAction(orderId, "APROBADA")).success).toBe(true);
    const item = await prisma.purchaseOrderItem.findFirstOrThrow({ where: { orderId } });

    loginAs(await createUser("AUDITOR"));
    expect((await updateItemFulfillmentAction(item.id, 10)).success).toBe(false);

    loginAs(await createUser("DIRECTOR_AREA"));
    expect((await updateItemFulfillmentAction(item.id, -1)).success).toBe(false);
    expect((await updateItemFulfillmentAction(item.id, 10)).success).toBe(true);
    expect((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("CUMPLIDA");
  });

  it("no se registran entregas de una orden sin aprobar", async () => {
    loginAs(await createUser("ADMIN_GENERAL"));
    const item = await prisma.purchaseOrderItem.findFirstOrThrow({ where: { orderId } });
    expect((await updateItemFulfillmentAction(item.id, 1)).success).toBe(false);
  });

  it("quien carga órdenes envía a firma y descarta borradores", async () => {
    loginAs(await createUser("DIRECTOR_AREA"));
    const draft = await prisma.purchaseOrder.create({ data: { number: "BORR-1", amount: 1, status: "BORRADOR" } });
    expect((await updatePurchaseOrderStatusAction(draft.id, "PENDIENTE_APROBACION")).success).toBe(true);
    const draft2 = await prisma.purchaseOrder.create({ data: { number: "BORR-2", amount: 1, status: "BORRADOR" } });
    expect((await updatePurchaseOrderStatusAction(draft2.id, "CANCELADA")).success).toBe(true);
  });
});

describe("reservas de vehículos", () => {
  const at = (h: number, day = 27) => new Date(Date.UTC(2030, 9, day, h + 3, 0, 0)); // hora argentina
  let vehicleId = "";
  let operativo: Awaited<ReturnType<typeof createUser>>;
  let otro: Awaited<ReturnType<typeof createUser>>;
  let admin: Awaited<ReturnType<typeof createUser>>;

  async function reserva(userId: string, start: Date, end: Date, status: "PENDIENTE" | "APROBADA" = "PENDIENTE") {
    return prisma.vehicleReservation.create({ data: { vehicleId, userId, startDate: start, endDate: end, status } });
  }

  beforeAll(async () => {
    vehicleId = (await prisma.vehicle.create({ data: { plate: "PRU999", brand: "Marca", model: "Prueba" } })).id;
    operativo = await createUser("OPERATIVO");
    otro = await createUser("OPERATIVO");
    admin = await createUser("ADMIN_GENERAL");
  });

  it("no se pide con la devolución antes de la salida", async () => {
    loginAs(operativo);
    const res = await createVehicleReservationAction(form({ vehicleId, startDate: "2030-10-27T12:00", endDate: "2030-10-27T10:00", reason: "x" }));
    expect(res.error).toMatch(/después de la salida/);
  });

  it("no se aprueban dos reservas que se pisan, aunque se aprueben a la vez", async () => {
    const a = await reserva(operativo.id, at(10), at(12));
    const b = await reserva(otro.id, at(11), at(13));
    loginAs(admin);
    const results = await Promise.all([updateReservationStatusAction(a.id, "APROBADA"), updateReservationStatusAction(b.id, "APROBADA")]);
    expect(results.filter((r) => r.success)).toHaveLength(1);
    expect(await prisma.vehicleReservation.count({ where: { id: { in: [a.id, b.id] }, status: "APROBADA" } })).toBe(1);
  });

  it("una de 12 a 14 no choca con una de 10 a 12", async () => {
    const c = await reserva(otro.id, at(12, 28), at(14, 28));
    await reserva(operativo.id, at(10, 28), at(12, 28), "APROBADA");
    loginAs(admin);
    expect((await updateReservationStatusAction(c.id, "APROBADA")).success).toBe(true);
  });

  it("mover en la Agenda controla el choque, y si la mueve quien la pidió vuelve a pendiente", async () => {
    await reserva(admin.id, at(9, 29), at(11, 29), "APROBADA");
    const mine = await reserva(operativo.id, at(14, 29), at(16, 29), "APROBADA");
    loginAs(operativo);
    const choque = await rescheduleReservationAction(mine.id, at(10, 29).toISOString(), at(12, 29).toISOString());
    expect(choque.success).toBe(false);
    const alReves = await rescheduleReservationAction(mine.id, at(18, 29).toISOString(), at(17, 29).toISOString());
    expect(alReves.success).toBe(false);
    const ok = await rescheduleReservationAction(mine.id, at(15, 29).toISOString(), at(17, 29).toISOString());
    expect(ok).toMatchObject({ success: true, backToPending: true });
    expect((await prisma.vehicleReservation.findUniqueOrThrow({ where: { id: mine.id } })).status).toBe("PENDIENTE");

    loginAs(otro);
    expect((await rescheduleReservationAction(mine.id, at(19, 29).toISOString(), at(20, 29).toISOString())).success).toBe(false);
  });

  it("quien la pidió la cancela; la flota registra salida y vuelta con kilómetros", async () => {
    const r1 = await reserva(operativo.id, at(10, 30), at(12, 30), "APROBADA");
    loginAs(otro);
    expect((await updateReservationStatusAction(r1.id, "CANCELADA")).error).toBeTruthy();
    loginAs(operativo);
    expect((await updateReservationStatusAction(r1.id, "EN_CURSO")).error).toBeTruthy();
    expect((await updateReservationStatusAction(r1.id, "CANCELADA", "Ya no hace falta")).success).toBe(true);

    const r2 = await reserva(operativo.id, at(14, 30), at(16, 30), "APROBADA");
    loginAs(admin);
    expect((await updateReservationStatusAction(r2.id, "EN_CURSO", undefined, 58230)).success).toBe(true);
    expect((await updateReservationStatusAction(r2.id, "FINALIZADA", undefined, 58290)).success).toBe(true);
    const fin = await prisma.vehicleReservation.findUniqueOrThrow({ where: { id: r2.id } });
    expect(fin.status).toBe("FINALIZADA");
    expect(fin.observations).toContain("Salió con 58.230 km.");
    expect(fin.observations).toContain("Volvió con 58.290 km.");
  });
});
