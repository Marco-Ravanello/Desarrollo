import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { todayInArgentina } from "@/lib/follow-up-dates";
import { canLoadHours, parseEgreso } from "@/lib/convenio-gasto";
import { camposCambiados, parseFichaNnya, type FichaNnya } from "@/lib/convenio-nnya";
import { edadDe } from "@/lib/grupo-familiar";
import { parseFechaNacimiento, personAddress } from "@/lib/person-display";
import { canEditSocialRecords, hasPermission, PERMISSIONS } from "@/lib/permissions";
import { isSensitiveArea } from "@/lib/sensitive-areas";
import { actorFromDb, audit, getConvenioControl } from "@/services/convenio-gasto";
import { findExistingPersonByDni } from "@/services/people";
import { createPersonRecord, parsePersonDataForm } from "@/services/person-data";
import { createAuditLog } from "@/services/system";

// Cada niño, niña o adolescente de un convenio por horas: se suma desde el Registro Único (o se carga ahí si no está),
// con los datos del acompañamiento; ingreso (su primer día con horas, lo lleva services/convenio-gasto.ts),
// egreso con motivo, y el expediente con el que se sigue. Lo manejan quienes cargan horas.

type Actor = { id?: string | null };
type Result = { success: true } | { success: false; error: string };

const toDate = (dia: string) => new Date(`${dia}T00:00:00.000Z`);
const isoDe = (d: Date) => d.toISOString().slice(0, 10);
const dma = (iso: string) => iso.split("-").reverse().join("/");

const CASE_OPEN = (status: string) => status !== "CERRADO";

export type ExpedienteOpcion = { id: string; title: string; area: string; abierto: boolean };

/** Los datos personales, del padrón o del Registro Único (se corrigen desde su ficha de persona). */
export type DatosPersonales = {
  fechaNacimiento: string | null;
  edad: number | null;
  genero: string | null;
  domicilio: string | null;
  telefono: string | null;
};

export type NnyaDelConvenio = FichaNnya & {
  id: string;
  dni: string;
  nombre: string | null;
  /** Vacío si se sumó y todavía no tiene horas. */
  ingreso: string | null;
  datos: DatosPersonales;
  egreso: string | null;
  motivoEgreso: string | null;
  ultimoDia: string | null;
  horas: number;
  /** El expediente vinculado, si quien mira lo puede ver (los de violencia de género, solo con permiso). */
  expediente: ExpedienteOpcion | null;
  /** Hay un expediente vinculado que quien mira no puede ver: no se muestra ni se cambia. */
  expedienteReservado: boolean;
  opciones: ExpedienteOpcion[];
};

/** Los datos personales de varios DNI: primero el padrón, si no el Registro Único. */
async function datosPersonales(dnis: string[]): Promise<Map<string, DatosPersonales>> {
  const [padron, personas] = await Promise.all([
    prisma.padronUnificado.findMany({
      where: { dni: { in: dnis } },
      select: { dni: true, fecha_nacimiento: true, edad_aprox: true, genero: true, direccion: true, barrio: true, localidad: true, telefono: true },
    }),
    prisma.person.findMany({ where: { dni: { in: dnis } }, select: { dni: true, birthDate: true, gender: true, address: true, phone: true } }),
  ]);
  const out = new Map<string, DatosPersonales>();
  for (const dni of dnis) {
    const p = padron.find((x) => x.dni === dni);
    const r = personas.find((x) => x.dni === dni);
    const fecha = (p ? parseFechaNacimiento(p.fecha_nacimiento) : null) || (r?.birthDate ? r.birthDate.toISOString().slice(0, 10) : null);
    const domicilio = p && (p.direccion || p.barrio || p.localidad) ? personAddress(p.direccion, p.barrio, p.localidad) : r?.address || null;
    out.set(dni, {
      fechaNacimiento: fecha,
      edad: edadDe(fecha, p?.edad_aprox ?? null),
      genero: p?.genero || r?.gender || null,
      domicilio,
      telefono: p?.telefono || r?.phone || null,
    });
  }
  return out;
}

