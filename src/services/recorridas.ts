import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { BARRIOS_3F, barrioSlug, type Barrio3F } from "@/lib/barrios";
import { getAreaShortName } from "@/lib/area-theme";
import { STALE_DAYS } from "@/lib/case-summary";
import { formatFecha, formatVencimiento, diaAR, diaDeVencimiento, diasEntre } from "@/lib/fechas";
import { PADRON_PROGRAMS } from "@/lib/padron-programs";
import { plural } from "@/lib/formato";
import {
  RECORRIDA_MAX, SEGUIMIENTO_DIAS, YA_VISITADOS_DIAS, canAssignReferente, canBeInRecorrida, canDeleteRecorrida,
  canManageRecorrida, canPlanRecorridas, cleanNota, isVisitaResultado, parseFechaRecorrida, sortByStreet,
  visitaResultadoLabel, type RecorridaCriteria,
} from "@/lib/recorridas";
import { inBarrioSql } from "@/services/barrios";
import { createNotification } from "@/services/notifications";

// Recorridas por un barrio: armar la lista de a quién visitar, guardarla, anotar cada visita y terminarla
// con lo que se encontró. También el referente de cada barrio.
// Los expedientes de Violencia de Género nunca entran en una lista de recorrida, aunque quien la arme pueda
// verlos: la lista la lleva todo el equipo casa por casa.

type Actor = { id?: string | null; role?: string | null };
type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

const NOT_VG = Prisma.sql`a.name NOT ILIKE '%violencia%'`;

async function activeActor(user: Actor) {
  if (!user.id) return null;
  const u = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, role: true, isActive: true, name: true } });
  return u?.isActive ? u : null;
}

const officialBarrio = (barrio: string): Barrio3F | null => BARRIOS_3F.find((b) => b === barrio) ?? null;

// ---------------------------------------------------------------------------
// Armar la lista
// ---------------------------------------------------------------------------

export type RecorridaCandidate = {
  dni: string;
  nombre: string | null;
  direccion: string | null;
  telefono: string | null;
  motivos: string[];
  /** Cuántos motivos tiene: con más motivos, primero si hay que recortar la lista. */
  peso: number;
  /** Fecha de la última vez que se la visitó (en una recorrida), si la hay. */
  ultimaVisita: string | null;
};

/** Por cada DNI, los motivos que suma. */
class Reasons {
  private map = new Map<string, { motivos: string[]; peso: number }>();
  add(dni: string, motivo: string, peso = 1) {
    const r = this.map.get(dni) ?? { motivos: [], peso: 0 };
    if (!r.motivos.includes(motivo)) {
      r.motivos.push(motivo);
      r.peso += peso;
    }
    this.map.set(dni, r);
  }
  get dnis() {
    return [...this.map.keys()];
  }
  get(dni: string) {
    return this.map.get(dni) ?? { motivos: [], peso: 0 };
  }
  delete(dni: string) {
    this.map.delete(dni);
  }
}

/** Tope de filas por motivo, para que un barrio grande no traiga miles (después se recorta a RECORRIDA_MAX). */
const PER_REASON = 3000;

/**
 * La lista de a quién visitar en un barrio, según los motivos elegidos, ordenada por calle.
 * Si hay más de RECORRIDA_MAX, quedan los que suman más motivos.
 */
