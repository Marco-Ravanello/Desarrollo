import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { todayInArgentina, addDays } from "@/lib/follow-up-dates";
import { diaDeVencimiento } from "@/lib/fechas";
import {
  DEFAULT_ALERT_PERCENTS, LUGARES, MAX_HORAS_DIA, canConfigureCost, canLoadHours, horasTexto, parseConfig,
  parseCuidadora, parseDia, parseHoras, parseValorHora, periodoDe, resumirPeriodo,
  type FilaHoras, type HorasInput, type Lugar, type Periodo, type ResumenPeriodo, type ValorHora,
} from "@/lib/convenio-gasto";

// Control del gasto de los convenios por horas: configuración (conducción), valor hora con historial,
// cuidadoras y horas de cada día (conducción y el área del convenio). Cada cambio queda en Auditoría.

type Actor = { id?: string | null };
type Result = { success: true } | { success: false; error: string };

const SESSION_EXPIRED = "Tu sesión expiró. Volvé a iniciar sesión.";
const NO_CONFIG = "Configurar el control del gasto le corresponde a la conducción.";
const NO_LOAD = "Las horas las cargan la conducción y las personas del área del convenio.";

class AvisoError extends Error {}

const toDate = (dia: string) => new Date(`${dia}T00:00:00.000Z`);
const isoDe = (d: Date) => d.toISOString().slice(0, 10);
const dma = (iso: string) => iso.split("-").reverse().join("/");

/** El usuario según la base (rol y área al día), si está activo. */
async function actorFromDb(user: Actor) {
  if (!user.id) return null;
  const u = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, role: true, areaId: true, isActive: true } });
  return u?.isActive ? u : null;
}

async function audit(userId: string, action: string, agreementId: string, details: Record<string, unknown>) {
  await prisma.auditLog.create({ data: { userId, action, entity: "Agreement", entityId: agreementId, details: JSON.stringify(details) } });
}

const CONVENIO_SELECT = {
  id: true, title: true, number: true, areaId: true, status: true, startDate: true, endDate: true,
  costMode: true, monthlyCap: true, periodStartDay: true, alertPercents: true,
  area: { select: { name: true } },
} satisfies Prisma.AgreementSelect;

export type ConvenioControl = Prisma.AgreementGetPayload<{ select: typeof CONVENIO_SELECT }>;

