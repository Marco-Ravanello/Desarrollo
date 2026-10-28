// Cursos y talleres: qué se carga de cada uno, cómo se cuenta la asistencia, quién puede qué y quién
// tiene certificado. Sin acceso a la base: se usa en pantalla y en el servidor.
import type { Role } from "@prisma/client";
import { canManageProgramEnrollment, MANAGEMENT_ROLES } from "@/lib/permissions";
import { isPadronProgramColumn, type PadronProgramColumn } from "@/lib/padron-programs";

export const CURSO_TIPOS = [
  { key: "CURSO", label: "Curso" },
  { key: "TALLER", label: "Taller" },
] as const;
export type CursoTipo = (typeof CURSO_TIPOS)[number]["key"];
export const cursoTipoLabel = (key: string) => CURSO_TIPOS.find((t) => t.key === key)?.label ?? "Curso";

export const CURSO_ESTADOS = { ABIERTO: "En curso", TERMINADO: "Terminado" } as const;
export type CursoEstado = keyof typeof CURSO_ESTADOS;

export const INSCRIPTO_ESTADOS = { INSCRIPTO: "Inscripto", DEJO: "Dejó" } as const;

/** Lo que se anota de cada inscripto en cada clase. "Con aviso" es una falta que no cuenta en contra. */
export const ASISTENCIA_ESTADOS = [
  { key: "PRESENTE", label: "Presente", short: "P" },
  { key: "AUSENTE", label: "Ausente", short: "A" },
  { key: "AVISO", label: "Con aviso", short: "CA" },
] as const;
export type AsistenciaEstado = (typeof ASISTENCIA_ESTADOS)[number]["key"];
export const isAsistenciaEstado = (v: unknown): v is AsistenciaEstado => ASISTENCIA_ESTADOS.some((e) => e.key === v);
export const asistenciaLabel = (key: string) => ASISTENCIA_ESTADOS.find((e) => e.key === key)?.label ?? key;

export const ASISTENCIA_MINIMA_DEFAULT = 75;
export const CURSO_LIMITS = { nombre: 120, descripcion: 1000, docente: 120, lugar: 160, horario: 160, tema: 200, motivo: 300 } as const;
const CARGA_HORARIA_MAX = 2000;

/** "2026-10-30" → medianoche UTC (como las demás fechas de calendario). Null si no es una fecha. */
export function parseDia(value: unknown): Date | null {
  const s = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
}

/** La fecha guardada a medianoche UTC como "AAAA-MM-DD". */
export const diaISO = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

const clean = (v: unknown, max: number) => {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  return s ? s.slice(0, max) : null;
};

export type CursoInput = {
  nombre: string;
  tipo: CursoTipo;
  descripcion: string | null;
  areaId: string | null;
  programa: PadronProgramColumn | null;
  docente: string | null;
  lugar: string | null;
  horario: string | null;
  fechaInicio: Date;
  fechaFin: Date | null;
  cargaHoraria: number | null;
  asistenciaMinima: number;
};

/** Revisa el formulario del curso. Devuelve los datos limpios o el error para mostrar. */
export function parseCursoInput(raw: Record<string, unknown>): { ok: true; data: CursoInput } | { ok: false; error: string } {
  const nombre = clean(raw.nombre, CURSO_LIMITS.nombre);
  if (!nombre) return { ok: false, error: "Escribí el nombre del curso." };
  const tipo = CURSO_TIPOS.find((t) => t.key === raw.tipo)?.key ?? "CURSO";
  const fechaInicio = parseDia(raw.fechaInicio);
  if (!fechaInicio) return { ok: false, error: "Elegí el día en que empieza." };
  const finText = String(raw.fechaFin ?? "").trim();
  const fechaFin = finText ? parseDia(finText) : null;
  if (finText && !fechaFin) return { ok: false, error: "Revisá el día en que termina." };
  if (fechaFin && fechaFin < fechaInicio) return { ok: false, error: "El curso no puede terminar antes de empezar." };

  const horasText = String(raw.cargaHoraria ?? "").trim();
  const cargaHoraria = horasText ? Number(horasText) : null;
  if (cargaHoraria !== null && (!Number.isInteger(cargaHoraria) || cargaHoraria < 1 || cargaHoraria > CARGA_HORARIA_MAX)) {
    return { ok: false, error: "La carga horaria tiene que ser un número entero de horas." };
  }
  const minText = String(raw.asistenciaMinima ?? "").trim();
  const asistenciaMinima = minText ? Number(minText) : ASISTENCIA_MINIMA_DEFAULT;
  if (!Number.isInteger(asistenciaMinima) || asistenciaMinima < 0 || asistenciaMinima > 100) {
    return { ok: false, error: "La asistencia mínima tiene que ser un número entre 0 y 100." };
  }
  const programa = isPadronProgramColumn(raw.programa) ? raw.programa : null;
  const areaId = typeof raw.areaId === "string" && raw.areaId.trim() ? raw.areaId.trim() : null;
  const descripcion = typeof raw.descripcion === "string" ? raw.descripcion.trim().slice(0, CURSO_LIMITS.descripcion) || null : null;

  return {
    ok: true,
    data: {
      nombre,
      tipo,
      descripcion,
      areaId,
      programa,
      docente: clean(raw.docente, CURSO_LIMITS.docente),
      lugar: clean(raw.lugar, CURSO_LIMITS.lugar),
      horario: clean(raw.horario, CURSO_LIMITS.horario),
      fechaInicio,
      fechaFin,
      cargaHoraria,
      asistenciaMinima,
    },
  };
}