export async function buildRecorridaList(barrio: Barrio3F, c: RecorridaCriteria) {
  const reasons = new Reasons();
  if (c.motivos.length === 0) return { people: [] as RecorridaCandidate[], total: 0, truncated: false, excludedVisited: 0 };

  const conditions = [await inBarrioSql(barrio)];
  if (c.calle) conditions.push(Prisma.sql`p.direccion ILIKE ${"%" + c.calle + "%"}`);
  const inArea = Prisma.join(conditions, " AND ");
  const caseJoin = Prisma.sql`
    FROM "Case" c
    JOIN "Area" a ON a.id = c."areaId"
    JOIN "Person" pe ON pe.id = c."personId"
    JOIN padron_unificado p ON p.dni = pe.dni`;
  const today = diaAR();

  const tasks: Promise<void>[] = [];

  if (c.motivos.includes("quietos")) {
    const cutoff = new Date(Date.now() - STALE_DAYS * 86_400_000);
    tasks.push(
      prisma.$queryRaw<{ dni: string; area: string; last: Date }[]>`
        SELECT p.dni, a.name AS area, COALESCE(MAX(i.date), c."createdAt") AS last
        ${caseJoin}
        LEFT JOIN "Intervention" i ON i."caseId" = c.id
        WHERE c.status <> 'CERRADO' AND ${NOT_VG} AND c."createdAt" < ${cutoff} AND ${inArea}
        GROUP BY p.dni, c.id, a.name
        HAVING MAX(i.date) IS NULL OR MAX(i.date) < ${cutoff}
        ORDER BY last ASC
        LIMIT ${PER_REASON}`.then((rows) => {
        for (const r of rows) {
          const days = Math.max(STALE_DAYS, diasEntre(diaAR(r.last), today));
          reasons.add(r.dni, `Expediente de ${getAreaShortName(r.area)} sin movimiento hace ${plural(days, "día")}`);
        }
      })
    );
  }

  if (c.motivos.includes("urgentes")) {
    tasks.push(
      prisma.$queryRaw<{ dni: string; area: string; priority: string }[]>`
        SELECT DISTINCT p.dni, a.name AS area, c.priority::text AS priority
        ${caseJoin}
        WHERE c.status <> 'CERRADO' AND ${NOT_VG} AND c.priority IN ('URGENTE', 'ALTA') AND ${inArea}
        LIMIT ${PER_REASON}`.then((rows) => {
        for (const r of rows) {
          reasons.add(r.dni, `Expediente ${r.priority === "URGENTE" ? "urgente" : "de prioridad alta"} (${getAreaShortName(r.area)})`, r.priority === "URGENTE" ? 2 : 1);
        }
      })
    );
  }

  if (c.motivos.includes("seguimientos")) {
    const until = new Date(Date.now() + SEGUIMIENTO_DIAS * 86_400_000);
    tasks.push(
      prisma.$queryRaw<{ dni: string; due: Date }[]>`
        SELECT p.dni, MIN(t."dueDate") AS due
        ${caseJoin}
        JOIN "Task" t ON t."caseId" = c.id
        WHERE c.status <> 'CERRADO' AND ${NOT_VG} AND t.status <> 'COMPLETADA' AND t."dueDate" IS NOT NULL
          AND t."dueDate" <= ${until} AND ${inArea}
        GROUP BY p.dni
        LIMIT ${PER_REASON}`.then((rows) => {
        for (const r of rows) {
          const late = diaDeVencimiento(r.due) < today;
          reasons.add(r.dni, late ? `Seguimiento vencido el ${formatVencimiento(r.due)}` : `Seguimiento agendado para el ${formatVencimiento(r.due)}`, late ? 2 : 1);
        }
      })
    );
  }

  if (c.motivos.includes("tormenta")) {
    tasks.push(
      prisma.$queryRaw<{ dni: string; created: Date }[]>`
        SELECT p.dni, MAX(r."createdAt") AS created
        FROM "StormVictimRecord" r
        JOIN padron_unificado p ON p.dni = r.dni
        WHERE NOT EXISTS (SELECT 1 FROM "StormDelivery" d WHERE d."recordId" = r.id) AND ${inArea}
        GROUP BY p.dni
        LIMIT ${PER_REASON}`.then((rows) => {
        for (const r of rows) reasons.add(r.dni, `Ficha de tormenta del ${formatFecha(r.created)} sin entrega`, 2);
      })
    );
  }

  if (c.motivos.includes("sinTelefono")) {
    tasks.push(
      prisma.$queryRaw<{ dni: string }[]>`
        SELECT p.dni FROM padron_unificado p
        WHERE NULLIF(btrim(p.telefono), '') IS NULL AND ${inArea}
        LIMIT ${PER_REASON}`.then((rows) => {
        for (const r of rows) reasons.add(r.dni, "Sin teléfono cargado", 0.5);
      })
    );
  }

  const program = c.programa ? PADRON_PROGRAMS.find((p) => p.column === c.programa) : null;
  if (c.motivos.includes("programa") && program) {
    tasks.push(
      prisma.$queryRaw<{ dni: string }[]>`
        SELECT p.dni FROM padron_unificado p
        WHERE p.${Prisma.raw(`"${program.column}"`)} = 1 AND ${inArea}
        LIMIT ${PER_REASON}`.then((rows) => {
        for (const r of rows) reasons.add(r.dni, `En ${program.label}`, 0.5);
      })
    );
  }

  await Promise.all(tasks);

  // Visitas de los últimos días (para sacarlos de la lista, o para avisar cuándo fue la última).
  const dnis = reasons.dnis;
  const lastVisits = dnis.length
    ? await prisma.recorridaVisita.groupBy({
        by: ["dni"],
        where: { dni: { in: dnis }, resultado: "VISITADA" },
        _max: { visitadaAt: true },
      })
    : [];
  const lastVisit = new Map(lastVisits.map((v) => [v.dni, v._max.visitadaAt]));
  let excludedVisited = 0;
  if (c.sinVisitados) {
    const since = Date.now() - YA_VISITADOS_DIAS * 86_400_000;
    for (const dni of dnis) {
      const at = lastVisit.get(dni);
      if (at && at.getTime() >= since) {
        reasons.delete(dni);
        excludedVisited++;
      }
    }
  }

  const all = reasons.dnis;
  const rows = all.length
    ? await prisma.padronUnificado.findMany({
        where: { dni: { in: all } },
        select: { dni: true, nombre_completo: true, direccion: true, telefono: true },
      })
    : [];
  let people: RecorridaCandidate[] = rows.map((r) => ({
    dni: r.dni,
    nombre: r.nombre_completo,
    direccion: r.direccion,
    telefono: r.telefono?.trim() || null,
    motivos: reasons.get(r.dni).motivos,
    peso: reasons.get(r.dni).peso,
    ultimaVisita: lastVisit.get(r.dni)?.toISOString() ?? null,
  }));
  const total = people.length;
  if (people.length > RECORRIDA_MAX) {
    people = [...people].sort((a, b) => b.peso - a.peso || (a.nombre ?? "").localeCompare(b.nombre ?? "", "es")).slice(0, RECORRIDA_MAX);
  }
  return { people: sortByStreet(people), total, truncated: total > people.length, excludedVisited };
}

