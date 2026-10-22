import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { getMapDataAction, getMapLayerAction, getMapLayerItemsAction } from "@/app/(dashboard)/maps/actions";
import { createArea, createUser, loginAs } from "./helpers";
import { unpackMapData } from "@/lib/map-points";

/** Los puntos viajan como texto; para comparar se arman igual que en el navegador. */
async function puntos(filters: Parameters<typeof getMapDataAction>[0]) {
  const res = await getMapDataAction(filters);
  return res.success ? { ...res, data: unpackMapData(res.data) } : res;
}

// Personas, expedientes y fichas inventados, solo en la base de prueba local.
const CASEROS = { latitude: -34.6081, longitude: -58.5631 };
const LEJOS = { latitude: -34.57, longitude: -58.63 };

describe("Capas del Mapa Social", () => {
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    loginAs(await createUser("OPERATIVO"));
    await prisma.padronUnificado.createMany({
      data: [
        { dni: "96000001", nombre_completo: "Capa, Ana", direccion: "Calle 1", barrio: "Caseros", ...CASEROS, programas_activos: "Envión | Tarjeta Alimentar" },
        { dni: "96000002", nombre_completo: "Capa, Beto", direccion: "Calle 2", barrio: "Villa Bosch", ...LEJOS, programas_activos: "Tarjeta Alimentar" },
        { dni: "96000003", nombre_completo: "Capa, Carla", direccion: "Calle 3", barrio: "Villa Bosch", ...LEJOS, programas_activos: "Otro" },
      ],
    });
    const social = await createArea("Protección Social (prueba mapa)");
    const vg = await createArea("Violencia de Género (prueba mapa)");
    const ana = await prisma.person.create({ data: { id: "96000001", dni: "96000001", firstName: "Ana", lastName: "Capa" } });
    // No está en el padrón: se ubica con el punto de su legajo.
    const dario = await prisma.person.create({ data: { id: "96000009", dni: "96000009", firstName: "Darío", lastName: "Capa", ...LEJOS } });
    // Sin punto en ningún lado: se cuenta pero no se dibuja.
    const eva = await prisma.person.create({ data: { id: "96000010", dni: "96000010", firstName: "Eva", lastName: "Capa" } });

    ids.abierto = (await prisma.case.create({ data: { title: "Abierto Ana", personId: ana.id, areaId: social.id } })).id;
    ids.legajo = (await prisma.case.create({ data: { title: "Abierto Darío", personId: dario.id, areaId: social.id, status: "EN_PROCESO" } })).id;
    ids.sinPunto = (await prisma.case.create({ data: { title: "Sin punto", personId: eva.id, areaId: social.id } })).id;
    ids.cerrado = (await prisma.case.create({ data: { title: "Cerrado", personId: ana.id, areaId: social.id, status: "CERRADO" } })).id;
    ids.vg = (await prisma.case.create({ data: { title: "Reservado", personId: ana.id, areaId: vg.id } })).id;

    ids.ficha = (
      await prisma.stormVictimRecord.create({
        data: { nombreApellido: "Capa, Beto", dni: "96000002", domicilio: "Calle 2", barrio: "Villa Bosch", requiereColchon: true, cantidadColchon: 2 },
      })
    ).id;
    ids.fichaSinDni = (await prisma.stormVictimRecord.create({ data: { nombreApellido: "Sin DNI", domicilio: "Calle 9" } })).id;
  });

  it("compara hasta tres programas y marca a cuál pertenece cada punto", async () => {
    const res = await puntos({ programs: ["Envión", "Tarjeta Alimentar"] });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.dnis).toEqual(["96000001", "96000002"]);
    // Ana está en los dos (bits 1 y 2); Beto solo en Tarjeta Alimentar (bit 2).
    expect(res.data.programMask).toEqual([3, 2]);
    expect(res.data.stats.total).toBe(2);

    const sinProgramas = await puntos({});
    expect(sinProgramas.success && sinProgramas.data.programMask).toBeUndefined();
  });

  it("los expedientes abiertos se ubican en el padrón o en el legajo; sin permiso no aparece Violencia de Género", async () => {
    const res = await getMapLayerAction("cases", {});
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect([...res.points.ids].sort()).toEqual([ids.abierto, ids.legajo].sort());
    expect(res.points.total).toBe(3); // el de Eva cuenta, pero no tiene punto
    const i = res.points.ids.indexOf(ids.abierto);
    expect(res.points.coords.slice(i * 2, i * 2 + 2)).toEqual([CASEROS.latitude, CASEROS.longitude]);

    const detalle = await getMapLayerItemsAction("cases", [ids.abierto, ids.vg, ids.cerrado]);
    expect(detalle.success && detalle.items.map((c) => c.id)).toEqual([ids.abierto]);
  });

  it("con permiso se ven también los de Violencia de Género", async () => {
    loginAs(await createUser("VIOLENCIA_GENERO"));
    const res = await getMapLayerAction("cases", {});
    expect(res.success && res.points.ids).toContain(ids.vg);
    loginAs(await createUser("OPERATIVO"));
  });

  it("las capas respetan los filtros del mapa", async () => {
    const caseros = await getMapLayerAction("cases", { localityId: "caseros" });
    expect(caseros.success && caseros.points.ids).toEqual([ids.abierto]);
    const porNombre = await getMapLayerAction("cases", { query: "darío" });
    expect(porNombre.success && porNombre.points.ids).toEqual([ids.legajo]);
  });

  it("las fichas de emergencia se ubican por el DNI y muestran cómo va la entrega", async () => {
    const res = await getMapLayerAction("storm", {});
    expect(res.success && res.points.ids).toEqual([ids.ficha]);
    expect(res.success && res.points.total).toBe(2);
    const detalle = await getMapLayerItemsAction("storm", [ids.ficha]);
    expect(detalle.success && detalle.items[0]).toMatchObject({ nombre: "Capa, Beto", barrio: "Villa Bosch", entrega: "Pendiente de entrega" });
  });

  it("una capa que no existe o sin sesión no devuelve nada", async () => {
    expect(await getMapLayerAction("inventada" as any, {})).toEqual({ success: false, error: "Esa capa no existe." });
    loginAs(null);
    expect(await getMapLayerAction("cases", {})).toEqual({ success: false, error: "Tu rol no tiene acceso al Mapa Social." });
  });
});