export const cleanTexto = (v: unknown, max: number) => clean(v, max);

// ---------------------------------------------------------------------------
// Asistencia y certificado
// ---------------------------------------------------------------------------

export type AsistenciaResumen = {
  presentes: number;
  ausentes: number;
  avisos: number;
  /** Porcentaje de asistencia (presentes sobre presentes y ausentes), o null si todavía no hay clases anotadas. */
  porcentaje: number | null;
};

/** Cuenta la asistencia de un inscripto. Las faltas con aviso no cuentan ni a favor ni en contra. */
export function resumenAsistencia(estados: string[]): AsistenciaResumen {
  const presentes = estados.filter((e) => e === "PRESENTE").length;
  const ausentes = estados.filter((e) => e === "AUSENTE").length;
  const avisos = estados.filter((e) => e === "AVISO").length;
  const base = presentes + ausentes;
  return { presentes, ausentes, avisos, porcentaje: base ? Math.round((presentes / base) * 100) : null };
}

/**
 * ¿Le corresponde el certificado? Con el curso terminado, si sigue inscripto y llegó a la asistencia mínima.
 * Si el curso no pide asistencia (mínimo 0), alcanza con estar inscripto.
 */
export function tieneCertificado(
  curso: { estado: string; asistenciaMinima: number },
  inscripto: { estado: string },
  asistencia: AsistenciaResumen
): boolean {
  if (curso.estado !== "TERMINADO" || inscripto.estado !== "INSCRIPTO") return false;
  if (curso.asistenciaMinima <= 0) return true;
  return asistencia.porcentaje !== null && asistencia.porcentaje >= curso.asistenciaMinima;
}

/** Por qué no tiene certificado (para mostrar al lado del nombre), o null si lo tiene. */
export function motivoSinCertificado(
  curso: { estado: string; asistenciaMinima: number },
  inscripto: { estado: string },
  asistencia: AsistenciaResumen
): string | null {
  if (tieneCertificado(curso, inscripto, asistencia)) return null;
  if (inscripto.estado !== "INSCRIPTO") return "Dejó el curso";
  if (curso.estado !== "TERMINADO") return "El curso no terminó";
  if (asistencia.porcentaje === null) return "Sin asistencia anotada";
  return `No llegó al ${curso.asistenciaMinima} %`;
}

// ---------------------------------------------------------------------------
// Quién puede qué
// ---------------------------------------------------------------------------

type Viewer = { id?: string | null; role?: Role | string | null; areaId?: string | null };
type CursoOwner = { areaId: string | null; createdById: string | null };

/** Crean cursos quienes dan altas en los programas (no Auditoría ni el relevador). */
export const canCreateCursos = (role?: Role | string | null) => canManageProgramEnrollment(role);

/** La conducción elige cualquier área para un curso; el resto, la suya. */
export const canChooseCursoArea = (role?: Role | string | null) => MANAGEMENT_ROLES.includes(role as Role);

/**
 * Inscriben, toman asistencia, cambian y terminan el curso: la conducción, quien lo creó y las personas
 * del área del curso. Un curso sin área lo maneja cualquiera que carga datos.
 */
export function canManageCurso(viewer: Viewer, curso: CursoOwner): boolean {
  if (!canCreateCursos(viewer.role)) return false;
  if (MANAGEMENT_ROLES.includes(viewer.role as Role)) return true;
  if (viewer.id && viewer.id === curso.createdById) return true;
  if (!curso.areaId) return true;
  return Boolean(viewer.areaId) && viewer.areaId === curso.areaId;
}

/** Lo borra la conducción o quien lo creó, y solo si todavía no tiene clases (si no, se da por terminado). */
export function canDeleteCurso(viewer: Viewer, curso: CursoOwner): boolean {
  if (!canCreateCursos(viewer.role)) return false;
  return MANAGEMENT_ROLES.includes(viewer.role as Role) || (Boolean(viewer.id) && viewer.id === curso.createdById);
}

/** "Del 03/11/2026 al 15/12/2026", "Desde el 03/11/2026". Las fechas vienen como "AAAA-MM-DD". */
export function periodoTexto(inicio: string, fin: string | null): string {
  const f = (s: string) => s.split("-").reverse().join("/");
  return fin ? `Del ${f(inicio)} al ${f(fin)}` : `Desde el ${f(inicio)}`;
}