/** Los niños, niñas y adolescentes del convenio, los que siguen primero. Con sus datos y sus expedientes para elegir. */
export async function getNnyaDelConvenio(user: { role?: string | null }, agreementId: string): Promise<NnyaDelConvenio[]> {
  const canSensitive = hasPermission(user.role as never, PERMISSIONS.VIEW_SENSITIVE_CASES);
  const rows = await prisma.convenioNnya.findMany({
    where: { agreementId },
    include: { case: { select: { id: true, title: true, status: true, area: { select: { name: true } } } } },
  });
  if (rows.length === 0) return [];
  const dnis = rows.map((r) => r.dni);
  const [totales, casos, datos] = await Promise.all([
    prisma.convenioHora.groupBy({ by: ["dni"], where: { agreementId, dni: { in: dnis } }, _sum: { horas: true }, _max: { fecha: true } }),
    prisma.case.findMany({
      where: { person: { dni: { in: dnis } } },
      select: { id: true, title: true, status: true, area: { select: { name: true } }, person: { select: { dni: true } } },
      orderBy: { createdAt: "desc" },
    }),
    datosPersonales(dnis),
  ]);
  const visible = (c: { area: { name: string } }) => canSensitive || !isSensitiveArea(c.area.name);
  const opcion = (c: { id: string; title: string; status: string; area: { name: string } }): ExpedienteOpcion => ({
    id: c.id,
    title: c.title,
    area: c.area.name,
    abierto: CASE_OPEN(c.status),
  });

  return rows
    .map((r) => {
      const t = totales.find((x) => x.dni === r.dni);
      const reservado = Boolean(r.case && !visible(r.case));
      return {
        id: r.id,
        dni: r.dni,
        nombre: r.nombre,
        ingreso: r.ingreso ? isoDe(r.ingreso) : null,
        datos: datos.get(r.dni)!,
        motivo: r.motivo,
        interviene: r.interviene,
        obraSocial: r.obraSocial,
        observaciones: r.observaciones,
        egreso: r.egreso ? isoDe(r.egreso) : null,
        motivoEgreso: r.motivoEgreso,
        ultimoDia: t?._max.fecha ? isoDe(t._max.fecha) : null,
        horas: Number(t?._sum.horas ?? 0),
        expediente: r.case && !reservado ? opcion(r.case) : null,
        expedienteReservado: reservado,
        opciones: casos.filter((c) => c.person?.dni === r.dni && visible(c)).map(opcion),
      };
    })
    .sort((a, b) => Number(Boolean(a.egreso)) - Number(Boolean(b.egreso)) || (a.nombre ?? a.dni).localeCompare(b.nombre ?? b.dni, "es"));
}

async function nnyaPara(user: Actor, agreementId: string, nnyaId: string) {
  const actor = await actorFromDb(user);
  if (!actor) return { error: "Tu sesión expiró. Volvé a iniciar sesión." } as const;
  const convenio = await getConvenioControl(agreementId);
  if (!convenio) return { error: "No se encontró el convenio." } as const;
  if (!canLoadHours(actor, convenio)) return { error: "Lo cambian la conducción y las personas del área del convenio." } as const;
  const nnya = await prisma.convenioNnya.findFirst({ where: { id: nnyaId, agreementId } });
  if (!nnya) return { error: "No se encontró a ese niño, niña o adolescente en este convenio. Recargá la página." } as const;
  return { actor, convenio, nnya } as const;
}

