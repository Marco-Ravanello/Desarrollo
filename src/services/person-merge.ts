import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { PADRON_PROGRAMS, programColumnFor } from "@/lib/padron-programs";
import { nombrePropio } from "@/lib/nombres";
import { mergedAuditPrefix, mergedInto, movedSummary, type MergeCandidate, type MergeSide } from "@/lib/person-merge";

export type { MergeCandidate };

// Unir dos fichas de la misma persona en una sola. Queda el DNI `keepDni` y la ficha de `removeDni` se borra;
// todo lo suyo pasa a la que queda: padrón (datos vacíos y programas), Registro Único (expedientes,
// intervenciones, documentos, fichas de tormenta), altas y bajas de programas, cursos, recorridas y convenios.
// Lo usan "Posibles duplicados" y "Unir con otra ficha" en la ficha de la persona.

type Tx = Prisma.TransactionClient;

const splitPrograms = (s?: string | null) => (s || "").split("|").map((p) => p.trim()).filter(Boolean);
const isEmpty = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/** Datos del padrón que se completan con los de la ficha que se une, si están vacíos. */
const FILL_FIELDS = [
  "nombre_completo", "roles", "dnis_familiares", "nombres_familiares", "localidad", "barrio", "direccion",
  "telefono", "email", "fecha_nacimiento", "edad_aprox", "genero",
] as const;

/** Los programas en los que está, con su nombre: por las columnas del padrón y, si no hay, por la lista escrita. */
function padronProgramNames(row: Record<string, unknown> | null): string[] {
  if (!row) return [];
  const byColumn = PADRON_PROGRAMS.filter((p) => Number(row[p.column] || 0) > 0).map((p) => p.label);
  if (byColumn.length) return byColumn;
  return Array.from(
    new Set(
      String(row.programas_activos || "")
        .split(/[|,]/)
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => {
          const col = programColumnFor(x.startsWith("prog_") ? x.slice(5) : x);
          return col ? PADRON_PROGRAMS.find((p) => p.column === col)!.label : x;
        })
    )
  );
}

/** Lo que hay de una ficha, para compararla antes de unir. null si el DNI no está ni en el padrón ni en el Registro Único. */
export async function getMergeSide(dni: string): Promise<MergeSide | null> {
  const clean = (dni || "").trim();
  if (!clean) return null;
  const [padron, person] = await Promise.all([
    prisma.padronUnificado.findUnique({ where: { dni: clean } }),
    prisma.person.findUnique({
      where: { dni: clean },
      select: {
        firstName: true,
        lastName: true,
        address: true,
        phone: true,
        birthDate: true,
        _count: { select: { cases: true, interventions: true, documents: true, stormVictims: true } },
      },
    }),
  ]);
  if (!padron && !person) return null;
  const [cursos, visitas, nnya, horas, tormentaPorDni] = await Promise.all([
    prisma.cursoInscripto.count({ where: { dni: clean } }),
    prisma.recorridaVisita.count({ where: { dni: clean } }),
    prisma.convenioNnya.count({ where: { dni: clean } }),
    prisma.convenioHora.count({ where: { dni: clean } }),
    prisma.stormVictimRecord.count({ where: { dni: clean, personId: null } }),
  ]);
  const nombrePersona = person ? `${person.lastName}, ${person.firstName}`.replace(/^,\s*|,\s*$/g, "").trim() : null;
  return {
    dni: clean,
    nombre: nombrePropio(padron?.nombre_completo?.trim() || nombrePersona || null),
    enPadron: Boolean(padron),
    enRegistro: Boolean(person),
    direccion: [padron?.direccion || person?.address, padron?.localidad].filter(Boolean).join(" · ") || null,
    telefono: padron?.telefono || person?.phone || null,
    nacimiento: padron?.fecha_nacimiento || (person?.birthDate ? person.birthDate.toISOString().slice(0, 10) : null),
    programas: padronProgramNames(padron),
    expedientes: person?._count.cases ?? 0,
    intervenciones: person?._count.interventions ?? 0,
    documentos: person?._count.documents ?? 0,
    cursos,
    visitas,
    fichasTormenta: (person?._count.stormVictims ?? 0) + tormentaPorDni,
    convenios: nnya + horas,
  };
}

/**
 * Otras fichas para unir con `currentDni`: las del mismo nombre primero (sugeridas) y, si se escribe algo,
 * las que coinciden por DNI o por nombre. Como mucho 8.
 */
