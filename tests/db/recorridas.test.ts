import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
  addVisitaAction, createRecorridaAction, deleteRecorridaAction, saveLugarAction, saveVisitaAction, setReferenteAction,
  terminarRecorridaAction, updateRecorridaAction,
} from "@/app/(dashboard)/barrios/actions";
import { getBarrioMapData } from "@/services/barrios";
import {
  buildRecorridaList, getBarrioRecorridas, getPersonVisits, getRecorrida, getRecorridaStatsByBarrio, getReferentes,
} from "@/services/recorridas";
import { parseRecorridaCriteria } from "@/lib/recorridas";
import { createArea, createUser, loginAs } from "./helpers";

// Datos inventados, solo en la base de prueba local que se vacía en cada archivo.

const errorOf = (r: { success: boolean; error?: string }) => (r.success ? null : r.error);
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const criteria = (q: string) => parseRecorridaCriteria(Object.fromEntries(groupParams(new URLSearchParams(q))));
function groupParams(p: URLSearchParams) {
  const out = new Map<string, string[]>();
  p.forEach((v, k) => out.set(k, [...(out.get(k) ?? []), v]));
  return [...out.entries()].map(([k, v]) => [k, v.length === 1 ? v[0] : v]);
}

// Georef de mentira: encuentra solo la dirección de la escuela.
const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
async function fakeFetch(input: string | URL | Request, init?: RequestInit) {
  const url = new URL(String(input instanceof Request ? input.url : input));
  if (url.hostname === "apis.datos.gob.ar" && url.pathname.endsWith("/direcciones")) {
    const body = JSON.parse(String(init?.body));
    return json({
      resultados: body.direcciones.map((d: any) => ({ direcciones: d.direccion === "Mitre 500" ? [{ ubicacion: { lat: -34.6, lon: -58.56 } }] : [] })),
    });
  }
  if (url.hostname === "nominatim.openstreetmap.org") return json([]);
  throw new Error(`Llamada inesperada en la prueba: ${url}`);
}

let social: { id: string };
let vg: { id: string };
let operativo: any;
let otro: any;
let auditor: any;
let dg: any;

