import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { todayInArgentina } from "@/lib/follow-up-dates";
import { findPadronProgram, isPadronProgramColumn, PADRON_PROGRAMS, type PadronProgramColumn } from "@/lib/padron-programs";
import { canManageProgram } from "@/lib/program-ownership";
import {
  CURSO_LIMITS, canChooseCursoArea, canCreateCursos, canDeleteCurso, canManageCurso, cleanTexto, diaISO, isAsistenciaEstado,
  parseCursoInput, parseDia, periodoTexto, resumenAsistencia, tieneCertificado, cursoTipoLabel, type AsistenciaResumen,
} from "@/lib/cursos";
import { enrollInProgramTx, isInProgram, withdrawFromProgram } from "@/services/program-enrollment";

// Cursos y talleres: el curso, sus inscriptos (que quedan de alta en el programa del curso, si tiene),
// las clases con su asistencia y quién llega al certificado. Cada cambio queda en Auditoría.

type Actor = { id?: string | null; role?: string | null };
type Result = { success: true } | { success: false; error: string };

/** Un error para mostrar que corta la transacción (la inscripción no queda a medias). */
class AvisoError extends Error {}

const SESSION_EXPIRED = "Tu sesión expiró. Volvé a iniciar sesión.";
const NO_PERMISSION = "Lo cambian la conducción, quien creó el curso y las personas de su área.";

/** El usuario según la base (rol y área al día), si está activo. */
async function actorFromDb(user: Actor) {
  if (!user.id) return null;
  const u = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, role: true, areaId: true, isActive: true, name: true } });
  return u?.isActive ? u : null;
}

async function audit(userId: string, action: string, cursoId: string, details: string) {
  await prisma.auditLog.create({ data: { userId, action, entity: "Curso", entityId: cursoId, details } });
}

const dayText = (d: Date) => diaISO(d).split("-").reverse().join("/");

/** El curso y si el usuario lo puede manejar (o el mensaje de por qué no). */
async function cursoParaCambiar(user: Actor, cursoId: string) {
  const actor = await actorFromDb(user);
  if (!actor) return { error: SESSION_EXPIRED } as const;
  const curso = await prisma.curso.findUnique({ where: { id: cursoId } });
  if (!curso) return { error: "No se encontró el curso." } as const;
  if (!canManageCurso(actor, curso)) return { error: NO_PERMISSION } as const;
  return { actor, curso } as const;
}

// ---------------------------------------------------------------------------
// Lista de cursos
// ---------------------------------------------------------------------------

export type CursoFila = {
  id: string;
  nombre: string;
  tipo: string;
  estado: string;
  area: string | null;
  programa: string | null;
  docente: string | null;
  lugar: string | null;
  horario: string | null;
  periodo: string;
  inscriptos: number;
  clases: number;
  /** Asistencia de todo el curso (presentes sobre presentes y ausentes), o null si no hay clases anotadas. */
  asistencia: number | null;
};

export type CursosFiltro = { estado?: string; areaId?: string; q?: string };

