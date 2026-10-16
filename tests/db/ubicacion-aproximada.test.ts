import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { cleanAddressForSearch } from "@/lib/geocoding";
import {
  getGeocodingStatusAction,
  listGeocodingReviewAction,
  retryAddressAction,
  setManualLocationAction,
} from "@/app/(dashboard)/maps/ubicar/actions";
import { createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local. Georef y OpenStreetMap se simulan: no encuentran nada
// salvo "Calle Encontrada 500".

const PUNTO_PLANILLA = { latitude: -34.6005, longitude: -58.572 };
const ENCONTRADA = { lat: -34.6101, lon: -58.5655 };

const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
async function fakeFetch(input: string | URL | Request, init?: RequestInit) {
  const url = new URL(String(input instanceof Request ? input.url : input));
  if (url.pathname.endsWith("/direcciones")) {
    const body = JSON.parse(String(init?.body));
    return json({ resultados: body.direcciones.map((d: any) => ({ direcciones: d.direccion === "Calle Encontrada 500" ? [{ ubicacion: ENCONTRADA }] : [] })) });
  }
  if (url.pathname.endsWith("/ubicacion")) return json({ ubicacion: { departamento: { id: "06840" } } });
  if (url.hostname === "nominatim.openstreetmap.org") return json([]);
  throw new Error(`Llamada inesperada: ${url}`);
}

const DIRECCIONES = [
  "Av. San Martín N° 2450", "Lisandro Medina 1650 Piso 3 Depto B", "Bonifacini 3200, dto. 4", "Urquiza 4500 (portón verde)",
  "Mitre 120 e/ Bolívar y Sarmiento", "Nogoyá 2100", "Casares 850", "Barrio Ejército de los Andes", "1234", "S/N", "",
  "Barrio Libertador", "Fuerte Apache Torre 5 Dpto 3", "Mz 12 Casa 4", "Barrio Derqui casa 12", "B1676 Caseros", "Calle 123456",
  "(sin datos)", "Puerta 8", "Barrio Puerta 8 tira 3", "Valentín Gómez 4800", "José Ingenieros", "11 de Septiembre 3400", "ÑANDÚ 400",
  "Barrio Puerta 8", "Bº Libertador 2", "B° Derqui casa 5", "Puerta 8.", "Puerta ocho", "Nro 123", "Mitre 1200,",
  "Boulogne Sur Mer 300", "Bo. San Martín 4", "Calle 5 N° 1234, piso 2",
];

async function padron(dni: string) {
  return prisma.padronUnificado.findUniqueOrThrow({ where: { dni } });
}

describe("puntos aproximados (la dirección solo tiene el barrio)", () => {
  beforeAll(async () => {
    vi.stubGlobal("fetch", vi.fn(fakeFetch));
    loginAs(await createUser("ADMIN_GENERAL"));
    const filas = [
      { dni: "98000001", nombre_completo: "Aprox, Ana", direccion: "Barrio Libertador", ...PUNTO_PLANILLA },
      { dni: "98000002", nombre_completo: "Aprox, Beto", direccion: "Bº Puerta 8", ...PUNTO_PLANILLA },
      { dni: "98000003", nombre_completo: "Exacta, Carla", direccion: "Calle Real 1234", ...PUNTO_PLANILLA },
      { dni: "98000004", nombre_completo: "Aprox, Dani", direccion: null, ...PUNTO_PLANILLA },
    ];
    for (const f of filas) await prisma.padronUnificado.create({ data: f });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("la base marca calle y altura con la misma regla que usa la búsqueda", async () => {
    for (const [i, direccion] of DIRECCIONES.entries()) {
      const dni = String(98100000 + i);
      await prisma.padronUnificado.create({ data: { dni, nombre_completo: "Regla, Prueba", direccion } });
      const row = await padron(dni);
      expect({ direccion, conAltura: row.direccion_con_altura }).toEqual({ direccion, conAltura: cleanAddressForSearch(direccion) !== null });
    }
    // También al cambiar la dirección.
    await prisma.padronUnificado.update({ where: { dni: "98100000" }, data: { direccion: "Barrio Libertador" } });
    expect((await padron("98100000")).direccion_con_altura).toBe(false);
    await prisma.padronUnificado.deleteMany({ where: { dni: { startsWith: "981" } } });
  });

  it("se cuentan y aparecen para revisar, sin perder el punto", async () => {
    const status = await getGeocodingStatusAction();
    expect(status.success && status.status.approximate).toBe(3);
    const res = await listGeocodingReviewAction("", 1);
    expect(res.success && res.rows.map((r) => [r.dni, r.motivo])).toEqual([
      ["98000001", "SOLO_BARRIO"],
      ["98000002", "SOLO_BARRIO"],
      ["98000004", "SOLO_BARRIO"],
    ]);
    expect((await padron("98000001")).latitude).toBe(PUNTO_PLANILLA.latitude);
  });

  it("si la dirección corregida tampoco aparece, conserva el punto y sigue para revisar", async () => {
    expect(await retryAddressAction("98000001", "Calle Inexistente 999")).toEqual({ success: true, located: false });
    expect(await padron("98000001")).toMatchObject({ direccion: "Calle Inexistente 999", ...PUNTO_PLANILLA, geo_estado: "APROXIMADA" });
    const res = await listGeocodingReviewAction("inexistente", 1);
    expect(res.success && res.rows.map((r) => r.motivo)).toEqual(["SOLO_BARRIO"]);
  });

  it("si la dirección corregida aparece, pasa a ser exacta", async () => {
    expect(await retryAddressAction("98000001", "Calle Encontrada 500")).toEqual({ success: true, located: true });
    expect(await padron("98000001")).toMatchObject({ latitude: ENCONTRADA.lat, longitude: ENCONTRADA.lon, geo_estado: "UBICADA", geo_fuente: "GEOREF" });
  });

  it("marcar el punto a mano lo saca de la lista", async () => {
    expect(await setManualLocationAction("98000002", ENCONTRADA.lat, ENCONTRADA.lon)).toEqual({ success: true });
    const res = await listGeocodingReviewAction("", 1);
    expect(res.success && res.rows.map((r) => r.dni)).toEqual(["98000004"]);
  });
});
