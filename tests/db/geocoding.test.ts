import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  geocodeBatchAction,
  getGeocodingStatusAction,
  listGeocodingReviewAction,
  retryAddressAction,
  setManualLocationAction,
} from "@/app/(dashboard)/maps/ubicar/actions";
import { getPeopleForMap } from "@/services/people";
import { createUser, loginAs } from "./helpers";

// Datos y respuestas inventados, solo en la base de prueba local. Georef y OpenStreetMap se simulan.

const DENTRO = { lat: -34.6011, lon: -58.5622 };
const DENTRO_2 = { lat: -34.5901, lon: -58.5711 };
const DENTRO_3 = { lat: -34.6123, lon: -58.5544 };
const AFUERA = { lat: -34.6037, lon: -58.3816 }; // Obelisco

/** Lo que "conoce" Georef y lo que "conoce" OpenStreetMap en esta prueba. */
const georef: Record<string, { lat: number; lon: number }> = {
  "Calle Georef 100": DENTRO,
  "Calle Corregida 300": DENTRO_3,
};
const osm: Record<string, any[]> = {
  "Calle Osm 200, Caseros, Tres de Febrero, Buenos Aires, Argentina": [
    { lat: String(DENTRO_2.lat), lon: String(DENTRO_2.lon), address: { house_number: "200", road: "Calle Osm" } },
  ],
  // Solo encuentra la calle, sin la altura: no sirve.
  "Calle Sin Altura 400, Tres de Febrero, Buenos Aires, Argentina": [
    { lat: String(DENTRO_2.lat), lon: String(DENTRO_2.lon), address: { road: "Calle Sin Altura" } },
  ],
  // Encuentra una casa fuera del partido: no sirve.
  "Calle Lejana 500, Tres de Febrero, Buenos Aires, Argentina": [
    { lat: String(AFUERA.lat), lon: String(AFUERA.lon), address: { house_number: "500" } },
  ],
};
let serviciosCaidos = false;

const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });

async function fakeFetch(input: string | URL | Request, init?: RequestInit) {
  if (serviciosCaidos) throw new TypeError("fetch failed");
  const url = new URL(String(input instanceof Request ? input.url : input));
  if (url.hostname === "apis.datos.gob.ar" && url.pathname.endsWith("/direcciones")) {
    const body = JSON.parse(String(init?.body));
    return json({
      resultados: body.direcciones.map((d: any) => {
        const p = georef[d.direccion];
        return { direcciones: p ? [{ ubicacion: p }] : [] };
      }),
    });
  }
  if (url.hostname === "apis.datos.gob.ar" && url.pathname.endsWith("/ubicacion")) {
    const lon = Number(url.searchParams.get("lon"));
    return json({ ubicacion: { departamento: { id: lon < -58.5 ? "06840" : "02000" } } });
  }
  if (url.hostname === "nominatim.openstreetmap.org") {
    return json(osm[url.searchParams.get("q") || ""] || []);
  }
  throw new Error(`Llamada inesperada en la prueba: ${url}`);
}

async function padron(dni: string) {
  return prisma.padronUnificado.findUniqueOrThrow({ where: { dni } });
}

