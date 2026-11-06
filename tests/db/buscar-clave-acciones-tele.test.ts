import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { normalizarBusqueda } from "@/lib/search-text";
import { getPaginatedPeople } from "@/services/people";
import { idsQueCoinciden } from "@/services/search-sql";
import { clearPasswordHelpRequest, getPasswordHelpRequests, requestPasswordHelp } from "@/services/password-help";
import { getWarRoomToday } from "@/services/war-room-today";
import { createUser } from "./helpers";

// Datos inventados, solo en la base de prueba local.

describe("103: buscar sin tildes ni orden", () => {
  it("la base normaliza igual que normalizarBusqueda", async () => {
    const textos = ["Gómez, María", "PÉREZ-LÓPEZ juan", "Núñez Ñandú", "Jörg Müller", "François Çelik", "Av. San Martín 1.234", "", "  ¡Hola!  "];
    for (const t of textos) {
      const rows = await prisma.$queryRaw<{ v: string }[]>`SELECT texto_sin_tildes(${t}) AS v`;
      expect({ t, v: rows[0].v }).toEqual({ t, v: normalizarBusqueda(t) });
    }
  });

  it("guarda el texto de búsqueda del padrón y lo actualiza al cambiar", async () => {
    await prisma.padronUnificado.create({
      data: { dni: "97200001", nombre_completo: "GÓMEZ PRUEBA, MARÍA", barrio: "Caseros", localidad: "Caseros", direccion: "Av. San Martín 100" },
    });
    let row = await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "97200001" } });
    expect(row.texto_busqueda).toBe("GOMEZ PRUEBA MARIA CASEROS CASEROS AV SAN MARTIN 100");
    await prisma.padronUnificado.update({ where: { dni: "97200001" }, data: { direccion: "Calle Ñandú 5" } });
    row = await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "97200001" } });
    expect(row.texto_busqueda).toBe("GOMEZ PRUEBA MARIA CASEROS CASEROS CALLE NANDU 5");
  });

  it("el Registro Único encuentra sin tildes, en cualquier orden y por DNI", async () => {
    const find = async (query: string) => (await getPaginatedPeople({ query, limit: 50 })).people.map((p: any) => p.dni);
    expect(await find("maria gomez prueba")).toContain("97200001");
    expect(await find("GOMEZ")).toContain("97200001");
    expect(await find("nandu prueba")).toContain("97200001");
    expect(await find("97200001")).toContain("97200001");
    expect(await find("maria gomez lopez")).not.toContain("97200001");
  });

  it("las fichas del Registro Único también", async () => {
    const p = await prisma.person.create({ data: { dni: "97200002", firstName: "José Prueba", lastName: "Núñez" } });
    expect(await idsQueCoinciden(prisma, '"Person"', ["lastName", "firstName"], "jose nunez", 5)).toEqual([p.id]);
    expect(await idsQueCoinciden(prisma, '"Person"', ["lastName", "firstName"], "jose perez", 5)).toEqual([]);
  });
});

describe("106: pedir clave temporal al ingresar", () => {
  it("avisa a los Superadmin una vez por hora y solo por cuentas activas", async () => {
    const admin = await createUser("SUPERADMIN");
    const pidio = await prisma.user.create({ data: { username: "ana.prueba.clave", name: "Ana Prueba", role: "OPERATIVO" } });
    const baja = await prisma.user.create({ data: { username: "beto.prueba.baja", name: "Beto Prueba", role: "OPERATIVO", isActive: false } });
    const now = new Date();

    expect(await requestPasswordHelp("no.existe.prueba", now)).toBe(false);
    expect(await requestPasswordHelp("beto.prueba.baja", now)).toBe(false);
    expect(await requestPasswordHelp(" ANA.PRUEBA.CLAVE ", now)).toBe(true);
    // Otra vez enseguida: no vuelve a avisar.
    expect(await requestPasswordHelp("ana.prueba.clave", new Date(now.getTime() + 60_000))).toBe(false);

    const avisos = await prisma.notification.findMany({ where: { userId: admin.id } });
    expect(avisos).toHaveLength(1);
    expect(avisos[0].title).toBe("Ana Prueba pidió una clave temporal");
    expect(await prisma.notification.count({ where: { userId: { in: [pidio.id, baja.id] } } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "PASSWORD_HELP_REQUEST", entityId: pidio.id } })).toBe(1);

    const pedidos = await getPasswordHelpRequests(new Date(now.getTime() + 60_000));
    expect(pedidos.map((p) => p.id)).toEqual([pidio.id]);

    await clearPasswordHelpRequest(pidio.id);
    expect(await getPasswordHelpRequests()).toEqual([]);
    // Ya sin pedido, puede volver a pedir.
    expect(await requestPasswordHelp("ana.prueba.clave", new Date(now.getTime() + 120_000))).toBe(true);
  });
});

describe("117: lo de hoy en la tele", () => {
  it("junta vehículos, recorridas, entregas y cursos del día, y nada de otros días", async () => {
    const user = await createUser("OPERATIVO");
    const vehicle = await prisma.vehicle.create({ data: { plate: "PRU 117", brand: "Prueba", model: "Tele" } });
    const now = new Date("2026-11-06T15:00:00Z"); // viernes, 12 h en Argentina
    await prisma.vehicleReservation.createMany({
      data: [
        { vehicleId: vehicle.id, userId: user.id, startDate: new Date("2026-11-06T12:00:00Z"), endDate: new Date("2026-11-06T16:30:00Z"), status: "APROBADA" },
        { vehicleId: vehicle.id, userId: user.id, startDate: new Date("2026-11-06T20:00:00Z"), endDate: new Date("2026-11-06T21:00:00Z"), status: "PENDIENTE" },
        { vehicleId: vehicle.id, userId: user.id, startDate: new Date("2026-11-07T12:00:00Z"), endDate: new Date("2026-11-07T14:00:00Z"), status: "APROBADA" },
        { vehicleId: vehicle.id, userId: user.id, startDate: new Date("2026-11-06T13:00:00Z"), endDate: new Date("2026-11-06T14:00:00Z"), status: "RECHAZADA" },
      ],
    });
    await prisma.recorrida.createMany({
      data: [
        { barrio: "Caseros", fecha: new Date("2026-11-06T00:00:00Z") },
        { barrio: "Ciudadela", fecha: new Date("2026-11-07T00:00:00Z") },
      ],
    });
    await prisma.purchaseOrder.create({
      data: { number: "OC-PRUEBA-117", amount: 10, status: "APROBADA", providerName: "Proveedor Prueba", deliveryDate: new Date("2026-11-06T00:00:00Z") },
    });
    await prisma.curso.createMany({
      data: [
        { nombre: "Curso Prueba Viernes", horario: "Viernes de 18 a 20", fechaInicio: new Date("2026-10-01T00:00:00Z") },
        { nombre: "Curso Prueba Lunes", horario: "Lunes de 10 a 12", fechaInicio: new Date("2026-10-01T00:00:00Z") },
      ],
    });

    const { today, items } = await getWarRoomToday(now);
    expect(today).toBe("2026-11-06");
    expect(items.map((i) => `${i.kind}|${i.when}|${i.title}|${i.pending}`)).toEqual([
      "entrega|Todo el día|Entrega de la orden OC-PRUEBA-117|false",
      "recorrida|Todo el día|Recorrida por Caseros|false",
      "vehiculo|09:00 a 13:30|Prueba Tele (PRU 117)|false",
      "vehiculo|17:00 a 18:00|Prueba Tele (PRU 117)|true",
      "clase|Viernes de 18 a 20|Curso: Curso Prueba Viernes|false",
    ]);
  });
});
