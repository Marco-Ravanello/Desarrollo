import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { createPersonAction } from "@/app/(dashboard)/people/actions/create-person";
import { updatePersonAction } from "@/app/(dashboard)/people/actions/update-person";
import { previewAddressAction } from "@/app/(dashboard)/people/actions/address-preview";
import { getCaseAssignOptionsAction } from "@/app/(dashboard)/cases/actions/case-actions";
import { createArea, createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local que se vacía en cada archivo. Georef y OpenStreetMap se simulan.

const DENTRO = { lat: -34.6011, lon: -58.5622 };
const MARCADO = { lat: -34.6055, lon: -58.5701 };
const georef: Record<string, { lat: number; lon: number }> = { "Calle Encontrada 1234": DENTRO };
const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
let caido = false;

async function fakeFetch(input: string | URL | Request, init?: RequestInit) {
  if (caido) throw new TypeError("fetch failed");
  const url = new URL(String(input instanceof Request ? input.url : input));
  if (url.hostname === "apis.datos.gob.ar" && url.pathname.endsWith("/direcciones")) {
    const body = JSON.parse(String(init?.body));
    return json({ resultados: body.direcciones.map((d: any) => ({ direcciones: georef[d.direccion] ? [{ ubicacion: georef[d.direccion] }] : [] })) });
  }
  if (url.hostname === "apis.datos.gob.ar" && url.pathname.endsWith("/ubicacion")) return json({ ubicacion: { departamento: { id: "06840" } } });
  if (url.hostname === "nominatim.openstreetmap.org") return json([]);
  throw new Error(`Llamada inesperada en la prueba: ${url}`);
}

function form(data: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.append(k, v);
  return fd;
}

beforeAll(() => vi.stubGlobal("fetch", vi.fn(fakeFetch)));
afterAll(() => vi.unstubAllGlobals());

describe("ver la dirección en el mapa mientras se escribe (idea 157)", () => {
  it("encuentra, no encuentra, pide la altura y avisa si el servicio no responde", async () => {
    loginAs(await createUser("OPERATIVO"));
    expect(await previewAddressAction("Calle Encontrada 1234", "Caseros", "")).toEqual({ status: "UBICADA", ...DENTRO });
    expect(await previewAddressAction("Calle Perdida 99", "Caseros", "")).toEqual({ status: "NO_ENCONTRADA" });
    expect(await previewAddressAction("Calle sin número", "", "")).toEqual({ status: "SIN_ALTURA" });
    caido = true;
    expect(await previewAddressAction("Calle Encontrada 1234", "", "")).toEqual({ status: "SIN_SERVICIO" });
    caido = false;
  });

  it("Auditoría no busca direcciones", async () => {
    loginAs(await createUser("AUDITOR"));
    expect((await previewAddressAction("Calle Encontrada 1234", "", "")).status).toBe("SIN_SERVICIO");
  });

  it("al cargar una persona, el punto marcado a mano manda y queda en Auditoría", async () => {
    const user = await createUser("OPERATIVO");
    loginAs(user);
    const res = await createPersonAction(
      form({ dni: "95300001", firstName: "Ana", lastName: "Mapa", direccion: "Calle Perdida 99", localidad: "Caseros", barrio: "", telefono: "", email: "", fechaNacimiento: "", genero: "", punto_lat: String(MARCADO.lat), punto_lon: String(MARCADO.lon) })
    );
    expect(res).toMatchObject({ success: true, ubicacion: "UBICADA" });
    const p = await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "95300001" } });
    expect(p).toMatchObject({ latitude: MARCADO.lat, longitude: MARCADO.lon, geo_estado: "MANUAL", geo_fuente: "MANUAL" });
    expect(await prisma.auditLog.count({ where: { entityId: "95300001", action: "PADRON_GEO_UPDATE", userId: user.id } })).toBe(1);
  });

  it("un punto fuera del partido no se guarda", async () => {
    loginAs(await createUser("OPERATIVO"));
    const res = await createPersonAction(
      form({ dni: "95300002", firstName: "Juan", lastName: "Mapa", direccion: "Calle Perdida 99", localidad: "Caseros", barrio: "", telefono: "", email: "", fechaNacimiento: "", genero: "", punto_lat: "-34.6037", punto_lon: "-58.3816" })
    );
    expect(res).toMatchObject({ success: true, ubicacion: "NO_ENCONTRADA" });
    expect((await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "95300002" } })).latitude).toBeNull();
  });

  it("al editar los datos, el punto marcado corrige el que se encontró solo", async () => {
    loginAs(await createUser("OPERATIVO"));
    const base = { firstName: "Ana", lastName: "Mapa", localidad: "Caseros", barrio: "", telefono: "", email: "", fechaNacimiento: "", genero: "" };
    const res = await updatePersonAction("95300001", form({ ...base, direccion: "Calle Encontrada 1234", punto_lat: "-34.6066", punto_lon: "-58.5666" }));
    expect(res).toMatchObject({ success: true, ubicacion: "UBICADA" });
    const p = await prisma.padronUnificado.findUniqueOrThrow({ where: { dni: "95300001" } });
    expect(p).toMatchObject({ latitude: -34.6066, longitude: -58.5666, geo_fuente: "MANUAL" });
  });
});

describe("menú del botón derecho: asignar desde la lista (idea 154)", () => {
  it("solo quien puede asignar recibe la lista de profesionales del área", async () => {
    const area = await createArea("Protección Social (prueba menú)");
    const director = await createUser("DIRECTOR_AREA", area.id);
    const operativo = await createUser("OPERATIVO", area.id);
    const person = await prisma.person.create({ data: { dni: "95300010", firstName: "Titular", lastName: "Menú" } });
    const c = await prisma.case.create({ data: { title: "Caso menú", personId: person.id, areaId: area.id } });

    loginAs(operativo);
    expect((await getCaseAssignOptionsAction(c.id)).success).toBe(false);

    loginAs(director);
    const res = await getCaseAssignOptionsAction(c.id);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.options.map((o) => o.id)).toEqual(expect.arrayContaining([director.id, operativo.id]));
      expect(res.assigneeId).toBeNull();
    }
    await prisma.case.update({ where: { id: c.id }, data: { status: "CERRADO" } });
    expect((await getCaseAssignOptionsAction(c.id)).success).toBe(false);
  });
});