// ---------------------------------------------------------------------------
// Guardar, ver y cambiar recorridas
// ---------------------------------------------------------------------------

export type RecorridaInput = {
  fecha: unknown;
  objetivo: unknown;
  equipoIds: unknown;
};

async function cleanEquipo(ids: unknown): Promise<string[]> {
  const list = Array.from(new Set((Array.isArray(ids) ? ids : []).map(String))).slice(0, 30);
  if (!list.length) return [];
  const users = await prisma.user.findMany({ where: { id: { in: list }, isActive: true }, select: { id: true, role: true } });
  return users.filter((u) => canBeInRecorrida(u.role)).map((u) => u.id);
}

/**
 * Guarda una recorrida con su lista. La lista se vuelve a armar acá con los mismos criterios (así los motivos
 * son los de la base y no lo que mandó el navegador) y se sacan los DNI que se destildaron.
 */
export async function createRecorrida(
  user: Actor,
  barrio: string,
  criteria: RecorridaCriteria,
  excluded: string[],
  input: RecorridaInput
): Promise<Result<{ id: string }>> {
  const actor = await activeActor(user);
  if (!actor || !canPlanRecorridas(actor.role)) return { success: false, error: "Tu rol no puede armar recorridas." };
  const b = officialBarrio(barrio);
  if (!b) return { success: false, error: "No se encontró el barrio." };
  const fecha = parseFechaRecorrida(input.fecha);
  if (!fecha) return { success: false, error: "Elegí el día de la recorrida." };
  const list = await buildRecorridaList(b, criteria);
  const skip = new Set(excluded.map(String));
  const people = list.people.filter((p) => !skip.has(p.dni));
  if (!people.length) return { success: false, error: "La lista quedó vacía: elegí al menos una persona para visitar." };
  const equipo = await cleanEquipo(input.equipoIds);
  if (!equipo.includes(actor.id)) equipo.unshift(actor.id);

  const rec = await prisma.recorrida.create({
    data: {
      barrio: b,
      fecha,
      objetivo: cleanNota(input.objetivo, 200),
      equipoIds: equipo,
      createdById: actor.id,
      visitas: {
        create: people.map((p, i) => ({
          dni: p.dni,
          nombre: p.nombre,
          direccion: p.direccion,
          motivo: p.motivos.join(" · ").slice(0, 500) || null,
          orden: i + 1,
        })),
      },
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "RECORRIDA_CREADA",
      entity: "Recorrida",
      entityId: rec.id,
      details: `Recorrida por ${b} del ${fechaDeRecorrida(fecha)}, con ${plural(people.length, "persona")} para visitar.`,
    },
  });
  for (const id of equipo) {
    if (id === actor.id) continue;
    await createNotification(
      id,
      `Recorrida por ${b}`,
      `${actor.name || "Alguien"} te sumó a la recorrida del ${fechaDeRecorrida(fecha)}.`,
      `/barrios/recorridas/${rec.id}`
    );
  }
  return { success: true, id: rec.id };
}