/** Egreso: desde ese día no se le cargan horas y deja de contar para la proyección. */
export async function registrarEgreso(user: Actor, agreementId: string, nnyaId: string, raw: Record<string, unknown>, hoy = todayInArgentina()): Promise<Result> {
  const found = await nnyaPara(user, agreementId, nnyaId);
  if ("error" in found) return { success: false, error: found.error! };
  const { actor, nnya } = found;
  if (!nnya.ingreso) return { success: false, error: "Todavía no tiene horas cargadas. Si no sigue en el convenio, sacalo de la lista." };
  const parsed = parseEgreso(raw, isoDe(nnya.ingreso), hoy);
  if (!parsed.ok) return { success: false, error: parsed.error };
  const { fecha, motivo } = parsed.data;
  const despues = await prisma.convenioHora.findFirst({
    where: { agreementId, dni: nnya.dni, fecha: { gt: toDate(fecha) } },
    orderBy: { fecha: "desc" },
    select: { fecha: true },
  });
  if (despues) {
    return { success: false, error: `Tiene horas cargadas hasta el ${dma(isoDe(despues.fecha))}: el egreso tiene que ser ese día o después.` };
  }
  await prisma.convenioNnya.update({ where: { id: nnyaId }, data: { egreso: toDate(fecha), motivoEgreso: motivo } });
  await audit(actor.id, "CONVENIO_NNYA_EGRESO", agreementId, { dni: nnya.dni, fecha: dma(fecha), motivo });
  return { success: true };
}

/** Volvió: se borra el egreso y se le pueden volver a cargar horas. El egreso anterior queda en Auditoría. */
export async function volvioAIngresar(user: Actor, agreementId: string, nnyaId: string): Promise<Result> {
  const found = await nnyaPara(user, agreementId, nnyaId);
  if ("error" in found) return { success: false, error: found.error! };
  const { actor, nnya } = found;
  if (!nnya.egreso) return { success: false, error: "No tiene egreso cargado." };
  await prisma.convenioNnya.update({ where: { id: nnyaId }, data: { egreso: null, motivoEgreso: null } });
  await audit(actor.id, "CONVENIO_NNYA_REINGRESO", agreementId, { dni: nnya.dni, desde: dma(isoDe(nnya.egreso)) });
  return { success: true };
}

/** Vincula (o desvincula, con null) el expediente del niño, niña o adolescente. Solo uno de sus expedientes que quien lo hace pueda ver. */
export async function vincularExpediente(user: Actor & { role?: string | null }, agreementId: string, nnyaId: string, caseId: string | null): Promise<Result> {
  const found = await nnyaPara(user, agreementId, nnyaId);
  if ("error" in found) return { success: false, error: found.error! };
  const { actor, nnya } = found;
  const canSensitive = hasPermission(actor.role, PERMISSIONS.VIEW_SENSITIVE_CASES);
  if (nnya.caseId && !canSensitive) {
    const actual = await prisma.case.findUnique({ where: { id: nnya.caseId }, select: { area: { select: { name: true } } } });
    if (actual && isSensitiveArea(actual.area.name)) return { success: false, error: "No tenés permiso para cambiar este vínculo." };
  }
  if (caseId) {
    const c = await prisma.case.findFirst({
      where: { id: caseId, person: { dni: nnya.dni } },
      select: { id: true, area: { select: { name: true } } },
    });
    if (!c || (!canSensitive && isSensitiveArea(c.area.name))) return { success: false, error: "Elegí uno de sus expedientes." };
  }
  await prisma.convenioNnya.update({ where: { id: nnyaId }, data: { caseId } });
  await audit(actor.id, "CONVENIO_NNYA_EXPEDIENTE", agreementId, { dni: nnya.dni, estado: caseId ? "Vinculado a un expediente" : "Sin expediente" });
  return { success: true };
}

// ---------------------------------------------------------------------------
// Sumar desde el Registro Único, datos del acompañamiento y sacar de la lista
// ---------------------------------------------------------------------------

export type EncontradoEnRegistro = { dni: string; nombre: string; edad: number | null; domicilio: string | null; enConvenio: boolean };

/** "12.345.678" se busca como "12345678"; un pasaporte u otro documento, como se escribió. */
const limpiarDni = (raw: unknown) => {
  const t = String(raw ?? "").trim();
  return /^[\d.\s]+$/.test(t) ? t.replace(/[.\s]/g, "") : t.slice(0, 30).toUpperCase();
};

