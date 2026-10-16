import { beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { getMapDataAction, getMapExportAction, getMapPeopleAction } from "@/app/(dashboard)/maps/actions";
import { createUser, loginAs } from "./helpers";

// Personas inventadas, solo en la base de prueba local.
const CASEROS = { latitude: -34.6081, longitude: -58.5631 }; // al lado del centro de Caseros
const LEJOS = { latitude: -34.5700, longitude: -58.6300 };

describe("Mapa Social", () => {
  beforeAll(async () => {
    loginAs(await createUser("OPERATIVO"));
    const filas = [
      { dni: "97000001", nombre_completo: "Mapa, Ana", direccion: "Calle Prueba 100", barrio: "Caseros", ...LEJOS, programas_activos: "Envión | Tarjeta Alimentar" },
      { dni: "97000002", nombre_completo: "Mapa, Beto", direccion: "Otra Calle 200", barrio: "Villa Bosch", ...CASEROS, programas_activos: "Envión Plus" },
      // Solo tiene el barrio: su punto (de la planilla) es aproximado.
      { dni: "97000003", nombre_completo: "Mapa, Carla", direccion: "Barrio Villa Bosch", barrio: "Villa Bosch", ...LEJOS, programas_activos: "Tarjeta Alimentar" },
      { dni: "97000004", nombre_completo: "Mapa, Dani", barrio: "Caseros", programas_activos: "Envión" },
    ];
    for (const f of filas) await prisma.padronUnificado.create({ data: f });
  });

  it("cuenta a todo el padrón y a las personas ubicadas, sin tope", async () => {
    const res = await getMapDataAction({});
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.stats).toEqual({ total: 4, located: 3, approximate: 1, topBarrio: "Caseros", topProgram: "Envión" });
    // Primero las direcciones exactas, después las aproximadas.
    expect(res.data.dnis).toEqual(["97000001", "97000002", "97000003"]);
    expect(res.data.exactCount).toBe(2);
    expect(res.data.coords.slice(0, 2)).toEqual([LEJOS.latitude, LEJOS.longitude]);
  });

  it("la localidad cuenta lo escrito en la dirección y a quienes viven cerca de su centro", async () => {
    const res = await getMapDataAction({ localityId: "caseros" });
    expect(res.success && res.data.stats).toMatchObject({ total: 3, located: 2 });
    expect(res.success && res.data.dnis).toEqual(["97000001", "97000002"]);
  });

  it("el programa tiene que coincidir completo", async () => {
    const res = await getMapDataAction({ program: "Envión" });
    expect(res.success && res.data.stats).toMatchObject({ total: 2, located: 1 });
  });

  it("busca por nombre o DNI", async () => {
    const porNombre = await getMapDataAction({ query: "carla" });
    expect(porNombre.success && porNombre.data.dnis).toEqual(["97000003"]);
    expect(porNombre.success && porNombre.data.exactCount).toBe(0);
    const porDni = await getMapDataAction({ query: "97.000.002" });
    expect(porDni.success && porDni.data.dnis).toEqual(["97000002"]);
  });

  it("los datos de la persona se piden al tocar el punto", async () => {
    const res = await getMapPeopleAction(["97000001", "97000003"]);
    expect(res).toEqual({
      success: true,
      people: [
        { dni: "97000001", nombre: "Mapa, Ana", direccion: "Calle Prueba 100", barrio: "Caseros", localidad: null, telefono: null, programas: ["Envión", "Tarjeta Alimentar"], aproximada: false },
        { dni: "97000003", nombre: "Mapa, Carla", direccion: "Barrio Villa Bosch", barrio: "Villa Bosch", localidad: null, telefono: null, programas: ["Tarjeta Alimentar"], aproximada: true },
      ],
    });
  });

  it("la planilla con nombres solo la bajan los roles que pueden exportar datos personales", async () => {
    expect(await getMapExportAction({})).toEqual({ success: false, error: "Tu rol no tiene permiso para exportar datos personales." });

    const director = await createUser("DIRECTOR_AREA");
    loginAs(director);
    const res = await getMapExportAction({ localityId: "caseros" });
    expect(res.success && res.rows.map((r) => r.dni)).toEqual(["97000001", "97000002"]);
    const log = await prisma.auditLog.findFirst({ where: { action: "EXPORT_MAP_PEOPLE", userId: director.id } });
    expect(log?.details).toContain("Exportó 2 personas");
  });

  it("el relevador de emergencia y quien no inició sesión no ven el mapa", async () => {
    const denied = { success: false, error: "Tu rol no tiene acceso al Mapa Social." };
    loginAs(await createUser("RELEVADOR_EMERGENCIA"));
    expect(await getMapDataAction({})).toEqual(denied);
    expect(await getMapPeopleAction(["97000001"])).toEqual(denied);
    loginAs(null);
    expect(await getMapDataAction({})).toEqual(denied);
  });
});