beforeAll(() => {
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("recorridas por un barrio", () => {
  beforeAll(async () => {
    social = await createArea("Prueba Social");
    vg = await createArea("Prueba Violencia de Género");
    operativo = await createUser("OPERATIVO", social.id);
    otro = await createUser("OPERATIVO", social.id);
    auditor = await createUser("AUDITOR");
    dg = await createUser("DIRECCION_GENERAL");

    await prisma.padronUnificado.createMany({
      data: [
        { dni: "97400001", nombre_completo: "Recorrida, Ana", barrio: "Evita", direccion: "Mitre 110", telefono: "11 5555-0001", latitude: -34.6, longitude: -58.56, direccion_con_altura: true, geo_estado: "UBICADA", geo_fuente: "GEOREF" },
        { dni: "97400002", nombre_completo: "Recorrida, Beto", barrio: "Evita", direccion: "Alsina 300", latitude: -34.601, longitude: -58.561, geo_estado: "APROXIMADA" },
        { dni: "97400003", nombre_completo: "Recorrida, Ceci", barrio: "Evita", direccion: "Mitre 105", cantidad_programas: 1, prog_tarjeta_alimentar: 1 },
        { dni: "97400004", nombre_completo: "Recorrida, Dani", barrio: "Evita", direccion: "Mitre 102", telefono: "11 5555-0004" },
        { dni: "97400005", nombre_completo: "Recorrida, Eli", barrio: "Caseros", direccion: "Mitre 1" },
      ],
    });
    const person = (dni: string, firstName: string) => prisma.person.create({ data: { dni, firstName, lastName: "Recorrida" } });
    const [ana, beto, ceci, eli] = await Promise.all([person("97400001", "Ana"), person("97400002", "Beto"), person("97400003", "Ceci"), person("97400005", "Eli")]);
    // Ana: expediente quieto hace 45 días. Beto: urgente reciente. Ceci: solo uno de Violencia de Género (nunca entra).
    const quieto = await prisma.case.create({ data: { personId: ana.id, areaId: social.id, title: "Caso quieto", createdAt: daysAgo(60) } });
    await prisma.intervention.create({ data: { caseId: quieto.id, personId: ana.id, userId: operativo.id, description: "Visita", date: daysAgo(45) } });
    const urgente = await prisma.case.create({ data: { personId: beto.id, areaId: social.id, title: "Caso urgente", priority: "URGENTE" } });
    await prisma.case.create({ data: { personId: ceci.id, areaId: vg.id, title: "Caso reservado", priority: "URGENTE", createdAt: daysAgo(90) } });
    await prisma.case.create({ data: { personId: eli.id, areaId: social.id, title: "Otro barrio", createdAt: daysAgo(90) } });
    // Seguimiento vencido del expediente de Beto.
    await prisma.task.create({ data: { userId: operativo.id, title: "Volver a ver", caseId: urgente.id, dueDate: daysAgo(2) } });
    // Ficha de tormenta sin entrega de Dani.
    await prisma.stormVictimRecord.create({ data: { nombreApellido: "Recorrida, Dani", dni: "97400004", domicilio: "Mitre 102", barrio: "Evita" } });
  });

  it("arma la lista por motivos, ordenada por calle, sin Violencia de Género", async () => {
    const list = await buildRecorridaList("Evita", criteria("motivo=quietos&motivo=urgentes&motivo=seguimientos&motivo=tormenta"));
    expect(list.people.map((p) => p.dni)).toEqual(["97400002", "97400004", "97400001"]);
    const byDni = Object.fromEntries(list.people.map((p) => [p.dni, p.motivos]));
    expect(byDni["97400001"]).toEqual(["Expediente de Prueba Social sin movimiento hace 45 días"]);
    expect(byDni["97400002"]).toEqual(expect.arrayContaining(["Expediente urgente (Prueba Social)", expect.stringMatching(/^Seguimiento vencido el \d\d\/\d\d$/)]));
    expect(byDni["97400004"][0]).toMatch(/^Ficha de tormenta del .* sin entrega$/);
    expect(list.people.find((p) => p.dni === "97400003")).toBeUndefined();

    const sinTel = await buildRecorridaList("Evita", criteria("motivo=sinTelefono&calle=mitre"));
    expect(sinTel.people.map((p) => p.dni)).toEqual(["97400003"]);
    const programa = await buildRecorridaList("Evita", criteria("programa=prog_tarjeta_alimentar"));
    expect(programa.people.map((p) => [p.dni, p.motivos])).toEqual([["97400003", ["En Tarjeta Alimentar"]]]);
    expect((await buildRecorridaList("Evita", criteria(""))).people).toEqual([]);
  });

  it("guarda la recorrida con la lista armada en el servidor y avisa al equipo", async () => {
    loginAs(auditor);
    expect(errorOf(await createRecorridaAction("Evita", "motivo=quietos", [], { fecha: "2026-11-02", objetivo: "", equipoIds: [] }))).toMatch(/no puede/);
    loginAs(operativo);
    expect(errorOf(await createRecorridaAction("Evita", "motivo=quietos", [], { fecha: "", objetivo: "", equipoIds: [] }))).toMatch(/día/);
    expect(errorOf(await createRecorridaAction("Evita", "motivo=quietos", ["97400001"], { fecha: "2026-11-02", objetivo: "", equipoIds: [] }))).toMatch(/vacía/);

    const res = await createRecorridaAction("Evita", "motivo=quietos&motivo=urgentes&motivo=tormenta", ["97400004"], {
      fecha: "2026-11-02",
      objetivo: "Seguimientos",
      equipoIds: [otro.id, auditor.id, "inventado"],
    });
    expect(res.success).toBe(true);
    const id = (res as { id: string }).id;
    const rec = (await getRecorrida(id))!;
    expect(rec).toMatchObject({ barrio: "Evita", fecha: "2026-11-02T00:00:00.000Z", objetivo: "Seguimientos", estado: "PLANIFICADA" });
    // Quien la arma sale siempre; el auditor y un id que no existe no.
    expect(rec.equipoIds).toEqual([operativo.id, otro.id]);
    expect(rec.visitas.map((v) => [v.orden, v.dni])).toEqual([[1, "97400002"], [2, "97400001"]]);
    expect(rec.visitas[1]).toMatchObject({ nombre: "Recorrida, Ana", direccion: "Mitre 110", telefono: "11 5555-0001", lat: -34.6, lng: -58.56 });
    expect(await prisma.notification.count({ where: { userId: otro.id, link: `/barrios/recorridas/${id}` } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "RECORRIDA_CREADA", entityId: id } })).toBe(1);
    expect((await getBarrioRecorridas("Evita")).map((r) => [r.id, r.total, r.equipo])).toEqual([[id, 2, ["Prueba OPERATIVO", "Prueba OPERATIVO"]]]);
  });

  it("se anotan las visitas, se suman personas, se cambia y se termina", async () => {
    const id = (await prisma.recorrida.findFirstOrThrow()).id;
    const [beto, ana] = (await getRecorrida(id))!.visitas;

    loginAs(auditor);
    expect(errorOf(await saveVisitaAction(id, ana.id, "VISITADA", ""))).toMatch(/no puede/);
    loginAs(otro);
    expect(errorOf(await saveVisitaAction(id, ana.id, "INVENTADO", ""))).toMatch(/Elegí/);
    expect(await saveVisitaAction(id, ana.id, "VISITADA", "  Pide turno con la trabajadora social  ")).toEqual({ success: true });
    expect(await saveVisitaAction(id, beto.id, "NO_ESTABA", "")).toEqual({ success: true });
    const after = (await getRecorrida(id))!;
    expect(after.visitas[1]).toMatchObject({ resultado: "VISITADA", nota: "Pide turno con la trabajadora social", visitadaPor: "Prueba OPERATIVO" });

    expect(errorOf(await addVisitaAction(id, "11111111"))).toMatch(/padrón/);
    expect(errorOf(await addVisitaAction(id, "97400001"))).toMatch(/ya está/);
    expect(await addVisitaAction(id, "97.400.003")).toEqual({ success: true });
    expect((await getRecorrida(id))!.visitas.map((v) => [v.orden, v.dni])).toEqual([[1, "97400002"], [2, "97400001"], [3, "97400003"]]);

    expect(errorOf(await updateRecorridaAction(id, "Evita", { fecha: "2026-11-03", objetivo: "", equipoIds: [] }))).toMatch(/al menos/);
    expect(await updateRecorridaAction(id, "Evita", { fecha: "2026-11-03", objetivo: "", equipoIds: [otro.id, dg.id] })).toEqual({ success: true });
    expect(await prisma.notification.count({ where: { userId: dg.id } })).toBe(1);
    // El operativo que la armó ya no sale, pero la puede seguir cambiando.
    loginAs(operativo);
    expect(errorOf(await terminarRecorridaAction(id, "Evita", "  ", ""))).toMatch(/qué se encontró/);
    expect(await terminarRecorridaAction(id, "Evita", "La calle Mitre sigue inundada.", "Volver a lo de Beto.")).toEqual({ success: true });
    const done = (await getRecorrida(id))!;
    expect(done).toMatchObject({ estado: "HECHA", hallazgos: "La calle Mitre sigue inundada.", pendientes: "Volver a lo de Beto." });
    expect(done.terminadaAt).not.toBeNull();
    expect(errorOf(await addVisitaAction(id, "97400004"))).toMatch(/terminó/);
    expect(await prisma.auditLog.findFirstOrThrow({ where: { action: "RECORRIDA_TERMINADA" } })).toMatchObject({
      details: "Recorrida por Evita del 03/11/2026: 1 de 3 visitas hechas.",
    });

    // La visita queda en la ficha de la persona, y la próxima lista saca a quien se visitó hace poco.
    expect((await getPersonVisits("97400001")).map((v) => [v.resultadoLabel, v.barrio, v.nota])).toEqual([["Visitada", "Evita", "Pide turno con la trabajadora social"]]);
    expect(await getPersonVisits("97400003")).toEqual([]);
    const next = await buildRecorridaList("Evita", criteria("motivo=quietos&motivo=urgentes"));
    expect(next.people.map((p) => p.dni)).toEqual(["97400002"]);
    expect(next.excludedVisited).toBe(1);
    const withVisited = await buildRecorridaList("Evita", criteria("motivo=quietos&motivo=urgentes&visitados=1"));
    expect(withVisited.people.find((p) => p.dni === "97400001")?.ultimaVisita).not.toBeNull();
    expect((await getRecorridaStatsByBarrio()).get("Evita")).toEqual({ proxima: null, ultima: "2026-11-03T00:00:00.000Z" });
  });

  it("la borra quien la armó o la conducción", async () => {
    const id = (await prisma.recorrida.findFirstOrThrow()).id;
    loginAs(otro);
    expect(errorOf(await deleteRecorridaAction(id))).toMatch(/quien la armó/);
    loginAs(operativo);
    expect(await deleteRecorridaAction(id)).toEqual({ success: true, barrio: "Evita" });
    expect(await prisma.recorridaVisita.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "RECORRIDA_BORRADA" } })).toBe(1);
  });
});