/** "30/10/2026" de una fecha de calendario guardada a medianoche UTC. */
export const fechaDeRecorrida = (d: Date | string) => {
  const s = (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);
  return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
};

async function userNames(ids: (string | null | undefined)[]) {
  const list = Array.from(new Set(ids.filter(Boolean) as string[]));
  if (!list.length) return new Map<string, string>();
  const users = await prisma.user.findMany({ where: { id: { in: list } }, select: { id: true, name: true, username: true } });
  return new Map(users.map((u) => [u.id, u.name || u.username || "Usuario"]));
}

export type RecorridaListItem = {
  id: string;
  fecha: string;
  objetivo: string | null;
  estado: string;
  equipo: string[];
  total: number;
  visitadas: number;
  conResultado: number;
};

/** Las recorridas de un barrio: primero las que faltan hacer (la más cercana primero), después las hechas. */
export async function getBarrioRecorridas(barrio: Barrio3F, limit = 30): Promise<RecorridaListItem[]> {
  const recs = await prisma.recorrida.findMany({
    where: { barrio },
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: { visitas: { select: { resultado: true } } },
  });
  const names = await userNames(recs.flatMap((r) => r.equipoIds));
  const items = recs.map((r) => ({
    id: r.id,
    fecha: r.fecha.toISOString(),
    objetivo: r.objetivo,
    estado: r.estado,
    equipo: r.equipoIds.map((id) => names.get(id)).filter(Boolean) as string[],
    total: r.visitas.length,
    visitadas: r.visitas.filter((v) => v.resultado === "VISITADA").length,
    conResultado: r.visitas.filter((v) => v.resultado !== "PENDIENTE").length,
  }));
  const planned = items.filter((r) => r.estado !== "HECHA").sort((a, b) => a.fecha.localeCompare(b.fecha));
  return [...planned, ...items.filter((r) => r.estado === "HECHA")];
}

export type RecorridaVisitaView = {
  id: string;
  orden: number;
  dni: string;
  nombre: string | null;
  direccion: string | null;
  telefono: string | null;
  motivo: string | null;
  resultado: string;
  nota: string | null;
  visitadaAt: string | null;
  visitadaPor: string | null;
  lat: number | null;
  lng: number | null;
};

/** Una recorrida con su lista (y el punto de cada casa en el mapa, si está ubicada). */
export async function getRecorrida(id: string) {
  const rec = await prisma.recorrida.findUnique({
    where: { id },
    include: { visitas: { orderBy: { orden: "asc" } } },
  });
  if (!rec) return null;
  const [padron, names] = await Promise.all([
    rec.visitas.length
      ? prisma.padronUnificado.findMany({
          where: { dni: { in: rec.visitas.map((v) => v.dni) } },
          select: { dni: true, telefono: true, latitude: true, longitude: true },
        })
      : [],
    userNames([...rec.equipoIds, rec.createdById, ...rec.visitas.map((v) => v.visitadaPorId)]),
  ]);
  const byDni = new Map(padron.map((p) => [p.dni, p]));
  const visitas: RecorridaVisitaView[] = rec.visitas.map((v) => {
    const p = byDni.get(v.dni);
    return {
      id: v.id,
      orden: v.orden,
      dni: v.dni,
      nombre: v.nombre,
      direccion: v.direccion,
      telefono: p?.telefono?.trim() || null,
      motivo: v.motivo,
      resultado: v.resultado,
      nota: v.nota,
      visitadaAt: v.visitadaAt?.toISOString() ?? null,
      visitadaPor: v.visitadaPorId ? names.get(v.visitadaPorId) ?? null : null,
      lat: p?.latitude ?? null,
      lng: p?.longitude ?? null,
    };
  });
  return {
    id: rec.id,
    barrio: rec.barrio,
    fecha: rec.fecha.toISOString(),
    objetivo: rec.objetivo,
    estado: rec.estado,
    equipoIds: rec.equipoIds,
    equipo: rec.equipoIds.map((uid) => ({ id: uid, name: names.get(uid) ?? "Usuario" })),
    hallazgos: rec.hallazgos,
    pendientes: rec.pendientes,
    terminadaAt: rec.terminadaAt?.toISOString() ?? null,
    createdById: rec.createdById,
    createdBy: rec.createdById ? names.get(rec.createdById) ?? null : null,
    visitas,
  };
}