describe("ubicar en el mapa las direcciones del padrón", () => {
  beforeAll(async () => {
    vi.stubGlobal("fetch", vi.fn(fakeFetch));
    loginAs(await createUser("DIRECCION_GENERAL"));
    const filas = [
      { dni: "94000001", nombre_completo: "Georef, Persona", direccion: "Calle Georef N° 100" },
      { dni: "94000002", nombre_completo: "Osm, Persona", direccion: "Calle Osm 200", localidad: "Caseros" },
      { dni: "94000003", nombre_completo: "Sin Altura, Persona", direccion: "Calle Sin Altura 400" },
      { dni: "94000004", nombre_completo: "Lejana, Persona", direccion: "Calle Lejana 500" },
      { dni: "94000005", nombre_completo: "Barrio, Persona", direccion: "Barrio de prueba" },
      { dni: "94000006", nombre_completo: "Sin Direccion, Persona", direccion: null },
    ];
    for (const f of filas) await prisma.padronUnificado.create({ data: f });
    // En el Registro Único: una sin punto y otra que ya tenía uno propio.
    await prisma.person.create({ data: { dni: "94000001", firstName: "Persona", lastName: "Georef" } });
    await prisma.person.create({ data: { dni: "94000002", firstName: "Persona", lastName: "Osm", latitude: -34.6, longitude: -58.6 } });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("antes de buscar, el mapa no muestra a nadie (no inventa puntos)", async () => {
    expect(await getPeopleForMap(100)).toEqual([]);
    const res = await getGeocodingStatusAction();
    expect(res).toMatchObject({ success: true, status: { located: 0, pending: 5, withoutAddress: 1 } });
  });

  it("si Georef no responde, avisa y no marca nada", async () => {
    serviciosCaidos = true;
    const res = await geocodeBatchAction("georef");
    serviciosCaidos = false;
    expect(res).toEqual({ success: false, error: "Georef no responde. Probá de nuevo en unos minutos." });
    expect(await prisma.padronUnificado.count({ where: { geo_estado: { not: null } } })).toBe(0);
  });

  it("Georef ubica las que conoce y deja el resto para OpenStreetMap", async () => {
    const res = await geocodeBatchAction("georef");
    expect(res).toMatchObject({ success: true, result: { processed: 5, located: 1, notFound: 4 }, status: { located: 1, pending: 0, pendingOsm: 3, unusableAddress: 1 } });

    expect(await padron("94000001")).toMatchObject({ latitude: DENTRO.lat, longitude: DENTRO.lon, geo_estado: "UBICADA", geo_fuente: "GEOREF" });
    expect((await padron("94000002")).geo_estado).toBe("SIN_GEOREF");
    expect((await padron("94000005")).geo_estado).toBe("SIN_DIRECCION");
    expect((await padron("94000006")).geo_estado).toBeNull();
    // La persona del Registro Único con el mismo DNI toma el punto.
    expect(await prisma.person.findUniqueOrThrow({ where: { dni: "94000001" } })).toMatchObject({ latitude: DENTRO.lat, longitude: DENTRO.lon });
  });

  it("OpenStreetMap solo vale con la altura exacta y dentro del partido", async () => {
    const res = await geocodeBatchAction("osm");
    expect(res).toMatchObject({ success: true, result: { processed: 3, located: 1, notFound: 2 }, status: { located: 2, pendingOsm: 0, notFound: 2 } });

    expect(await padron("94000002")).toMatchObject({ latitude: DENTRO_2.lat, geo_estado: "UBICADA", geo_fuente: "OSM" });
    expect(await padron("94000003")).toMatchObject({ latitude: null, geo_estado: "NO_ENCONTRADA" });
    expect(await padron("94000004")).toMatchObject({ latitude: null, geo_estado: "NO_ENCONTRADA" });
    // Si ya tenía un punto propio en el Registro Único, no se pisa.
    expect(await prisma.person.findUniqueOrThrow({ where: { dni: "94000002" } })).toMatchObject({ latitude: -34.6, longitude: -58.6 });
  }, 15000);

  it("el mapa muestra solo a quienes tienen un punto real", async () => {
    const enMapa = await getPeopleForMap(100);
    expect(enMapa.map((p) => p.dni).sort()).toEqual(["94000001", "94000002"]);
  });

  it("la lista para revisar trae las no encontradas y las que no tienen calle y altura", async () => {
    const res = await listGeocodingReviewAction("", 1);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.total).toBe(3);
    expect(Object.fromEntries(res.rows.map((r) => [r.dni, r.motivo]))).toEqual({
      "94000003": "NO_ENCONTRADA",
      "94000004": "NO_ENCONTRADA",
      "94000005": "SIN_DIRECCION",
    });
    const busqueda = await listGeocodingReviewAction("lejana", 1);
    expect(busqueda.success && busqueda.rows.map((r) => r.dni)).toEqual(["94000004"]);
  });

  it("al corregir la dirección se vuelve a buscar y queda registrado", async () => {
    const res = await retryAddressAction("94.000.003", "Calle Corregida 300");
    expect(res).toEqual({ success: true, located: true });
    expect(await padron("94000003")).toMatchObject({ direccion: "Calle Corregida 300", latitude: DENTRO_3.lat, geo_fuente: "GEOREF" });
    const log = await prisma.auditLog.findFirst({ where: { action: "PADRON_GEO_UPDATE", entityId: "94000003" } });
    expect(log?.details).toContain("Ubicada con Georef");
  });

  it("el punto marcado a mano tiene que caer en Tres de Febrero", async () => {
    expect(await setManualLocationAction("94000004", AFUERA.lat, AFUERA.lon)).toEqual({
      success: false,
      error: "El punto marcado queda fuera de Tres de Febrero.",
    });
    expect((await padron("94000004")).latitude).toBeNull();

    expect(await setManualLocationAction("94000004", DENTRO_2.lat, DENTRO_2.lon)).toEqual({ success: true });
    expect(await padron("94000004")).toMatchObject({ latitude: DENTRO_2.lat, geo_estado: "MANUAL", geo_fuente: "MANUAL" });
  });

  it("solo la conducción puede ubicar direcciones", async () => {
    for (const role of ["OPERATIVO", "DIRECTOR_AREA", "AUDITOR"] as const) {
      loginAs(await createUser(role));
      const denied = { success: false, error: "Tu rol no tiene permiso para ubicar direcciones en el mapa." };
      expect(await geocodeBatchAction("georef")).toEqual(denied);
      expect(await listGeocodingReviewAction("", 1)).toEqual(denied);
      expect(await retryAddressAction("94000005", "Calle Georef 100")).toEqual(denied);
      expect(await setManualLocationAction("94000005", DENTRO.lat, DENTRO.lon)).toEqual(denied);
    }
    expect((await padron("94000005")).latitude).toBeNull();
  });
});