async function convenioPara(user: Actor, agreementId: string, puede: "config" | "load") {
  const actor = await actorFromDb(user);
  if (!actor) return { error: SESSION_EXPIRED } as const;
  const convenio = await prisma.agreement.findUnique({ where: { id: agreementId }, select: CONVENIO_SELECT });
  if (!convenio) return { error: "No se encontró el convenio." } as const;
  if (puede === "config" ? !canConfigureCost(actor.role) : !canLoadHours(actor, convenio)) {
    return { error: puede === "config" ? NO_CONFIG : NO_LOAD } as const;
  }
  if (puede === "load" && convenio.costMode !== "POR_HORA") {
    return { error: "Este convenio todavía no tiene el control por horas configurado." } as const;
  }
  return { actor, convenio } as const;
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

export async function getConvenioControl(agreementId: string) {
  return prisma.agreement.findUnique({ where: { id: agreementId }, select: CONVENIO_SELECT });
}

export async function getValoresHora(agreementId: string): Promise<(ValorHora & { id: string })[]> {
  const rows = await prisma.convenioValorHora.findMany({ where: { agreementId }, orderBy: { desde: "desc" } });
  return rows.map((r) => ({ id: r.id, desde: isoDe(r.desde), valor: Number(r.valor) }));
}

export async function getCuidadoras(agreementId: string) {
  const rows = await prisma.convenioCuidadora.findMany({
    where: { agreementId },
    orderBy: [{ activa: "desc" }, { nombre: "asc" }],
    select: { id: true, nombre: true, dni: true, telefono: true, activa: true, _count: { select: { horas: true } } },
  });
  return rows.map(({ _count, ...c }) => ({ ...c, filas: _count.horas }));
}

async function filasDelRango(agreementId: string, desde: string, hasta: string): Promise<FilaHoras[]> {
  const rows = await prisma.convenioHora.findMany({
    where: { agreementId, fecha: { gte: toDate(desde), lte: toDate(hasta) } },
    select: { fecha: true, cuidadoraId: true, dni: true, nombre: true, horas: true, cuidadora: { select: { nombre: true } } },
  });
  return rows.map((r) => ({
    fecha: isoDe(r.fecha),
    cuidadoraId: r.cuidadoraId,
    cuidadora: r.cuidadora.nombre,
    dni: r.dni,
    nombre: r.nombre,
    horas: Number(r.horas),
  }));
}

/** El período pedido (por su primer día) o el de hoy. */
export function periodoPedido(convenio: { periodStartDay: number | null }, raw: unknown, hoy = todayInArgentina()): Periodo {
  const startDay = convenio.periodStartDay ?? 1;
  const dia = parseDia(raw);
  return periodoDe(dia ?? hoy, startDay);
}

/** Los totales de un período del convenio (sin datos de NNyA para quien no ve el detalle: los arma la pantalla). */
export async function getResumenPeriodo(convenio: ConvenioControl, periodo: Periodo, hoy = todayInArgentina()): Promise<ResumenPeriodo> {
  const [filas, valores] = await Promise.all([filasDelRango(convenio.id, periodo.desde, periodo.hasta), getValoresHora(convenio.id)]);
  return resumirPeriodo({
    periodo,
    filas,
    valores,
    tope: convenio.monthlyCap === null ? null : Number(convenio.monthlyCap),
    alertas: convenio.alertPercents?.length === 3 ? convenio.alertPercents : DEFAULT_ALERT_PERCENTS,
    hoy,
  });
}

export type FilaDelDia = {
  id: string;
  cuidadoraId: string;
  cuidadora: string;
  dni: string;
  nombre: string | null;
  horas: number;
  lugar: Lugar;
  lugarDetalle: string | null;
  observacion: string | null;
  importe: number | null;
  cargo: string | null;
  cambio: string | null;
};

/** Las horas cargadas de un día, con quién las cargó o corrigió. */
export async function getDia(agreementId: string, dia: string): Promise<{ filas: FilaDelDia[]; valorHora: number | null }> {
  const [rows, valores] = await Promise.all([
    prisma.convenioHora.findMany({
      where: { agreementId, fecha: toDate(dia) },
      orderBy: [{ createdAt: "asc" }],
      include: { cuidadora: { select: { nombre: true } } },
    }),
    getValoresHora(agreementId),
  ]);
  const userIds = [...new Set(rows.flatMap((r) => [r.createdById, r.updatedById]).filter((x): x is string => Boolean(x)))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : [];
  const nameOf = (id: string | null) => (id ? users.find((u) => u.id === id)?.name ?? "Alguien" : null);
  const valorHora = valorDelDia(dia, valores);
  return {
    valorHora,
    filas: rows.map((r) => ({
      id: r.id,
      cuidadoraId: r.cuidadoraId,
      cuidadora: r.cuidadora.nombre,
      dni: r.dni,
      nombre: r.nombre,
      horas: Number(r.horas),
      lugar: (r.lugar in LUGARES ? r.lugar : "OTRO") as Lugar,
      lugarDetalle: r.lugarDetalle,
      observacion: r.observacion,
      importe: valorHora === null ? null : Math.round(Number(r.horas) * valorHora * 100) / 100,
      cargo: nameOf(r.createdById),
      // updatedById solo se anota al corregir una fila.
      cambio: nameOf(r.updatedById),
    })),
  };
}

function valorDelDia(dia: string, valores: ValorHora[]) {
  let found: ValorHora | null = null;
  for (const v of valores) if (v.desde <= dia && (!found || v.desde > found.desde)) found = v;
  return found?.valor ?? null;
}

/** NNyA acompañados en los últimos 90 días, para elegirlos rápido al cargar. */
export async function getNnyaRecientes(agreementId: string, hoy = todayInArgentina()) {
  const rows = await prisma.convenioHora.findMany({
    where: { agreementId, fecha: { gte: toDate(addDays(hoy, -90)) } },
    distinct: ["dni"],
    orderBy: { fecha: "desc" },
    select: { dni: true, nombre: true },
  });
  return rows.sort((a, b) => (a.nombre ?? a.dni).localeCompare(b.nombre ?? b.dni, "es"));
}

export type ConvenioConHoras = {
  id: string;
  title: string;
  area: string | null;
  periodo: Periodo;
  porcentaje: number | null;
  nivel: ResumenPeriodo["nivel"];
  horasHoy: number;
  horasAyer: number;
};

/**
 * Los convenios por horas en los que el usuario puede cargar, con cómo vienen: para la tarjeta del inicio.
 * La conducción ve todos; el resto, los de su área.
 */
export async function getConveniosParaCargar(user: { id?: string | null }): Promise<ConvenioConHoras[]> {
  const actor = await actorFromDb(user);
  if (!actor) return [];
  const convenios = await prisma.agreement.findMany({
    where: { costMode: "POR_HORA" },
    select: CONVENIO_SELECT,
    orderBy: { title: "asc" },
  });
  const hoy = todayInArgentina();
  const ayer = addDays(hoy, -1);
  const mine = convenios.filter((c) => canLoadHours(actor, c));
  return Promise.all(
    mine.map(async (c) => {
      const periodo = periodoDe(hoy, c.periodStartDay ?? 1);
      const resumen = await getResumenPeriodo(c, periodo, hoy);
      const dia = (d: string) => resumen.porDia.find((x) => x.fecha === d)?.horas ?? 0;
      let horasAyer = dia(ayer);
      if (ayer < periodo.desde) {
        const prev = await prisma.convenioHora.aggregate({ where: { agreementId: c.id, fecha: toDate(ayer) }, _sum: { horas: true } });
        horasAyer = Number(prev._sum.horas ?? 0);
      }
      return {
        id: c.id,
        title: c.title,
        area: c.area?.name ?? null,
        periodo,
        porcentaje: resumen.porcentaje,
        nivel: resumen.nivel,
        horasHoy: dia(hoy),
        horasAyer,
      };
    })
  );
}

// ---------------------------------------------------------------------------
// Configuración (conducción)
// ---------------------------------------------------------------------------

export async function configurarControl(user: Actor, agreementId: string, raw: Record<string, unknown>): Promise<Result> {
  const found = await convenioPara(user, agreementId, "config");
  if ("error" in found) return { success: false, error: found.error! };
  const parsed = parseConfig(raw);
  if (!parsed.ok) return { success: false, error: parsed.error };
  const { actor, convenio } = found;
  const first = convenio.costMode !== "POR_HORA";
  if (first) {
    const valor = parseValorHora({ desde: raw.valorDesde, valor: raw.valorHora });
    if (!valor.ok) return { success: false, error: valor.error };
    await prisma.$transaction([
      prisma.agreement.update({ where: { id: agreementId }, data: { costMode: "POR_HORA", ...parsed.data } }),
      prisma.convenioValorHora.upsert({
        where: { agreementId_desde: { agreementId, desde: toDate(valor.data.desde) } },
        create: { agreementId, desde: toDate(valor.data.desde), valor: valor.data.valor, createdById: actor.id },
        update: { valor: valor.data.valor },
      }),
    ]);
    await audit(actor.id, "CONVENIO_CONTROL", agreementId, { ...parsed.data, valorHora: valor.data.valor, desde: valor.data.desde });
    return { success: true };
  }
  await prisma.agreement.update({ where: { id: agreementId }, data: parsed.data });
  await audit(actor.id, "CONVENIO_CONTROL", agreementId, {
    antes: { monthlyCap: Number(convenio.monthlyCap ?? 0), periodStartDay: convenio.periodStartDay, alertPercents: convenio.alertPercents },
    despues: parsed.data,
  });
  return { success: true };
}

/** Un valor hora desde un día. Si ya había uno desde ese mismo día, se corrige. */
export async function guardarValorHora(user: Actor, agreementId: string, raw: Record<string, unknown>): Promise<Result> {
  const found = await convenioPara(user, agreementId, "config");
  if ("error" in found) return { success: false, error: found.error! };
  if (found.convenio.costMode !== "POR_HORA") return { success: false, error: "Primero configurá el control por horas." };
  const parsed = parseValorHora(raw);
  if (!parsed.ok) return { success: false, error: parsed.error };
  const { desde, valor } = parsed.data;
  const prev = await prisma.convenioValorHora.findUnique({ where: { agreementId_desde: { agreementId, desde: toDate(desde) } } });
  await prisma.convenioValorHora.upsert({
    where: { agreementId_desde: { agreementId, desde: toDate(desde) } },
    create: { agreementId, desde: toDate(desde), valor, createdById: found.actor.id },
    update: { valor },
  });
  await audit(found.actor.id, "CONVENIO_VALOR_HORA", agreementId, { desde, valor, antes: prev ? Number(prev.valor) : null });
  return { success: true };
}

/** Borra un valor hora, si no deja días con horas sin valor. */
export async function borrarValorHora(user: Actor, valorId: string): Promise<Result> {
  const valor = await prisma.convenioValorHora.findUnique({ where: { id: valorId } });
  if (!valor) return { success: false, error: "Ese valor ya no está." };
  const found = await convenioPara(user, valor.agreementId, "config");
  if ("error" in found) return { success: false, error: found.error! };
  const otros = await prisma.convenioValorHora.findMany({ where: { agreementId: valor.agreementId, id: { not: valorId } }, orderBy: { desde: "asc" }, take: 1 });
  const primero = otros[0]?.desde ?? null;
  const sinValor = await prisma.convenioHora.count({
    where: { agreementId: valor.agreementId, ...(primero ? { fecha: { lt: primero } } : {}) },
  });
  if (sinValor > 0) {
    return { success: false, error: "No se puede borrar: quedarían horas cargadas sin valor hora. Si el valor está mal, cargalo de nuevo con la misma fecha y se corrige." };
  }
  await prisma.convenioValorHora.delete({ where: { id: valorId } });
  await audit(found.actor.id, "CONVENIO_VALOR_HORA_BAJA", valor.agreementId, { desde: isoDe(valor.desde), valor: Number(valor.valor) });
  return { success: true };
}

// ---------------------------------------------------------------------------
// Cuidadoras (conducción y el área)
// ---------------------------------------------------------------------------

export async function guardarCuidadora(user: Actor, agreementId: string, id: string | null, raw: Record<string, unknown>): Promise<Result> {
  const found = await convenioPara(user, agreementId, "load");
  if ("error" in found) return { success: false, error: found.error! };
  const parsed = parseCuidadora(raw);
  if (!parsed.ok) return { success: false, error: parsed.error };
  const repetida = await prisma.convenioCuidadora.findFirst({
    where: { agreementId, nombre: { equals: parsed.data.nombre, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) },
    select: { id: true },
  });
  if (repetida) return { success: false, error: "Ya hay una cuidadora con ese nombre en este convenio." };
  if (id) {
    const actual = await prisma.convenioCuidadora.findFirst({ where: { id, agreementId } });
    if (!actual) return { success: false, error: "No se encontró la cuidadora." };
    await prisma.convenioCuidadora.update({ where: { id }, data: parsed.data });
    await audit(found.actor.id, "CONVENIO_CUIDADORA", agreementId, { cuidadora: parsed.data.nombre, antes: actual.nombre });
  } else {
    await prisma.convenioCuidadora.create({ data: { agreementId, ...parsed.data, createdById: found.actor.id } });
    await audit(found.actor.id, "CONVENIO_CUIDADORA", agreementId, { cuidadora: parsed.data.nombre, alta: true });
  }
  return { success: true };
}

/** Da de baja (o vuelve a dar de alta) a una cuidadora. Las horas que ya tiene quedan. */
export async function activarCuidadora(user: Actor, agreementId: string, id: string, activa: boolean): Promise<Result> {
  const found = await convenioPara(user, agreementId, "load");
  if ("error" in found) return { success: false, error: found.error! };
  const c = await prisma.convenioCuidadora.findFirst({ where: { id, agreementId } });
  if (!c) return { success: false, error: "No se encontró la cuidadora." };
  await prisma.convenioCuidadora.update({ where: { id }, data: { activa } });
  await audit(found.actor.id, "CONVENIO_CUIDADORA", agreementId, { cuidadora: c.nombre, activa });
  return { success: true };
}

/** Borra una cuidadora cargada por error: solo si no tiene horas. */
export async function borrarCuidadora(user: Actor, agreementId: string, id: string): Promise<Result> {
  const found = await convenioPara(user, agreementId, "load");
  if ("error" in found) return { success: false, error: found.error! };
  const c = await prisma.convenioCuidadora.findFirst({ where: { id, agreementId }, include: { _count: { select: { horas: true } } } });
  if (!c) return { success: false, error: "No se encontró la cuidadora." };
  if (c._count.horas > 0) return { success: false, error: "Tiene horas cargadas: en lugar de borrarla, dala de baja." };
  await prisma.convenioCuidadora.delete({ where: { id } });
  await audit(found.actor.id, "CONVENIO_CUIDADORA_BAJA", agreementId, { cuidadora: c.nombre });
  return { success: true };
}

// ---------------------------------------------------------------------------
// Horas de cada día (conducción y el área)
// ---------------------------------------------------------------------------

/** El nombre del NNyA si está en el padrón o en el Registro Único. */
async function nnyaPorDni(dni: string): Promise<{ dni: string; nombre: string | null } | null> {
  const limpio = /^\d+$/.test(dni) ? dni : null;
  const [padron, persona] = await Promise.all([
    limpio ? prisma.padronUnificado.findUnique({ where: { dni: limpio }, select: { nombre_completo: true } }) : null,
    prisma.person.findUnique({ where: { dni }, select: { firstName: true, lastName: true } }),
  ]);
  if (!padron && !persona) return null;
  const nombre = padron?.nombre_completo || (persona ? [persona.lastName, persona.firstName].filter(Boolean).join(", ") : null) || null;
  return { dni, nombre };
}

/** Revisa lo que no depende de la transacción: vigencia, cuidadora, valor hora y NNyA. */
async function revisarFila(convenio: ConvenioControl, data: HorasInput) {
  const inicio = convenio.startDate ? diaDeVencimiento(convenio.startDate) : null;
  const fin = convenio.endDate ? diaDeVencimiento(convenio.endDate) : null;
  if (inicio && data.fecha < inicio) return { error: `El convenio empieza el ${dma(inicio)}.` } as const;
  if (fin && data.fecha > fin) return { error: `El convenio terminó el ${dma(fin)}.` } as const;
  const cuidadora = await prisma.convenioCuidadora.findFirst({ where: { id: data.cuidadoraId, agreementId: convenio.id } });
  if (!cuidadora) return { error: "Elegí una cuidadora de la lista del convenio." } as const;
  const valores = await getValoresHora(convenio.id);
  if (valorDelDia(data.fecha, valores) === null) {
    return { error: `Todavía no hay valor hora para el ${dma(data.fecha)}. Lo carga la conducción, en Ajustes del control.` } as const;
  }
  const nnya = await nnyaPorDni(data.dni);
  if (!nnya) return { error: "Ese DNI no está en el padrón ni en el Registro Único. Cargalo primero con “Cargar persona”." } as const;
  return { cuidadora, nnya } as const;
}

/** Que la cuidadora no pase de 24 h ese día (contando lo que ya tiene, menos la fila que se corrige). */
async function controlarTope(tx: Prisma.TransactionClient, agreementId: string, cuidadoraId: string, nombre: string, fecha: string, horas: number, sinFila?: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`convenio-horas:${cuidadoraId}:${fecha}`}))`;
  const suma = await tx.convenioHora.aggregate({
    where: { agreementId, cuidadoraId, fecha: toDate(fecha), ...(sinFila ? { id: { not: sinFila } } : {}) },
    _sum: { horas: true },
  });
  const ya = Number(suma._sum.horas ?? 0);
  if (ya + horas > MAX_HORAS_DIA) {
    throw new AvisoError(`${nombre} ya tiene ${horasTexto(ya)} el ${dma(fecha)}: con estas pasaría de ${MAX_HORAS_DIA} horas en el día.`);
  }
}

export async function agregarHoras(user: Actor, agreementId: string, raw: Record<string, unknown>): Promise<Result> {
  const found = await convenioPara(user, agreementId, "load");
  if ("error" in found) return { success: false, error: found.error! };
  const parsed = parseHoras(raw, todayInArgentina());
  if (!parsed.ok) return { success: false, error: parsed.error };
  const data = parsed.data;
  const check = await revisarFila(found.convenio, data);
  if ("error" in check) return { success: false, error: check.error! };
  if (!check.cuidadora.activa) return { success: false, error: `${check.cuidadora.nombre} está dada de baja en este convenio.` };
  try {
    const fila = await prisma.$transaction(async (tx) => {
      await controlarTope(tx, agreementId, data.cuidadoraId, check.cuidadora.nombre, data.fecha, data.horas);
      return tx.convenioHora.create({
        data: { ...data, agreementId, fecha: toDate(data.fecha), nombre: check.nnya.nombre, createdById: found.actor.id },
      });
    });
    await audit(found.actor.id, "CONVENIO_HORAS_ALTA", agreementId, { fila: fila.id, fecha: data.fecha, cuidadora: check.cuidadora.nombre, dni: data.dni, horas: data.horas });
    return { success: true };
  } catch (err) {
    if (err instanceof AvisoError) return { success: false, error: err.message };
    throw err;
  }
}

export async function corregirHoras(user: Actor, filaId: string, raw: Record<string, unknown>): Promise<Result> {
  const actual = await prisma.convenioHora.findUnique({ where: { id: filaId }, include: { cuidadora: { select: { nombre: true } } } });
  if (!actual) return { success: false, error: "Esa fila ya no está. Recargá la página." };
  const found = await convenioPara(user, actual.agreementId, "load");
  if ("error" in found) return { success: false, error: found.error! };
  const parsed = parseHoras(raw, todayInArgentina());
  if (!parsed.ok) return { success: false, error: parsed.error };
  const data = parsed.data;
  const check = await revisarFila(found.convenio, data);
  if ("error" in check) return { success: false, error: check.error! };
  if (!check.cuidadora.activa && check.cuidadora.id !== actual.cuidadoraId) {
    return { success: false, error: `${check.cuidadora.nombre} está dada de baja en este convenio.` };
  }
  try {
    await prisma.$transaction(async (tx) => {
      await controlarTope(tx, actual.agreementId, data.cuidadoraId, check.cuidadora.nombre, data.fecha, data.horas, filaId);
      await tx.convenioHora.update({
        where: { id: filaId },
        data: { ...data, fecha: toDate(data.fecha), nombre: check.nnya.nombre, updatedById: found.actor.id },
      });
    });
  } catch (err) {
    if (err instanceof AvisoError) return { success: false, error: err.message };
    throw err;
  }
  await audit(found.actor.id, "CONVENIO_HORAS_CAMBIO", actual.agreementId, {
    fila: filaId,
    antes: { fecha: isoDe(actual.fecha), cuidadora: actual.cuidadora.nombre, dni: actual.dni, horas: Number(actual.horas), lugar: actual.lugar },
    despues: { fecha: data.fecha, cuidadora: check.cuidadora.nombre, dni: data.dni, horas: data.horas, lugar: data.lugar },
  });
  return { success: true };
}

export async function borrarHoras(user: Actor, filaId: string): Promise<Result> {
  const actual = await prisma.convenioHora.findUnique({ where: { id: filaId }, include: { cuidadora: { select: { nombre: true } } } });
  if (!actual) return { success: false, error: "Esa fila ya no está. Recargá la página." };
  const found = await convenioPara(user, actual.agreementId, "load");
  if ("error" in found) return { success: false, error: found.error! };
  await prisma.convenioHora.delete({ where: { id: filaId } });
  await audit(found.actor.id, "CONVENIO_HORAS_BAJA", actual.agreementId, {
    fila: filaId, fecha: isoDe(actual.fecha), cuidadora: actual.cuidadora.nombre, dni: actual.dni, horas: Number(actual.horas),
  });
  return { success: true };
}

/**
 * Copia al día elegido las horas del día anterior (para quien sigue con acompañamiento).
 * Saltea lo que ya está cargado ese día (misma cuidadora y NNyA) y las cuidadoras dadas de baja.
 */
export async function repetirDiaAnterior(
  user: Actor,
  agreementId: string,
  rawDia: unknown
): Promise<{ success: true; copiadas: number; salteadas: number } | { success: false; error: string }> {
  const found = await convenioPara(user, agreementId, "load");
  if ("error" in found) return { success: false, error: found.error! };
  const dia = parseDia(rawDia);
  if (!dia) return { success: false, error: "Elegí el día." };
  if (dia > todayInArgentina()) return { success: false, error: "No se pueden cargar horas de días que todavía no pasaron." };
  const anterior = addDays(dia, -1);
  const [previas, yaCargadas] = await Promise.all([
    prisma.convenioHora.findMany({ where: { agreementId, fecha: toDate(anterior) }, include: { cuidadora: true }, orderBy: { createdAt: "asc" } }),
    prisma.convenioHora.findMany({ where: { agreementId, fecha: toDate(dia) }, select: { cuidadoraId: true, dni: true } }),
  ]);
  if (previas.length === 0) return { success: false, error: `El ${dma(anterior)} no tiene horas cargadas para repetir.` };
  const ya = new Set(yaCargadas.map((r) => `${r.cuidadoraId}|${r.dni}`));
  const aCopiar = previas.filter((p) => p.cuidadora.activa && !ya.has(`${p.cuidadoraId}|${p.dni}`));
  const salteadas = previas.length - aCopiar.length;
  if (aCopiar.length === 0) return { success: false, error: "Todo lo del día anterior ya está cargado en este día." };
  const check = await revisarFila(found.convenio, {
    fecha: dia, cuidadoraId: aCopiar[0].cuidadoraId, dni: aCopiar[0].dni, horas: 1, lugar: "OTRO", lugarDetalle: null, observacion: null,
  });
  if ("error" in check) return { success: false, error: check.error! };
  try {
    await prisma.$transaction(async (tx) => {
      for (const p of aCopiar) {
        await controlarTope(tx, agreementId, p.cuidadoraId, p.cuidadora.nombre, dia, Number(p.horas));
        await tx.convenioHora.create({
          data: {
            agreementId, fecha: toDate(dia), cuidadoraId: p.cuidadoraId, dni: p.dni, nombre: p.nombre, horas: p.horas,
            lugar: p.lugar, lugarDetalle: p.lugarDetalle, createdById: found.actor.id,
          },
        });
      }
    });
  } catch (err) {
    if (err instanceof AvisoError) return { success: false, error: err.message };
    throw err;
  }
  await audit(found.actor.id, "CONVENIO_HORAS_REPETIR", agreementId, { fecha: dia, desde: anterior, filas: aCopiar.length });
  return { success: true, copiadas: aCopiar.length, salteadas };
}