export async function searchMergeCandidates(currentDni: string, query: string): Promise<MergeCandidate[]> {
  const q = (query || "").trim();
  const digits = q.replace(/\D/g, "");
  const out = new Map<string, MergeCandidate>();
  const add = (c: MergeCandidate) => {
    if (c.dni !== currentDni && !out.has(c.dni) && out.size < 8) out.set(c.dni, c);
  };

  if (!q) {
    // Mismo nombre (sin tildes ni orden) en el padrón, y mismo apellido y primer nombre en el Registro Único.
    const same = await prisma.$queryRaw<{ dni: string; nombre_completo: string | null; direccion: string | null }[]>`
      SELECT p.dni, p.nombre_completo, p.direccion FROM padron_unificado p
      WHERE p.nombre_clave IS NOT NULL
        AND p.nombre_clave = (SELECT nombre_clave FROM padron_unificado WHERE dni = ${currentDni})
        AND p.dni <> ${currentDni}
      ORDER BY p.dni LIMIT 8`;
    same.forEach((r) => add({ dni: r.dni, nombre: nombrePropio(r.nombre_completo), direccion: r.direccion, sugerida: true }));
    const me = await prisma.person.findUnique({ where: { dni: currentDni }, select: { firstName: true, lastName: true } });
    if (me?.firstName && me.lastName) {
      const twins = await prisma.person.findMany({
        where: {
          dni: { not: currentDni },
          // Mismo apellido y el mismo primer nombre ("Marta" y "Marta Beatriz").
          firstName: { startsWith: me.firstName.trim().split(/\s+/)[0], mode: "insensitive" },
          lastName: { equals: me.lastName.trim(), mode: "insensitive" },
        },
        select: { dni: true, firstName: true, lastName: true, address: true },
        take: 8,
      });
      twins.forEach((t) => add({ dni: t.dni, nombre: nombrePropio(`${t.lastName}, ${t.firstName}`), direccion: t.address, sugerida: true }));
    }
    return [...out.values()];
  }

  if (digits.length >= 6) {
    const rows = await prisma.padronUnificado.findMany({
      where: { dni: { startsWith: digits } },
      select: { dni: true, nombre_completo: true, direccion: true },
      take: 8,
      orderBy: { dni: "asc" },
    });
    rows.forEach((r) => add({ dni: r.dni, nombre: nombrePropio(r.nombre_completo), direccion: r.direccion }));
  }
  const people = await prisma.person.findMany({
    where: {
      OR: [
        { dni: { contains: q, mode: "insensitive" } },
        ...(digits.length >= 6 ? [{ dni: { contains: digits } }] : []),
        ...(q.length >= 3 ? [{ lastName: { contains: q, mode: "insensitive" as const } }, { firstName: { contains: q, mode: "insensitive" as const } }] : []),
      ],
    },
    select: { dni: true, firstName: true, lastName: true, address: true },
    take: 8,
  });
  people.forEach((t) => add({ dni: t.dni, nombre: nombrePropio(`${t.lastName}, ${t.firstName}`), direccion: t.address }));
  if (digits.length < 6 && q.length >= 3 && out.size < 8) {
    const rows = await prisma.padronUnificado.findMany({
      where: { nombre_completo: { contains: q, mode: "insensitive" } },
      select: { dni: true, nombre_completo: true, direccion: true },
      take: 8,
      orderBy: { nombre_completo: "asc" },
    });
    rows.forEach((r) => add({ dni: r.dni, nombre: nombrePropio(r.nombre_completo), direccion: r.direccion }));
  }
  return [...out.values()];
}

/** Padrón: se completan los datos vacíos, queda en los programas de las dos y se borra el registro que sobra. */
async function mergePadron(tx: Tx, keepDni: string, removeDni: string) {
  const [keep, remove] = await Promise.all([
    tx.padronUnificado.findUnique({ where: { dni: keepDni } }),
    tx.padronUnificado.findUnique({ where: { dni: removeDni } }),
  ]);
  if (!remove) return null;
  if (!keep) {
    // Solo estaba en el padrón la ficha que se borra: el registro pasa a tener el DNI que queda.
    await tx.padronUnificado.update({ where: { dni: removeDni }, data: { dni: keepDni } });
    return remove;
  }
  const data: Record<string, unknown> = {};
  for (const f of FILL_FIELDS) if (isEmpty(keep[f]) && !isEmpty(remove[f])) data[f] = remove[f];
  if ((keep.latitude == null || keep.longitude == null) && remove.latitude != null && remove.longitude != null) {
    Object.assign(data, {
      latitude: remove.latitude,
      longitude: remove.longitude,
      geo_estado: remove.geo_estado,
      geo_fuente: remove.geo_fuente,
      geo_actualizado: remove.geo_actualizado,
    });
  }
  let flags = 0;
  for (const p of PADRON_PROGRAMS) {
    const value = Math.max(keep[p.column] || 0, remove[p.column] || 0);
    if (value !== keep[p.column]) data[p.column] = value;
    if (value > 0) flags += 1;
  }
  const programs = Array.from(new Set([...splitPrograms(keep.programas_activos), ...splitPrograms(remove.programas_activos)]));
  data.programas_activos = programs.length ? programs.join(" | ") : keep.programas_activos;
  data.cantidad_programas = Math.max(programs.length, flags, keep.cantidad_programas);
  await tx.padronUnificado.update({ where: { dni: keepDni }, data });
  await tx.padronUnificado.delete({ where: { dni: removeDni } });
  return remove;
}