export type RecorridaDetail = NonNullable<Awaited<ReturnType<typeof getRecorrida>>>;

/** Anota qué pasó en una visita. */
export async function saveVisita(user: Actor, visitaId: string, resultado: unknown, nota: unknown): Promise<Result> {
  const actor = await activeActor(user);
  if (!actor || !canPlanRecorridas(actor.role)) return { success: false, error: "Tu rol no puede anotar visitas." };
  if (!isVisitaResultado(resultado)) return { success: false, error: "Elegí qué pasó en la visita." };
  const visita = await prisma.recorridaVisita.findUnique({ where: { id: visitaId }, select: { id: true } });
  if (!visita) return { success: false, error: "No se encontró la visita. Puede que hayan borrado la recorrida." };
  const pending = resultado === "PENDIENTE";
  await prisma.recorridaVisita.update({
    where: { id: visitaId },
    data: {
      resultado,
      nota: cleanNota(nota),
      visitadaAt: pending ? null : new Date(),
      visitadaPorId: pending ? null : actor.id,
    },
  });
  return { success: true };
}

/** Suma a alguien del padrón a una recorrida que todavía no se terminó. */
export async function addVisita(user: Actor, recorridaId: string, rawDni: unknown): Promise<Result> {
  const actor = await activeActor(user);
  if (!actor || !canPlanRecorridas(actor.role)) return { success: false, error: "Tu rol no puede cambiar recorridas." };
  const rec = await prisma.recorrida.findUnique({ where: { id: recorridaId }, include: { _count: { select: { visitas: true } } } });
  if (!rec) return { success: false, error: "No se encontró la recorrida." };
  if (!canManageRecorrida(actor, rec)) return { success: false, error: "La cambia quien la armó, quien sale en ella o la conducción." };
  if (rec.estado === "HECHA") return { success: false, error: "La recorrida ya se terminó." };
  const dni = String(rawDni ?? "").replace(/\D/g, "");
  if (!dni) return { success: false, error: "Escribí el DNI." };
  const person = await prisma.padronUnificado.findUnique({ where: { dni }, select: { dni: true, nombre_completo: true, direccion: true } });
  if (!person) return { success: false, error: "Ese DNI no está en el padrón." };
  const exists = await prisma.recorridaVisita.findUnique({ where: { recorridaId_dni: { recorridaId, dni } } });
  if (exists) return { success: false, error: "Esa persona ya está en la lista." };
  await prisma.recorridaVisita.create({
    data: {
      recorridaId,
      dni,
      nombre: person.nombre_completo,
      direccion: person.direccion,
      motivo: `Agregada por ${actor.name || "el equipo"}`,
      orden: rec._count.visitas + 1,
    },
  });
  return { success: true };
}

/** Cambia el día, el objetivo o el equipo. */
export async function updateRecorrida(user: Actor, id: string, input: RecorridaInput): Promise<Result> {
  const actor = await activeActor(user);
  const rec = await prisma.recorrida.findUnique({ where: { id } });
  if (!rec) return { success: false, error: "No se encontró la recorrida." };
  if (!actor || !canManageRecorrida(actor, rec)) return { success: false, error: "La cambia quien la armó, quien sale en ella o la conducción." };
  const fecha = parseFechaRecorrida(input.fecha);
  if (!fecha) return { success: false, error: "Elegí el día de la recorrida." };
  const equipo = await cleanEquipo(input.equipoIds);
  if (!equipo.length) return { success: false, error: "Elegí al menos una persona del equipo." };
  await prisma.recorrida.update({ where: { id }, data: { fecha, objetivo: cleanNota(input.objetivo, 200), equipoIds: equipo } });
  const nuevos = equipo.filter((uid) => !rec.equipoIds.includes(uid) && uid !== actor.id);
  for (const uid of nuevos) {
    await createNotification(uid, `Recorrida por ${rec.barrio}`, `${actor.name || "Alguien"} te sumó a la recorrida del ${fechaDeRecorrida(fecha)}.`, `/barrios/recorridas/${id}`);
  }
  return { success: true };
}