export async function getCursos(filtro: CursosFiltro = {}): Promise<CursoFila[]> {
  const q = (filtro.q ?? "").trim().slice(0, 80);
  const where: Prisma.CursoWhereInput = {
    ...(filtro.estado === "ABIERTO" || filtro.estado === "TERMINADO" ? { estado: filtro.estado } : {}),
    ...(filtro.areaId ? { areaId: filtro.areaId } : {}),
    ...(q
      ? { OR: [{ nombre: { contains: q, mode: "insensitive" } }, { docente: { contains: q, mode: "insensitive" } }, { lugar: { contains: q, mode: "insensitive" } }] }
      : {}),
  };
  const cursos = await prisma.curso.findMany({
    where,
    orderBy: [{ estado: "asc" }, { fechaInicio: "desc" }, { nombre: "asc" }],
    take: 300,
    include: {
      area: { select: { name: true } },
      _count: { select: { clases: true, inscriptos: { where: { estado: "INSCRIPTO" } } } },
    },
  });
  const ids = cursos.map((c) => c.id);
  const totals = ids.length
    ? await prisma.$queryRaw<{ cursoId: string; presentes: bigint; ausentes: bigint }[]>`
        SELECT cl."cursoId",
               COUNT(*) FILTER (WHERE a.estado = 'PRESENTE') AS presentes,
               COUNT(*) FILTER (WHERE a.estado = 'AUSENTE') AS ausentes
        FROM curso_asistencias a JOIN curso_clases cl ON cl.id = a."claseId"
        WHERE cl."cursoId" IN (${Prisma.join(ids)})
        GROUP BY cl."cursoId"`
    : [];
  const byCurso = new Map(totals.map((t) => [t.cursoId, t]));
  return cursos.map((c) => {
    const t = byCurso.get(c.id);
    const presentes = Number(t?.presentes ?? 0);
    const base = presentes + Number(t?.ausentes ?? 0);
    return {
      id: c.id,
      nombre: c.nombre,
      tipo: c.tipo,
      estado: c.estado,
      area: c.area?.name ?? null,
      programa: c.programa ? findPadronProgram(c.programa)?.label ?? null : null,
      docente: c.docente,
      lugar: c.lugar,
      horario: c.horario,
      periodo: periodoTexto(diaISO(c.fechaInicio), c.fechaFin ? diaISO(c.fechaFin) : null),
      inscriptos: c._count.inscriptos,
      clases: c._count.clases,
      asistencia: base ? Math.round((presentes / base) * 100) : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Un curso
// ---------------------------------------------------------------------------

export type InscriptoFila = {
  id: string;
  dni: string;
  nombre: string | null;
  telefono: string | null;
  fecha: string;
  estado: string;
  bajaFecha: string | null;
  bajaMotivo: string | null;
  asistencia: AsistenciaResumen;
  certificado: boolean;
};

export type ClaseFila = { id: string; fecha: string; tema: string | null; presentes: number; ausentes: number; avisos: number };

export async function getCurso(id: string) {
  const curso = await prisma.curso.findUnique({
    where: { id },
    include: {
      area: { select: { id: true, name: true } },
      inscriptos: { orderBy: [{ nombre: "asc" }, { dni: "asc" }], include: { asistencias: { select: { estado: true } } } },
      clases: { orderBy: { fecha: "desc" }, include: { asistencias: { select: { estado: true } } } },
    },
  });
  if (!curso) return null;
  const creador = curso.createdById
    ? await prisma.user.findUnique({ where: { id: curso.createdById }, select: { name: true, username: true } })
    : null;
  const inscriptos: InscriptoFila[] = curso.inscriptos.map((i) => {
    const asistencia = resumenAsistencia(i.asistencias.map((a) => a.estado));
    return {
      id: i.id,
      dni: i.dni,
      nombre: i.nombre,
      telefono: i.telefono,
      fecha: diaISO(i.fecha),
      estado: i.estado,
      bajaFecha: i.bajaFecha ? diaISO(i.bajaFecha) : null,
      bajaMotivo: i.bajaMotivo,
      asistencia,
      certificado: tieneCertificado(curso, i, asistencia),
    };
  });
  const clases: ClaseFila[] = curso.clases.map((c) => {
    const r = resumenAsistencia(c.asistencias.map((a) => a.estado));
    return { id: c.id, fecha: diaISO(c.fecha), tema: c.tema, presentes: r.presentes, ausentes: r.ausentes, avisos: r.avisos };
  });
  const total = resumenAsistencia(curso.inscriptos.flatMap((i) => i.asistencias.map((a) => a.estado)));
  return {
    id: curso.id,
    nombre: curso.nombre,
    tipo: curso.tipo,
    descripcion: curso.descripcion,
    areaId: curso.areaId,
    area: curso.area?.name ?? null,
    programa: curso.programa && isPadronProgramColumn(curso.programa) ? curso.programa : null,
    programaLabel: curso.programa ? findPadronProgram(curso.programa)?.label ?? null : null,
    docente: curso.docente,
    lugar: curso.lugar,
    horario: curso.horario,
    fechaInicio: diaISO(curso.fechaInicio),
    fechaFin: curso.fechaFin ? diaISO(curso.fechaFin) : null,
    cargaHoraria: curso.cargaHoraria,
    asistenciaMinima: curso.asistenciaMinima,
    estado: curso.estado,
    terminadoAt: curso.terminadoAt,
    createdById: curso.createdById,
    creador: creador?.name || creador?.username || null,
    inscriptos,
    clases,
    asistenciaTotal: total.porcentaje,
  };
}

export type CursoDetalle = NonNullable<Awaited<ReturnType<typeof getCurso>>>;

/** Las áreas y los programas para el formulario. Solo los programas en los que el usuario puede dar altas. */
export async function getCursoFormOptions(user: Actor & { areaId?: string | null }) {
  const [areas, owners] = await Promise.all([
    prisma.area.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.programaArea.findMany({ where: { areaId: { not: null } }, select: { programa: true, areaId: true } }),
  ]);
  const ownerOf = new Map(owners.map((o) => [o.programa, o.areaId]));
  const programas = PADRON_PROGRAMS.filter((p) => canManageProgram(user, ownerOf.get(p.column) ?? null)).map((p) => ({ column: p.column, label: p.label }));
  return { areas, programas };
}

// ---------------------------------------------------------------------------
// Crear, cambiar, terminar y borrar
// ---------------------------------------------------------------------------

/** Revisa área y programa según quién carga. Devuelve el área que queda o el error. */
async function checkAreaYPrograma(
  actor: { role: string; areaId: string | null },
  areaId: string | null,
  programa: PadronProgramColumn | null,
  programaAntes: string | null
): Promise<{ areaId: string | null } | { error: string }> {
  let area = areaId;
  if (!canChooseCursoArea(actor.role)) area = actor.areaId;
  else if (area && !(await prisma.area.findUnique({ where: { id: area }, select: { id: true } }))) return { error: "No se encontró el área." };
  if (programa && programa !== programaAntes) {
    const owner = await prisma.programaArea.findUnique({ where: { programa }, select: { area: { select: { id: true, name: true } } } });
    if (!canManageProgram(actor, owner?.area?.id)) {
      return { error: `${findPadronProgram(programa)!.label} está a cargo de ${owner?.area?.name ?? "otra área"}. Solo esa área o la conducción pueden sumarle cursos.` };
    }
  }
  return { areaId: area };
}

export async function createCurso(user: Actor, raw: Record<string, unknown>): Promise<Result | { success: true; id: string }> {
  const actor = await actorFromDb(user);
  if (!actor) return { success: false, error: SESSION_EXPIRED };
  if (!canCreateCursos(actor.role)) return { success: false, error: "Tu rol no puede crear cursos." };
  const parsed = parseCursoInput(raw);
  if (!parsed.ok) return { success: false, error: parsed.error };
  const checked = await checkAreaYPrograma(actor, parsed.data.areaId, parsed.data.programa, null);
  if ("error" in checked) return { success: false, error: checked.error };
  const curso = await prisma.curso.create({ data: { ...parsed.data, areaId: checked.areaId, createdById: actor.id } });
  await audit(actor.id, "CURSO_CREADO", curso.id, `${cursoTipoLabel(curso.tipo)} "${curso.nombre}".`);
  return { success: true, id: curso.id };
}

export async function updateCurso(user: Actor, id: string, raw: Record<string, unknown>): Promise<Result> {
  const found = await cursoParaCambiar(user, id);
  if ("error" in found) return { success: false, error: found.error! };
  const { actor, curso } = found;
  const parsed = parseCursoInput(raw);
  if (!parsed.ok) return { success: false, error: parsed.error };
  // Quien no es de la conducción no cambia el área (queda la que tenía).
  const areaPedida = canChooseCursoArea(actor.role) ? parsed.data.areaId : curso.areaId;
  const checked = await checkAreaYPrograma({ ...actor, areaId: canChooseCursoArea(actor.role) ? actor.areaId : curso.areaId }, areaPedida, parsed.data.programa, curso.programa);
  if ("error" in checked) return { success: false, error: checked.error };
  await prisma.curso.update({ where: { id }, data: { ...parsed.data, areaId: checked.areaId } });
  const cambioPrograma = (curso.programa ?? null) !== (parsed.data.programa ?? null);
  await audit(
    actor.id,
    "CURSO_CAMBIADO",
    id,
    `"${parsed.data.nombre}".${cambioPrograma ? ` Programa: ${parsed.data.programa ? findPadronProgram(parsed.data.programa)!.label : "ninguno"}.` : ""}`
  );
  return { success: true };
}

/** Lo da por terminado: desde ahí se imprimen los certificados y no se toma más asistencia. */
export async function terminarCurso(user: Actor, id: string): Promise<Result> {
  const found = await cursoParaCambiar(user, id);
  if ("error" in found) return { success: false, error: found.error! };
  if (found.curso.estado === "TERMINADO") return { success: true };
  await prisma.curso.update({ where: { id }, data: { estado: "TERMINADO", terminadoAt: new Date() } });
  await audit(found.actor.id, "CURSO_TERMINADO", id, `"${found.curso.nombre}".`);
  return { success: true };
}

export async function reabrirCurso(user: Actor, id: string): Promise<Result> {
  const found = await cursoParaCambiar(user, id);
  if ("error" in found) return { success: false, error: found.error! };
  if (found.curso.estado !== "TERMINADO") return { success: true };
  await prisma.curso.update({ where: { id }, data: { estado: "ABIERTO", terminadoAt: null } });
  await audit(found.actor.id, "CURSO_REABIERTO", id, `"${found.curso.nombre}".`);
  return { success: true };
}

/** Lo borra la conducción o quien lo creó, mientras no tenga clases. Las altas en el programa quedan. */
export async function deleteCurso(user: Actor, id: string): Promise<Result> {
  const actor = await actorFromDb(user);
  if (!actor) return { success: false, error: SESSION_EXPIRED };
  const curso = await prisma.curso.findUnique({ where: { id }, include: { _count: { select: { clases: true, inscriptos: true } } } });
  if (!curso) return { success: false, error: "No se encontró el curso." };
  if (!canDeleteCurso(actor, curso)) return { success: false, error: "Lo borra quien lo creó o la conducción." };
  if (curso._count.clases > 0) return { success: false, error: "Ya tiene clases con asistencia. En lugar de borrarlo, dalo por terminado." };
  await prisma.curso.delete({ where: { id } });
  await audit(actor.id, "CURSO_BORRADO", id, `"${curso.nombre}", con ${curso._count.inscriptos} inscriptos.`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Inscriptos
// ---------------------------------------------------------------------------

/**
 * Inscribe a una persona del padrón o del Registro Único. Si el curso es de un programa, la deja de alta
 * en él desde el día de la inscripción (si ya estaba, no se toca).
 */
export async function inscribir(
  user: Actor,
  cursoId: string,
  rawDni: unknown,
  rawDia?: unknown
): Promise<Result | { success: true; nombre: string | null; altaPrograma: string | null }> {
  const found = await cursoParaCambiar(user, cursoId);
  if ("error" in found) return { success: false, error: found.error! };
  const { actor, curso } = found;
  if (curso.estado === "TERMINADO") return { success: false, error: "El curso ya terminó. Para sumar a alguien, volvé a abrirlo." };
  const dni = String(rawDni ?? "").replace(/\D/g, "");
  if (dni.length < 6 || dni.length > 9) return { success: false, error: "Escribí un DNI válido." };
  const hoy = todayInArgentina();
  const diaText = String(rawDia ?? "").trim() || hoy;
  const fecha = parseDia(diaText);
  if (!fecha) return { success: false, error: "Elegí una fecha válida." };
  if (diaText > hoy) return { success: false, error: "La inscripción no puede ser posterior a hoy." };

  const [padron, persona] = await Promise.all([
    prisma.padronUnificado.findUnique({ where: { dni }, select: { nombre_completo: true, telefono: true } }),
    prisma.person.findUnique({ where: { dni }, select: { firstName: true, lastName: true, phone: true } }),
  ]);
  if (!padron && !persona) {
    return { success: false, error: "Ese DNI no está en el padrón ni en el Registro Único. Cargalo primero con “Cargar persona”." };
  }
  if (await prisma.cursoInscripto.findUnique({ where: { cursoId_dni: { cursoId, dni } }, select: { id: true } })) {
    return { success: false, error: "Esa persona ya está inscripta en este curso." };
  }
  const nombre = padron?.nombre_completo || (persona ? [persona.lastName, persona.firstName].filter(Boolean).join(", ") : null) || null;
  const telefono = padron?.telefono || persona?.phone || null;
  const column = curso.programa && isPadronProgramColumn(curso.programa) ? curso.programa : null;

  try {
    const altaPrograma = await prisma.$transaction(async (tx) => {
      await tx.cursoInscripto.create({ data: { cursoId, dni, nombre, telefono, fecha, createdById: actor.id } });
      if (!column) return null;
      const row = await tx.padronUnificado.findUnique({ where: { dni } });
      if (row && isInProgram(row as any, column)) return null;
      const res = await enrollInProgramTx(tx, {
        dni,
        column,
        fecha,
        note: `Inscripción a ${curso.nombre}`,
        userId: actor.id,
        origen: "CURSO",
        detalle: `Inscripción a ${cursoTipoLabel(curso.tipo).toLowerCase()} ${curso.nombre}, desde el ${dayText(fecha)}.`,
      });
      if (!res.success) throw new AvisoError(res.error);
      return findPadronProgram(column)!.label;
    });
    await audit(actor.id, "CURSO_INSCRIPCION", cursoId, JSON.stringify({ dni, nombre, curso: curso.nombre, programa: altaPrograma }));
    return { success: true, nombre, altaPrograma };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { success: false, error: "Esa persona ya está inscripta en este curso." };
    }
    if (err instanceof AvisoError) return { success: false, error: err.message };
    throw err;
  }
}

/** Anota que dejó el curso. Si se pide, también la da de baja del programa del curso. */
export async function marcarDejo(
  user: Actor,
  inscriptoId: string,
  rawMotivo: unknown,
  bajaDelPrograma: boolean
): Promise<Result | { success: true; aviso: string | null }> {
  const ins = await prisma.cursoInscripto.findUnique({ where: { id: inscriptoId } });
  if (!ins) return { success: false, error: "No se encontró a la persona en el curso." };
  const found = await cursoParaCambiar(user, ins.cursoId);
  if ("error" in found) return { success: false, error: found.error! };
  const { actor, curso } = found;
  if (ins.estado === "DEJO") return { success: true, aviso: null };
  const motivo = cleanTexto(rawMotivo, CURSO_LIMITS.motivo);
  if (!motivo) return { success: false, error: "Escribí por qué dejó (por ejemplo: consiguió trabajo, se mudó, no vino más)." };
  const hoy = todayInArgentina();
  await prisma.cursoInscripto.update({ where: { id: inscriptoId }, data: { estado: "DEJO", bajaFecha: parseDia(hoy), bajaMotivo: motivo } });
  await audit(actor.id, "CURSO_DEJO", curso.id, JSON.stringify({ dni: ins.dni, nombre: ins.nombre, curso: curso.nombre, motivo }));

  let aviso: string | null = null;
  if (bajaDelPrograma && curso.programa && isPadronProgramColumn(curso.programa)) {
    const res = await withdrawFromProgram(user, { dni: ins.dni, column: curso.programa, day: hoy, reason: `Dejó ${curso.nombre}: ${motivo}` });
    if (!res.success) aviso = `Quedó anotado que dejó el curso, pero no se pudo dar la baja del programa: ${res.error}`;
  }
  return { success: true, aviso };
}

/** Deshace "dejó el curso" (por ejemplo, si volvió). No vuelve a dar el alta en el programa. */
export async function volverAInscribir(user: Actor, inscriptoId: string): Promise<Result> {
  const ins = await prisma.cursoInscripto.findUnique({ where: { id: inscriptoId } });
  if (!ins) return { success: false, error: "No se encontró a la persona en el curso." };
  const found = await cursoParaCambiar(user, ins.cursoId);
  if ("error" in found) return { success: false, error: found.error! };
  if (ins.estado === "INSCRIPTO") return { success: true };
  await prisma.cursoInscripto.update({ where: { id: inscriptoId }, data: { estado: "INSCRIPTO", bajaFecha: null, bajaMotivo: null } });
  await audit(found.actor.id, "CURSO_REINSCRIPCION", found.curso.id, JSON.stringify({ dni: ins.dni, nombre: ins.nombre, curso: found.curso.nombre }));
  return { success: true };
}

// ---------------------------------------------------------------------------
// Clases y asistencia
// ---------------------------------------------------------------------------

/** Abre la clase de ese día (o la que ya había) para tomar asistencia. */
export async function abrirClase(user: Actor, cursoId: string, rawDia: unknown): Promise<Result | { success: true; id: string }> {
  const found = await cursoParaCambiar(user, cursoId);
  if ("error" in found) return { success: false, error: found.error! };
  const { actor, curso } = found;
  if (curso.estado === "TERMINADO") return { success: false, error: "El curso ya terminó. Para tomar asistencia, volvé a abrirlo." };
  const diaText = String(rawDia ?? "").trim() || todayInArgentina();
  const fecha = parseDia(diaText);
  if (!fecha) return { success: false, error: "Elegí el día de la clase." };
  if (diaText > todayInArgentina()) return { success: false, error: "La asistencia se toma el día de la clase o después, no antes." };
  const clase = await prisma.cursoClase.upsert({
    where: { cursoId_fecha: { cursoId, fecha } },
    create: { cursoId, fecha, createdById: actor.id },
    update: {},
  });
  return { success: true, id: clase.id };
}

export type ClaseAsistenciaFila = { inscriptoId: string; dni: string; nombre: string | null; estado: string | null; dejo: boolean };

/** La clase con la lista para tomar asistencia: quienes estaban inscriptos ese día y quienes ya tienen algo anotado. */
export async function getClase(claseId: string) {
  const clase = await prisma.cursoClase.findUnique({
    where: { id: claseId },
    include: { curso: true, asistencias: { select: { inscriptoId: true, estado: true } } },
  });
  if (!clase) return null;
  const marcadas = new Map(clase.asistencias.map((a) => [a.inscriptoId, a.estado]));
  const inscriptos = await prisma.cursoInscripto.findMany({
    where: {
      cursoId: clase.cursoId,
      OR: [{ id: { in: [...marcadas.keys()] } }, { estado: "INSCRIPTO", fecha: { lte: clase.fecha } }],
    },
    orderBy: [{ nombre: "asc" }, { dni: "asc" }],
  });
  const lista: ClaseAsistenciaFila[] = inscriptos.map((i) => ({
    inscriptoId: i.id,
    dni: i.dni,
    nombre: i.nombre,
    estado: marcadas.get(i.id) ?? null,
    dejo: i.estado === "DEJO",
  }));
  return {
    id: clase.id,
    fecha: diaISO(clase.fecha),
    tema: clase.tema,
    curso: { id: clase.curso.id, nombre: clase.curso.nombre, tipo: clase.curso.tipo, estado: clase.curso.estado, areaId: clase.curso.areaId, createdById: clase.curso.createdById },
    lista,
    tomada: clase.asistencias.length > 0,
  };
}

/**
 * Guarda la asistencia de la clase. A quien estaba inscripto ese día y no se marcó se lo anota ausente,
 * así el porcentaje no queda a medias.
 */
export async function guardarAsistencia(
  user: Actor,
  claseId: string,
  rawMarcas: unknown,
  rawTema: unknown
): Promise<Result | { success: true; presentes: number; ausentes: number; avisos: number }> {
  const clase = await prisma.cursoClase.findUnique({ where: { id: claseId } });
  if (!clase) return { success: false, error: "No se encontró la clase." };
  const found = await cursoParaCambiar(user, clase.cursoId);
  if ("error" in found) return { success: false, error: found.error! };
  const { actor, curso } = found;
  if (curso.estado === "TERMINADO") return { success: false, error: "El curso ya terminó. Para cambiar la asistencia, volvé a abrirlo." };
  const marcas = rawMarcas && typeof rawMarcas === "object" ? (rawMarcas as Record<string, unknown>) : {};

  const actual = await getClase(claseId);
  if (!actual) return { success: false, error: "No se encontró la clase." };
  const estados = new Map<string, string>();
  for (const fila of actual.lista) {
    const marca = marcas[fila.inscriptoId];
    if (isAsistenciaEstado(marca)) estados.set(fila.inscriptoId, marca);
    else if (fila.estado) estados.set(fila.inscriptoId, fila.estado);
    else if (!fila.dejo) estados.set(fila.inscriptoId, "AUSENTE");
  }
  const tema = cleanTexto(rawTema, CURSO_LIMITS.tema);

  await prisma.$transaction([
    prisma.cursoClase.update({ where: { id: claseId }, data: { tema } }),
    ...[...estados.entries()].map(([inscriptoId, estado]) =>
      prisma.cursoAsistencia.upsert({
        where: { claseId_inscriptoId: { claseId, inscriptoId } },
        create: { claseId, inscriptoId, estado, updatedById: actor.id },
        update: { estado, updatedById: actor.id },
      })
    ),
  ]);
  const r = resumenAsistencia([...estados.values()]);
  await audit(actor.id, "CURSO_ASISTENCIA", curso.id, `"${curso.nombre}", clase del ${dayText(clase.fecha)}: ${r.presentes} presentes, ${r.ausentes} ausentes${r.avisos ? `, ${r.avisos} con aviso` : ""}.`);
  return { success: true, presentes: r.presentes, ausentes: r.ausentes, avisos: r.avisos };
}

/** Borra una clase (por ejemplo, si se abrió en un día equivocado), con su asistencia. */
export async function borrarClase(user: Actor, claseId: string): Promise<Result | { success: true; cursoId: string }> {
  const clase = await prisma.cursoClase.findUnique({ where: { id: claseId }, include: { _count: { select: { asistencias: true } } } });
  if (!clase) return { success: false, error: "No se encontró la clase." };
  const found = await cursoParaCambiar(user, clase.cursoId);
  if ("error" in found) return { success: false, error: found.error! };
  if (found.curso.estado === "TERMINADO") return { success: false, error: "El curso ya terminó. Para cambiar las clases, volvé a abrirlo." };
  await prisma.cursoClase.delete({ where: { id: claseId } });
  await audit(found.actor.id, "CURSO_CLASE_BORRADA", clase.cursoId, `"${found.curso.nombre}", clase del ${dayText(clase.fecha)} (${clase._count.asistencias} asistencias anotadas).`);
  return { success: true, cursoId: clase.cursoId };
}

// ---------------------------------------------------------------------------
// Para la ficha de la persona y la página del programa
// ---------------------------------------------------------------------------

export type CursoDePersona = {
  cursoId: string;
  nombre: string;
  tipo: string;
  estado: string;
  periodo: string;
  inscriptoEstado: string;
  asistencia: number | null;
  certificado: boolean;
};

export async function getCursosDePersona(dni: string): Promise<CursoDePersona[]> {
  const rows = await prisma.cursoInscripto.findMany({
    where: { dni },
    include: { curso: true, asistencias: { select: { estado: true } } },
    orderBy: { fecha: "desc" },
    take: 50,
  });
  return rows.map((r) => {
    const asistencia = resumenAsistencia(r.asistencias.map((a) => a.estado));
    return {
      cursoId: r.cursoId,
      nombre: r.curso.nombre,
      tipo: r.curso.tipo,
      estado: r.curso.estado,
      periodo: periodoTexto(diaISO(r.curso.fechaInicio), r.curso.fechaFin ? diaISO(r.curso.fechaFin) : null),
      inscriptoEstado: r.estado,
      asistencia: asistencia.porcentaje,
      certificado: tieneCertificado(r.curso, r, asistencia),
    };
  });
}

export async function getCursosDePrograma(column: PadronProgramColumn) {
  const cursos = await prisma.curso.findMany({
    where: { programa: column },
    orderBy: [{ estado: "asc" }, { fechaInicio: "desc" }],
    take: 20,
    include: { _count: { select: { inscriptos: { where: { estado: "INSCRIPTO" } } } } },
  });
  return cursos.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    estado: c.estado,
    periodo: periodoTexto(diaISO(c.fechaInicio), c.fechaFin ? diaISO(c.fechaFin) : null),
    inscriptos: c._count.inscriptos,
  }));
}