/** Busca en el padrón y en el Registro Único por DNI o nombre, para sumar al convenio. */
export async function buscarEnRegistro(user: Actor, agreementId: string, q: string): Promise<EncontradoEnRegistro[]> {
  const actor = await actorFromDb(user);
  const convenio = await getConvenioControl(agreementId);
  if (!actor || !convenio || !canLoadHours(actor, convenio)) return [];
  const texto = q.trim().slice(0, 60);
  if (texto.length < 3) return [];
  const dni = limpiarDni(texto);
  const porDni = /^\d{3,}$/.test(dni);
  const patron = `%${(porDni ? dni : texto).replace(/[%_\\]/g, "\\$&")}%`;
  const [padron, personas] = await Promise.all([
    prisma.$queryRaw<{ dni: string; nombre_completo: string | null }[]>`
      SELECT dni, nombre_completo FROM padron_unificado
      WHERE ${porDni ? Prisma.sql`dni LIKE ${patron}` : Prisma.sql`nombre_completo ILIKE ${patron}`}
      ORDER BY nombre_completo LIMIT 8`.catch(() => []),
    prisma.person.findMany({
      where: porDni
        ? { dni: { contains: dni } }
        : { OR: [{ firstName: { contains: texto, mode: "insensitive" } }, { lastName: { contains: texto, mode: "insensitive" } }] },
      select: { dni: true, firstName: true, lastName: true },
      take: 8,
    }),
  ]);
  const vistos = new Map<string, string>();
  for (const p of padron) vistos.set(p.dni, p.nombre_completo || `DNI ${p.dni}`);
  for (const p of personas) if (!vistos.has(p.dni)) vistos.set(p.dni, `${p.lastName}, ${p.firstName}`);
  const dnis = [...vistos.keys()].slice(0, 8);
  if (dnis.length === 0) return [];
  const [datos, ya] = await Promise.all([
    datosPersonales(dnis),
    prisma.convenioNnya.findMany({ where: { agreementId, dni: { in: dnis } }, select: { dni: true } }),
  ]);
  return dnis.map((d) => ({
    dni: d,
    nombre: vistos.get(d)!,
    edad: datos.get(d)?.edad ?? null,
    domicilio: datos.get(d)?.domicilio ?? null,
    enConvenio: ya.some((y) => y.dni === d),
  }));
}

const PERSONA_CAMPOS = ["firstName", "lastName", "fechaNacimiento", "genero", "direccion", "barrio", "localidad", "telefono"] as const;

/**
 * Suma un niño, niña o adolescente al convenio. Si no está en el padrón ni en el Registro Único y vienen sus datos
 * (`nuevo`), lo carga en el Registro Único. Se puede sumar antes de tener horas.
 */