describe("referente de cada barrio", () => {
  it("lo elige la conducción, le avisa y queda en Auditoría", async () => {
    loginAs(operativo);
    expect(errorOf(await setReferenteAction("Evita", otro.id))).toMatch(/conducción/);
    loginAs(dg);
    expect(errorOf(await setReferenteAction("Evita", auditor.id))).toMatch(/no puede ser referente/);
    expect(errorOf(await setReferenteAction("El Palomar", otro.id))).toMatch(/barrio/);
    expect(await setReferenteAction("Evita", otro.id)).toEqual({ success: true });
    expect((await getReferentes()).get("Evita")).toMatchObject({ userId: otro.id, name: "Prueba OPERATIVO", area: "Prueba Social" });
    expect(await prisma.notification.count({ where: { userId: otro.id, title: "Sos referente de Evita", link: "/barrios/evita" } })).toBe(1);
    expect(await setReferenteAction("Evita", operativo.id)).toEqual({ success: true });
    expect((await getReferentes()).get("Evita")?.userId).toBe(operativo.id);
    expect(await setReferenteAction("Evita", null)).toEqual({ success: true });
    expect((await getReferentes()).size).toBe(0);
    expect((await prisma.auditLog.findMany({ where: { action: "BARRIO_REFERENTE" }, orderBy: { createdAt: "asc" } })).map((l) => l.details)).toEqual([
      "Prueba OPERATIVO quedó como referente de Evita.",
      "Prueba OPERATIVO quedó como referente de Evita.",
      "Evita quedó sin referente.",
    ]);
  });
});