/** La da por hecha, con lo que se encontró y lo que quedó pendiente. También sirve para corregir esas notas. */
export async function terminarRecorrida(user: Actor, id: string, hallazgos: unknown, pendientes: unknown): Promise<Result> {
  const actor = await activeActor(user);
  const rec = await prisma.recorrida.findUnique({ where: { id }, include: { visitas: { select: { resultado: true } } } });
  if (!rec) return { success: false, error: "No se encontró la recorrida." };
  if (!actor || !canManageRecorrida(actor, rec)) return { success: false, error: "La termina quien la armó, quien sale en ella o la conducción." };
  const h = cleanNota(hallazgos, 4000);
  if (!h) return { success: false, error: "Contá brevemente qué se encontró en la recorrida." };
  const firstTime = rec.estado !== "HECHA";
  await prisma.recorrida.update({
    where: { id },
    data: { estado: "HECHA", hallazgos: h, pendientes: cleanNota(pendientes, 4000), terminadaAt: rec.terminadaAt ?? new Date() },
  });
  if (firstTime) {
    const visitadas = rec.visitas.filter((v) => v.resultado === "VISITADA").length;
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "RECORRIDA_TERMINADA",
        entity: "Recorrida",
        entityId: id,
        details: `Recorrida por ${rec.barrio} del ${fechaDeRecorrida(rec.fecha)}: ${visitadas} de ${plural(rec.visitas.length, "visita")} hechas.`,
      },
    });
  }
  return { success: true };
}

export async function deleteRecorrida(user: Actor, id: string): Promise<Result<{ barrio: string }>> {
  const actor = await activeActor(user);
  const rec = await prisma.recorrida.findUnique({ where: { id } });
  if (!rec) return { success: false, error: "No se encontró la recorrida. Puede que ya la hayan borrado." };
  if (!actor || !canDeleteRecorrida(actor, rec)) return { success: false, error: "Una recorrida la borra quien la armó o la conducción." };
  await prisma.$transaction([
    prisma.recorrida.delete({ where: { id } }),
    prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "RECORRIDA_BORRADA",
        entity: "Recorrida",
        entityId: id,
        details: `Recorrida por ${rec.barrio} del ${fechaDeRecorrida(rec.fecha)}.`,
      },
    }),
  ]);
  return { success: true, barrio: rec.barrio };
}

/** Las personas que pueden salir a una recorrida o ser referentes (para elegirlas en una lista). */
export async function getRecorridaUserOptions() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, username: true, role: true, area: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  return users
    .filter((u) => canBeInRecorrida(u.role))
    .map((u) => ({ id: u.id, name: u.name || u.username || "Usuario", area: u.area?.name ? getAreaShortName(u.area.name) : null }));
}

export type UserOption = Awaited<ReturnType<typeof getRecorridaUserOptions>>[number];

// ---------------------------------------------------------------------------
// Visitas de una persona (para la Historia de su ficha)
// ---------------------------------------------------------------------------

export type PersonVisit = {
  id: string;
  recorridaId: string;
  barrio: string;
  fecha: string;
  resultado: string;
  resultadoLabel: string;
  nota: string | null;
  visitadaPor: string | null;
};

/** Las visitas que se le hicieron (con resultado anotado), la más reciente primero. */
export async function getPersonVisits(dni: string): Promise<PersonVisit[]> {
  const visitas = await prisma.recorridaVisita.findMany({
    where: { dni, resultado: { not: "PENDIENTE" } },
    include: { recorrida: { select: { id: true, barrio: true, fecha: true } } },
    orderBy: { visitadaAt: "desc" },
    take: 50,
  });
  const names = await userNames(visitas.map((v) => v.visitadaPorId));
  return visitas.map((v) => ({
    id: v.id,
    recorridaId: v.recorrida.id,
    barrio: v.recorrida.barrio,
    fecha: (v.visitadaAt ?? v.recorrida.fecha).toISOString(),
    resultado: v.resultado,
    resultadoLabel: visitaResultadoLabel(v.resultado),
    nota: v.nota,
    visitadaPor: v.visitadaPorId ? names.get(v.visitadaPorId) ?? null : null,
  }));
}