/** Registro Único: todo pasa a la persona que queda, se completan sus datos vacíos y se borra la otra. */
async function mergeRegistro(tx: Tx, keepDni: string, removeDni: string) {
  const [keepPerson, removePerson] = await Promise.all([
    tx.person.findUnique({ where: { dni: keepDni } }),
    tx.person.findUnique({ where: { dni: removeDni } }),
  ]);
  if (!removePerson) return;
  if (!keepPerson) {
    // Solo estaba en el Registro Único la que se borra: pasa a tener el DNI que queda. Si su id era el DNI
    // viejo, cambia también (los expedientes y lo demás la siguen solos).
    const idFree = removePerson.id === removeDni && !(await tx.person.findUnique({ where: { id: keepDni }, select: { id: true } }));
    await tx.person.update({ where: { id: removePerson.id }, data: { dni: keepDni, ...(idFree ? { id: keepDni } : {}) } });
    return;
  }
  const moved = { personId: keepPerson.id };
  await tx.case.updateMany({ where: { personId: removePerson.id }, data: moved });
  await tx.intervention.updateMany({ where: { personId: removePerson.id }, data: moved });
  await tx.stormVictimRecord.updateMany({ where: { personId: removePerson.id }, data: moved });
  await tx.document.updateMany({ where: { personId: removePerson.id }, data: moved });
  const fill: Prisma.PersonUpdateInput = {};
  if (!keepPerson.birthDate && removePerson.birthDate) fill.birthDate = removePerson.birthDate;
  if (!keepPerson.gender && removePerson.gender) fill.gender = removePerson.gender;
  if (!keepPerson.address && removePerson.address) fill.address = removePerson.address;
  if (!keepPerson.phone && removePerson.phone) fill.phone = removePerson.phone;
  if (!keepPerson.email && removePerson.email) fill.email = removePerson.email;
  if (keepPerson.latitude == null && removePerson.latitude != null) {
    fill.latitude = removePerson.latitude;
    fill.longitude = removePerson.longitude;
  }
  if (!keepPerson.familyId && removePerson.familyId) {
    fill.family = { connect: { id: removePerson.familyId } };
    fill.isFamilyHead = removePerson.isFamilyHead;
  }
  await tx.person.delete({ where: { id: removePerson.id } });
  if (Object.keys(fill).length) await tx.person.update({ where: { id: keepPerson.id }, data: fill });
}

/** Cursos: si estaba anotada en el mismo curso con los dos DNI, queda una inscripción con las asistencias de las dos. */
async function mergeCursos(tx: Tx, keepDni: string, removeDni: string) {
  const removed = await tx.cursoInscripto.findMany({ where: { dni: removeDni }, include: { asistencias: true } });
  for (const ins of removed) {
    const twin = await tx.cursoInscripto.findUnique({ where: { cursoId_dni: { cursoId: ins.cursoId, dni: keepDni } }, include: { asistencias: true } });
    if (!twin) {
      await tx.cursoInscripto.update({ where: { id: ins.id }, data: { dni: keepDni } });
      continue;
    }
    const taken = new Set(twin.asistencias.map((a) => a.claseId));
    for (const a of ins.asistencias) {
      if (!taken.has(a.claseId)) await tx.cursoAsistencia.update({ where: { claseId_inscriptoId: { claseId: a.claseId, inscriptoId: ins.id } }, data: { inscriptoId: twin.id } });
    }
    await tx.cursoInscripto.delete({ where: { id: ins.id } });
  }
}

/** Recorridas: si estaba en la misma lista con los dos DNI, queda la visita que tiene resultado. */
async function mergeVisitas(tx: Tx, keepDni: string, removeDni: string) {
  const removed = await tx.recorridaVisita.findMany({ where: { dni: removeDni } });
  for (const v of removed) {
    const twin = await tx.recorridaVisita.findUnique({ where: { recorridaId_dni: { recorridaId: v.recorridaId, dni: keepDni } } });
    if (!twin) {
      await tx.recorridaVisita.update({ where: { id: v.id }, data: { dni: keepDni } });
    } else if (twin.resultado === "PENDIENTE" && v.resultado !== "PENDIENTE") {
      await tx.recorridaVisita.delete({ where: { id: twin.id } });
      await tx.recorridaVisita.update({ where: { id: v.id }, data: { dni: keepDni } });
    } else {
      await tx.recorridaVisita.delete({ where: { id: v.id } });
    }
  }
}