describe("mapa del barrio", () => {
  it("trae los puntos de la gente, los expedientes abiertos y los lugares que se encontraron", async () => {
    loginAs(operativo);
    expect(await saveLugarAction("Evita", null, { tipo: "ESCUELA", nombre: "Escuela de Prueba", direccion: "Mitre 500" })).toEqual({ success: true });
    expect(await saveLugarAction("Evita", null, { tipo: "COMEDOR", nombre: "Comedor de Prueba", direccion: "Calle Que No Existe 1" })).toEqual({ success: true });
    const escuela = await prisma.lugarReferencia.findFirstOrThrow({ where: { nombre: "Escuela de Prueba" } });
    expect(escuela).toMatchObject({ latitude: -34.6, longitude: -58.56 });

    const map = await getBarrioMapData("Evita", { canViewSensitive: false });
    expect(map.dnis).toEqual(expect.arrayContaining(["97400001", "97400002"]));
    expect(map.dnis).toHaveLength(2);
    // Ana tiene un punto de Georef (exacto); el de Beto es aproximado (solo el barrio).
    const at = (dni: string) => map.points.slice(map.dnis.indexOf(dni) * 3, map.dnis.indexOf(dni) * 3 + 3);
    expect(at("97400001")).toEqual([-34.6, -58.56, 0]);
    expect(at("97400002")).toEqual([-34.601, -58.561, 1]);
    expect(map.sinPunto).toBe(2);
    expect(map.cases.map((c) => c.title).sort()).toEqual(["Caso quieto", "Caso urgente"]);
    expect(map.lugares.map((l) => l.nombre)).toEqual(["Escuela de Prueba"]);
    expect(map.lugaresSinPunto).toBe(1);

    // Al corregir la dirección del comedor se vuelve a buscar.
    const comedor = await prisma.lugarReferencia.findFirstOrThrow({ where: { nombre: "Comedor de Prueba" } });
    expect(await saveLugarAction("Evita", comedor.id, { tipo: "COMEDOR", nombre: "Comedor de Prueba", direccion: "Mitre 500" })).toEqual({ success: true });
    expect((await getBarrioMapData("Evita", { canViewSensitive: false })).lugaresSinPunto).toBe(0);
  });
});