// ---------------------------------------------------------------------------
// Referente de cada barrio
// ---------------------------------------------------------------------------

export type Referente = { userId: string; name: string; email: string | null; area: string | null };

/** Referente de cada barrio (solo los que tienen uno). */
export async function getReferentes(): Promise<Map<string, Referente>> {
  const rows = await prisma.barrioReferente.findMany();
  if (!rows.length) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, name: true, username: true, email: true, isActive: true, area: { select: { name: true } } },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  const map = new Map<string, Referente>();
  for (const r of rows) {
    const u = byId.get(r.userId);
    if (!u?.isActive) continue;
    map.set(r.barrio, {
      userId: u.id,
      name: u.name || u.username || "Usuario",
      email: u.email,
      area: u.area?.name ? getAreaShortName(u.area.name) : null,
    });
  }
  return map;
}

export async function getReferente(barrio: Barrio3F): Promise<Referente | null> {
  return (await getReferentes()).get(barrio) ?? null;
}

/** Elige (o saca, con userId vacío) el referente de un barrio. Le avisa a quien queda a cargo. */
export async function setReferente(user: Actor, barrio: string, userId: string | null): Promise<Result> {
  const actor = await activeActor(user);
  if (!actor || !canAssignReferente(actor.role)) return { success: false, error: "El referente de cada barrio lo elige la conducción." };
  const b = officialBarrio(barrio);
  if (!b) return { success: false, error: "No se encontró el barrio." };
  const before = await prisma.barrioReferente.findUnique({ where: { barrio: b } });
  if (!userId) {
    if (!before) return { success: true };
    await prisma.$transaction([
      prisma.barrioReferente.delete({ where: { barrio: b } }),
      prisma.auditLog.create({
        data: { userId: actor.id, action: "BARRIO_REFERENTE", entity: "Barrio", entityId: b, details: `${b} quedó sin referente.` },
      }),
    ]);
    return { success: true };
  }
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, username: true, role: true, isActive: true } });
  if (!target?.isActive || !canBeInRecorrida(target.role)) return { success: false, error: "Esa persona no puede ser referente (tiene que estar activa y cargar datos sociales)." };
  if (before?.userId === target.id) return { success: true };
  const name = target.name || target.username || "Usuario";
  await prisma.$transaction([
    prisma.barrioReferente.upsert({
      where: { barrio: b },
      create: { barrio: b, userId: target.id, assignedById: actor.id },
      update: { userId: target.id, assignedById: actor.id, assignedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: { userId: actor.id, action: "BARRIO_REFERENTE", entity: "Barrio", entityId: b, details: `${name} quedó como referente de ${b}.` },
    }),
  ]);
  if (target.id !== actor.id) {
    await createNotification(target.id, `Sos referente de ${b}`, `${actor.name || "La conducción"} te eligió como referente del barrio.`, `/barrios/${barrioSlug(b)}`);
  }
  return { success: true };
}

/** Por barrio: la próxima recorrida planificada y la última hecha. */
export async function getRecorridaStatsByBarrio(): Promise<Map<string, { proxima: string | null; ultima: string | null }>> {
  const [planned, done] = await Promise.all([
    prisma.recorrida.groupBy({ by: ["barrio"], where: { estado: { not: "HECHA" } }, _min: { fecha: true } }),
    prisma.recorrida.groupBy({ by: ["barrio"], where: { estado: "HECHA" }, _max: { fecha: true } }),
  ]);
  const map = new Map<string, { proxima: string | null; ultima: string | null }>();
  for (const p of planned) map.set(p.barrio, { proxima: p._min.fecha?.toISOString() ?? null, ultima: null });
  for (const d of done) map.set(d.barrio, { proxima: map.get(d.barrio)?.proxima ?? null, ultima: d._max.fecha?.toISOString() ?? null });
  return map;
}