export async function sumarNnya(user: Actor, agreementId: string, raw: Record<string, unknown>): Promise<{ success: true; dni: string; nombre: string } | { success: false; error: string }> {
  const actor = await actorFromDb(user);
  if (!actor) return { success: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  const convenio = await getConvenioControl(agreementId);
  if (!convenio) return { success: false, error: "No se encontró el convenio." };
  if (!canLoadHours(actor, convenio)) return { success: false, error: "Lo cambian la conducción y las personas del área del convenio." };
  const dni = limpiarDni(raw.dni);
  if (!dni) return { success: false, error: "Completá el DNI." };
  const ficha = parseFichaNnya(raw);
  if (await prisma.convenioNnya.findUnique({ where: { agreementId_dni: { agreementId, dni } }, select: { id: true } })) {
    return { success: false, error: "Ya está en la lista de este convenio." };
  }

  let existente = await findExistingPersonByDni(dni);
  let nuevoEnRegistro = false;
  // Si vinieron datos para cargarlo pero ya está, no se pisan sus datos: que lo elijan de la búsqueda.
  if (existente && (raw.nuevo === true || raw.nuevo === "1")) {
    return { success: false, error: `Ese DNI ya está en el Registro Único como ${existente.nombre}. Volvé a buscar y elegilo.` };
  }
  if (!existente) {
    if (raw.nuevo !== true && raw.nuevo !== "1") {
      return { success: false, error: "No está en el padrón ni en el Registro Único. Completá sus datos para cargarlo." };
    }
    if (!canEditSocialRecords(actor.role)) return { success: false, error: "Tu rol no puede cargar personas en el Registro Único." };
    const fd = new FormData();
    for (const k of PERSONA_CAMPOS) fd.set(k, String(raw[k] ?? ""));
    const persona = parsePersonDataForm(fd);
    if ("error" in persona) return { success: false, error: persona.error };
    try {
      const { id } = await createPersonRecord(dni, persona.data);
      await createAuditLog(actor.id, "CREATE", "Person", id, { dni, desde: "convenio" });
    } catch (err: any) {
      if (err?.code !== "P2002") throw err;
    }
    existente = await findExistingPersonByDni(dni);
    nuevoEnRegistro = true;
  }
  const dniGuardado = existente?.id && /^\d+$/.test(existente.id) ? existente.id : dni;

  const [primera, abiertos] = await Promise.all([
    prisma.convenioHora.aggregate({ where: { agreementId, dni: dniGuardado }, _min: { fecha: true } }),
    prisma.case.findMany({ where: { person: { dni: dniGuardado }, status: { not: "CERRADO" } }, select: { id: true }, take: 2 }),
  ]);
  try {
    await prisma.convenioNnya.create({
      data: {
        agreementId,
        dni: dniGuardado,
        nombre: existente?.nombre ?? null,
        ingreso: primera._min.fecha,
        createdById: actor.id,
        caseId: abiertos.length === 1 ? abiertos[0].id : null,
        ...ficha.data,
      },
    });
  } catch (err: any) {
    if (err?.code === "P2002") return { success: false, error: "Ya está en la lista de este convenio." };
    throw err;
  }
  await audit(actor.id, "CONVENIO_NNYA_ALTA", agreementId, {
    dni: dniGuardado,
    registro: nuevoEnRegistro ? "Lo cargaron desde el convenio" : "Ya estaba",
  });
  return { success: true, dni: dniGuardado, nombre: existente?.nombre ?? `DNI ${dniGuardado}` };
}

/** Corrige los datos del acompañamiento. En Auditoría quedan qué datos cambiaron, no sus valores. */
export async function guardarFichaNnya(user: Actor, agreementId: string, nnyaId: string, raw: Record<string, unknown>): Promise<Result> {
  const found = await nnyaPara(user, agreementId, nnyaId);
  if ("error" in found) return { success: false, error: found.error! };
  const { actor, nnya } = found;
  const parsed = parseFichaNnya(raw);
  const campos = camposCambiados(nnya, parsed.data);
  if (campos.length === 0) return { success: false, error: "No cambiaste ningún dato." };
  await prisma.convenioNnya.update({ where: { id: nnyaId }, data: parsed.data });
  await audit(actor.id, "CONVENIO_NNYA_DATOS", agreementId, { dni: nnya.dni, campos: campos.join(", ") });
  return { success: true };
}

/** Saca de la lista a quien se sumó por error: solo si no tiene horas. */
export async function sacarNnya(user: Actor, agreementId: string, nnyaId: string): Promise<Result> {
  const found = await nnyaPara(user, agreementId, nnyaId);
  if ("error" in found) return { success: false, error: found.error! };
  const { actor, nnya } = found;
  const horas = await prisma.convenioHora.count({ where: { agreementId, dni: nnya.dni } });
  if (horas > 0) return { success: false, error: "Tiene horas cargadas: no se saca de la lista. Si dejó el convenio, registrá el egreso." };
  await prisma.convenioNnya.delete({ where: { id: nnyaId } });
  await audit(actor.id, "CONVENIO_NNYA_BAJA", agreementId, { dni: nnya.dni });
  return { success: true };
}