/** Convenios: las horas pasan al DNI que queda; si estaba en el mismo convenio con los dos, queda una ficha. */
async function mergeConvenios(tx: Tx, keepDni: string, removeDni: string) {
  await tx.convenioHora.updateMany({ where: { dni: removeDni }, data: { dni: keepDni } });
  await tx.convenioCuidadora.updateMany({ where: { dni: removeDni }, data: { dni: keepDni } });
  const removed = await tx.convenioNnya.findMany({ where: { dni: removeDni } });
  for (const n of removed) {
    const twin = await tx.convenioNnya.findUnique({ where: { agreementId_dni: { agreementId: n.agreementId, dni: keepDni } }, select: { id: true } });
    if (twin) await tx.convenioNnya.delete({ where: { id: n.id } });
    else await tx.convenioNnya.update({ where: { id: n.id }, data: { dni: keepDni } });
  }
}

/**
 * Une dos fichas en una sola: queda `keepDni` y se borra `removeDni`. Todo en una sola transacción: si algo
 * falla, no cambia nada. Queda en la auditoría (con una copia del registro del padrón que se borra) y en la
 * Historia de la persona que queda.
 */
export async function mergePeople(userId: string, keepDni: string, removeDni: string): Promise<{ moved: string }> {
  const keep = (keepDni || "").trim();
  const remove = (removeDni || "").trim();
  if (!keep || !remove || keep === remove) throw new Error("Elegí dos fichas distintas.");
  const [keepSide, removeSide] = await Promise.all([getMergeSide(keep), getMergeSide(remove)]);
  if (!keepSide || !removeSide) throw new Error("Alguna de las dos fichas ya no existe. Actualizá la página.");
  const moved = movedSummary(removeSide);

  await prisma.$transaction(
    async (tx) => {
      const removedPadron = await mergePadron(tx, keep, remove);
      await mergeRegistro(tx, keep, remove);
      await tx.participacionPrograma.updateMany({ where: { dni: remove }, data: { dni: keep } });
      await tx.padronMovimiento.updateMany({ where: { dni: remove }, data: { dni: keep } });
      await tx.stormVictimRecord.updateMany({ where: { dni: remove }, data: { dni: keep } });
      await mergeCursos(tx, keep, remove);
      await mergeVisitas(tx, keep, remove);
      await mergeConvenios(tx, keep, remove);
      // Quien la tenía como familiar ahora apunta al DNI que queda.
      await tx.$executeRaw`
        UPDATE padron_unificado SET dnis_familiares = regexp_replace(dnis_familiares, ${`(^|[^0-9A-Za-z])${remove}([^0-9A-Za-z]|$)`}, ${`\\1${keep}\\2`}, 'g')
        WHERE dnis_familiares LIKE ${`%${remove}%`}`;
      await tx.padronDuplicadoDescartado.deleteMany({ where: { OR: [{ dni_a: remove }, { dni_b: remove }] } });

      await tx.auditLog.create({
        data: {
          userId,
          action: "PADRON_DUPLICADO_UNIDO",
          entity: "PadronUnificado",
          entityId: keep,
          details: `${mergedAuditPrefix(remove)}${keep}. Pasó: ${moved}.${removedPadron ? ` Registro borrado: ${JSON.stringify(removedPadron)}` : ""}`,
        },
      });
      // En la Historia de la persona que queda ("Cambios de datos").
      await tx.auditLog.create({
        data: {
          userId,
          action: "UPDATE",
          entity: "Persona",
          entityId: keep,
          details: `Se unió con la ficha del DNI ${remove}${removeSide.nombre ? ` (${removeSide.nombre})` : ""}. Pasó: ${moved}.`,
        },
      });
    },
    { timeout: 30000 }
  );
  return { moved };
}

/** Si el DNI fue una ficha que se unió con otra, a qué DNI pasó (para llevar a la ficha que quedó). */
export async function findMergedInto(dni: string): Promise<string | null> {
  const clean = (dni || "").trim();
  if (!clean) return null;
  const log = await prisma.auditLog.findFirst({
    where: { action: "PADRON_DUPLICADO_UNIDO", details: { startsWith: mergedAuditPrefix(clean) } },
    orderBy: { createdAt: "desc" },
    select: { details: true },
  });
  return mergedInto(log?.details, clean);
}
