// Control del gasto de un convenio por horas: períodos (del día de corte al día anterior del mes siguiente),
// valor hora con historial, totales del período, proyección al cierre y semáforo. Sin acceso a la base.
import type { Role } from "@prisma/client";
import { MANAGEMENT_ROLES, isEmergencySurveyor } from "@/lib/permissions";
import { addDays } from "@/lib/follow-up-dates";
import { diasEntre } from "@/lib/fechas";

export const COST_MODES = { POR_HORA: "Por hora" } as const;
export type CostMode = keyof typeof COST_MODES;
export const isCostMode = (v: unknown): v is CostMode => typeof v === "string" && v in COST_MODES;

export const LUGARES = {
  HOSPITAL: "Hospital",
  DISPOSITIVO: "Dispositivo",
  DOMICILIO: "Domicilio",
  OTRO: "Otro",
} as const;
export type Lugar = keyof typeof LUGARES;
export const isLugar = (v: unknown): v is Lugar => typeof v === "string" && v in LUGARES;

export const DEFAULT_ALERT_PERCENTS = [70, 85, 95];
/** Horas de un mismo día: no más de 24 por cuidadora. */
export const MAX_HORAS_DIA = 24;
export const GASTO_LIMITS = { nombre: 120, dni: 15, telefono: 40, lugarDetalle: 120, observacion: 1000 };

type Actor = { role?: Role | string | null; areaId?: string | null };
type ConvenioArea = { areaId?: string | null };

/** Configuran el control (valor hora, tope, período): la conducción. */
export const canConfigureCost = (role?: Role | string | null) => MANAGEMENT_ROLES.includes(role as Role);

const sameArea = (user: Actor, convenio: ConvenioArea) => Boolean(user.areaId && convenio.areaId && user.areaId === convenio.areaId);

/** Ven el detalle (NNyA, cuidadoras, cada día): la conducción, Auditoría y las personas del área del convenio. */
export function canViewCostDetail(user: Actor, convenio: ConvenioArea): boolean {
  if (MANAGEMENT_ROLES.includes(user.role as Role) || user.role === "AUDITOR") return true;
  return sameArea(user, convenio) && !isEmergencySurveyor(user.role);
}

/** Cargan y corrigen horas y la lista de cuidadoras: la conducción y el área del convenio (no Auditoría ni el relevador). */
export function canLoadHours(user: Actor, convenio: ConvenioArea): boolean {
  if (MANAGEMENT_ROLES.includes(user.role as Role)) return true;
  return sameArea(user, convenio) && user.role !== "AUDITOR" && !isEmergencySurveyor(user.role);
}

/** Cierran un período terminado: la conducción y la dirección del área del convenio. Reabrir, solo la conducción. */
export function canClosePeriod(user: Actor, convenio: ConvenioArea): boolean {
  if (MANAGEMENT_ROLES.includes(user.role as Role)) return true;
  return user.role === "DIRECTOR_AREA" && sameArea(user, convenio);
}
export const canReopenPeriod = canConfigureCost;

// ---------------------------------------------------------------------------
// Períodos
// ---------------------------------------------------------------------------

export type Periodo = { desde: string; hasta: string };

const pad = (n: number) => String(n).padStart(2, "0");

/** El período que contiene ese día ("AAAA-MM-DD"), si cada uno empieza el día `startDay` del mes. */
export function periodoDe(dia: string, startDay: number): Periodo {
  const y = Number(dia.slice(0, 4));
  const m = Number(dia.slice(5, 7));
  const d = Number(dia.slice(8, 10));
  let year = y;
  let month = m;
  if (d < startDay) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  const desde = `${year}-${pad(month)}-${pad(startDay)}`;
  return { desde, hasta: addDays(siguienteMes(desde), -1) };
}

function siguienteMes(dia: string): string {
  let y = Number(dia.slice(0, 4));
  let m = Number(dia.slice(5, 7)) + 1;
  if (m === 13) {
    m = 1;
    y += 1;
  }
  return `${y}-${pad(m)}-${dia.slice(8, 10)}`;
}

/** El período anterior (-1) o siguiente (+1). */
export function moverPeriodo(p: Periodo, paso: -1 | 1, startDay: number): Periodo {
  return periodoDe(paso === 1 ? addDays(p.hasta, 1) : addDays(p.desde, -1), startDay);
}

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const dma = (iso: string) => `${dm(iso)}/${iso.slice(0, 4)}`;

/** "20/09 al 19/10/2026". */
export function periodoTexto(p: Periodo): string {
  return p.desde.slice(0, 4) === p.hasta.slice(0, 4) ? `${dm(p.desde)} al ${dma(p.hasta)}` : `${dma(p.desde)} al ${dma(p.hasta)}`;
}

export const diasDelPeriodo = (p: Periodo) => diasEntre(p.desde, p.hasta) + 1;

// ---------------------------------------------------------------------------
// Valor hora
// ---------------------------------------------------------------------------

export type ValorHora = { desde: string; valor: number };

/** El valor hora que rige ese día (el último que empezó ese día o antes), o null si todavía no había. */
export function valorHoraDel(dia: string, valores: ValorHora[]): number | null {
  let found: ValorHora | null = null;
  for (const v of valores) {
    if (v.desde <= dia && (!found || v.desde > found.desde)) found = v;
  }
  return found ? found.valor : null;
}

// ---------------------------------------------------------------------------
// Resumen del período
// ---------------------------------------------------------------------------

export type FilaHoras = {
  fecha: string;
  cuidadoraId: string;
  cuidadora: string;
  dni: string;
  nombre: string | null;
  horas: number;
};

export type Nivel = "bien" | "precaucion" | "alerta" | "critico";

export const NIVELES: Record<Nivel, { label: string; tone: "green" | "amber" | "orange" | "rose" }> = {
  bien: { label: "Bajo control", tone: "green" },
  precaucion: { label: "Precaución", tone: "amber" },
  alerta: { label: "Alerta", tone: "orange" },
  critico: { label: "Crítico", tone: "rose" },
};

/** En qué nivel del semáforo está un porcentaje del tope consumido. */
export function nivelDe(porcentaje: number, alertas: number[] = DEFAULT_ALERT_PERCENTS): Nivel {
  const [amarillo, naranja, rojo] = alertas.length === 3 ? alertas : DEFAULT_ALERT_PERCENTS;
  if (porcentaje >= rojo) return "critico";
  if (porcentaje >= naranja) return "alerta";
  if (porcentaje >= amarillo) return "precaucion";
  return "bien";
}

export type Total = { horas: number; importe: number };

export type ResumenPeriodo = {
  periodo: Periodo;
  tope: number | null;
  horas: number;
  gastado: number;
  disponible: number | null;
  porcentaje: number | null;
  nivel: Nivel | null;
  /** Horas de días sin valor hora cargado: no se pueden calcular en pesos. */
  horasSinValor: number;
  /** Días ya pasados (o hoy) del período sin ninguna hora cargada. */
  diasSinHoras: string[];
  /** El último día con horas cargadas y cuántas horas tuvo: la base de la proyección. */
  ultimoDia: { fecha: string; horas: number } | null;
  /** Días del período después del último cargado. */
  diasRestantes: number;
  /** Horas por día que se proyectan: las del último día cargado de los NNyA que siguen (sin egreso). */
  horasBase: number | null;
  /** Lo que se gastaría si sigue como el último día cargado (null si el período ya terminó o no hay horas). */
  proyeccion: number | null;
  /** Cuánto pasaría del tope la proyección (0 si no pasa). */
  excedente: number;
  porDia: { fecha: string; horas: number; importe: number; acumulado: number }[];
  porCuidadora: ({ id: string; nombre: string } & Total)[];
  porNnya: ({ dni: string; nombre: string | null; dias: number } & Total)[];
};

/**
 * Los totales del período: gastado (horas × valor hora de cada día), disponible, semáforo y la proyección
 * al cierre si sigue como el último día cargado, con el valor hora de hoy. Los NNyA que ya egresaron
 * (`egresados`, por DNI) no cuentan para la proyección.
 */
export function resumirPeriodo(input: {
  periodo: Periodo;
  filas: FilaHoras[];
  valores: ValorHora[];
  tope: number | null;
  alertas?: number[];
  hoy: string;
  egresados?: string[];
}): ResumenPeriodo {
  const { periodo, valores, tope, hoy } = input;
  const filas = input.filas.filter((f) => f.fecha >= periodo.desde && f.fecha <= periodo.hasta);
  let horas = 0;
  let gastado = 0;
  let horasSinValor = 0;
  const dias = new Map<string, Total>();
  const cuidadoras = new Map<string, { id: string; nombre: string } & Total>();
  const nnya = new Map<string, { dni: string; nombre: string | null; dias: Set<string> } & Total>();

  for (const f of filas) {
    const valor = valorHoraDel(f.fecha, valores);
    const importe = valor === null ? 0 : round2(f.horas * valor);
    horas += f.horas;
    gastado += importe;
    if (valor === null) horasSinValor += f.horas;
    const d = dias.get(f.fecha) ?? { horas: 0, importe: 0 };
    d.horas += f.horas;
    d.importe += importe;
    dias.set(f.fecha, d);
    const c = cuidadoras.get(f.cuidadoraId) ?? { id: f.cuidadoraId, nombre: f.cuidadora, horas: 0, importe: 0 };
    c.horas += f.horas;
    c.importe += importe;
    cuidadoras.set(f.cuidadoraId, c);
    const n = nnya.get(f.dni) ?? { dni: f.dni, nombre: f.nombre, dias: new Set<string>(), horas: 0, importe: 0 };
    n.horas += f.horas;
    n.importe += importe;
    n.dias.add(f.fecha);
    if (!n.nombre && f.nombre) n.nombre = f.nombre;
    nnya.set(f.dni, n);
  }
  gastado = round2(gastado);

  const porDia: ResumenPeriodo["porDia"] = [];
  let acumulado = 0;
  for (const fecha of [...dias.keys()].sort()) {
    const d = dias.get(fecha)!;
    acumulado = round2(acumulado + d.importe);
    porDia.push({ fecha, horas: d.horas, importe: round2(d.importe), acumulado });
  }

  const hastaHoy = hoy < periodo.hasta ? hoy : periodo.hasta;
  const diasSinHoras: string[] = [];
  for (let dia = periodo.desde; dia <= hastaHoy; dia = addDays(dia, 1)) {
    if (!dias.has(dia)) diasSinHoras.push(dia);
  }

  const ultimo = porDia.length ? porDia[porDia.length - 1] : null;
  const ultimoDia = ultimo ? { fecha: ultimo.fecha, horas: ultimo.horas } : null;
  const egresados = new Set(input.egresados ?? []);
  const horasBase = ultimo
    ? round2(filas.filter((f) => f.fecha === ultimo.fecha && !egresados.has(f.dni)).reduce((sum, f) => sum + f.horas, 0))
    : null;
  const diasRestantes = ultimo ? Math.max(0, diasEntre(ultimo.fecha, periodo.hasta)) : diasDelPeriodo(periodo);
  // Con el valor de hoy (o el del último día del período si ya terminó): un aumento cargado hoy cuenta para lo que falta.
  const valorActual = valorHoraDel(hoy < periodo.hasta ? hoy : periodo.hasta, valores);
  const terminado = hoy > periodo.hasta;
  const proyeccion =
    ultimoDia && horasBase !== null && !terminado && valorActual !== null
      ? round2(gastado + horasBase * valorActual * diasRestantes)
      : terminado
        ? gastado
        : null;
  const porcentaje = tope && tope > 0 ? (gastado / tope) * 100 : null;

  return {
    periodo,
    tope,
    horas: round2(horas),
    gastado,
    disponible: tope === null ? null : round2(tope - gastado),
    porcentaje,
    nivel: porcentaje === null ? null : nivelDe(porcentaje, input.alertas),
    horasSinValor: round2(horasSinValor),
    diasSinHoras,
    ultimoDia,
    diasRestantes,
    horasBase,
    proyeccion,
    excedente: tope !== null && proyeccion !== null ? Math.max(0, round2(proyeccion - tope)) : 0,
    porDia,
    porCuidadora: [...cuidadoras.values()].sort((a, b) => b.importe - a.importe || a.nombre.localeCompare(b.nombre, "es")),
    porNnya: [...nnya.values()]
      .map(({ dias, ...n }) => ({ ...n, dias: dias.size }))
      .sort((a, b) => b.importe - a.importe || (a.nombre ?? "").localeCompare(b.nombre ?? "", "es")),
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Días sueltos agrupados para leerlos rápido: "06/10, 07/10 y 08/10" (con "y N más" si son muchos). */
export function listaDeDias(dias: string[], max = 8): string {
  const shown = dias.slice(0, max).map(dm);
  const extra = dias.length - shown.length;
  if (extra > 0) return `${shown.join(", ")} y ${extra} más`;
  if (shown.length <= 1) return shown.join("");
  return `${shown.slice(0, -1).join(", ")} y ${shown[shown.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Lo que se carga
// ---------------------------------------------------------------------------

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parseDia(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!ISO_DAY.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
}

const texto = (raw: unknown, max: number) => {
  const s = String(raw ?? "").trim().replace(/\s+/g, " ");
  return s ? s.slice(0, max) : null;
};

/** "1.234,50", "1234.5" o "1234,5" → 1234.5. */
export function parseImporte(raw: unknown): number | null {
  let s = String(raw ?? "").trim().replace(/\$/g, "").replace(/\s/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export type ConfigInput = { monthlyCap: number; periodStartDay: number; alertPercents: number[] };

/** Tope, día de corte y alertas del control por horas. */
export function parseConfig(raw: Record<string, unknown>): { ok: true; data: ConfigInput } | { ok: false; error: string } {
  const monthlyCap = parseImporte(raw.monthlyCap);
  if (monthlyCap === null || monthlyCap <= 0) return { ok: false, error: "Escribí el tope de gasto de cada período, en pesos." };
  const periodStartDay = Number(raw.periodStartDay);
  if (!Number.isInteger(periodStartDay) || periodStartDay < 1 || periodStartDay > 28) {
    return { ok: false, error: "El período tiene que empezar un día entre el 1 y el 28." };
  }
  const alertPercents = [raw.alerta1, raw.alerta2, raw.alerta3].map((v) => Number(v));
  if (alertPercents.some((n) => !Number.isInteger(n) || n < 1 || n > 100)) {
    return { ok: false, error: "Los avisos van de 1 a 100 %." };
  }
  if (!(alertPercents[0] < alertPercents[1] && alertPercents[1] < alertPercents[2])) {
    return { ok: false, error: "Los avisos tienen que ir de menor a mayor: precaución, alerta y crítico." };
  }
  return { ok: true, data: { monthlyCap, periodStartDay, alertPercents } };
}

export function parseValorHora(raw: Record<string, unknown>): { ok: true; data: ValorHora } | { ok: false; error: string } {
  const desde = parseDia(raw.desde);
  if (!desde) return { ok: false, error: "Elegí desde qué día rige el valor." };
  const valor = parseImporte(raw.valor);
  if (valor === null || valor <= 0 || valor > 10_000_000) return { ok: false, error: "Escribí el valor de la hora, en pesos." };
  return { ok: true, data: { desde, valor } };
}

export type CuidadoraInput = { nombre: string; dni: string | null; telefono: string | null };

export function parseCuidadora(raw: Record<string, unknown>): { ok: true; data: CuidadoraInput } | { ok: false; error: string } {
  const nombre = texto(raw.nombre, GASTO_LIMITS.nombre);
  if (!nombre) return { ok: false, error: "Escribí el nombre de la cuidadora." };
  const dniRaw = String(raw.dni ?? "").replace(/\D/g, "");
  if (dniRaw && (dniRaw.length < 6 || dniRaw.length > 9)) return { ok: false, error: "El DNI tiene que tener entre 6 y 9 números." };
  return { ok: true, data: { nombre, dni: dniRaw || null, telefono: texto(raw.telefono, GASTO_LIMITS.telefono) } };
}

export type HorasInput = {
  fecha: string;
  cuidadoraId: string;
  dni: string;
  horas: number;
  lugar: Lugar;
  lugarDetalle: string | null;
  observacion: string | null;
};

/** Una fila de horas. El DNI del NNyA se revisa después contra el padrón y el Registro Único. */
export function parseHoras(raw: Record<string, unknown>, hoy: string): { ok: true; data: HorasInput } | { ok: false; error: string } {
  const fecha = parseDia(raw.fecha);
  if (!fecha) return { ok: false, error: "Elegí el día." };
  if (fecha > hoy) return { ok: false, error: "No se pueden cargar horas de días que todavía no pasaron." };
  const cuidadoraId = String(raw.cuidadoraId ?? "").trim();
  if (!cuidadoraId) return { ok: false, error: "Elegí la cuidadora." };
  const dni = String(raw.dni ?? "").trim().toUpperCase();
  if (!dni) return { ok: false, error: "Elegí a qué NNyA acompañó (por DNI)." };
  if (dni.length > GASTO_LIMITS.dni) return { ok: false, error: "Ese DNI no es válido." };
  const horas = parseImporte(raw.horas);
  if (horas === null || horas <= 0) return { ok: false, error: "Escribí cuántas horas fueron." };
  if (horas > MAX_HORAS_DIA) return { ok: false, error: `En un día no puede haber más de ${MAX_HORAS_DIA} horas.` };
  if (Math.round(horas * 2) !== horas * 2) return { ok: false, error: "Las horas van enteras o con media hora (por ejemplo 7,5)." };
  if (!isLugar(raw.lugar)) return { ok: false, error: "Elegí dónde fue: hospital, dispositivo, domicilio u otro." };
  return {
    ok: true,
    data: {
      fecha,
      cuidadoraId,
      dni,
      horas,
      lugar: raw.lugar,
      lugarDetalle: texto(raw.lugarDetalle, GASTO_LIMITS.lugarDetalle),
      observacion: texto(raw.observacion, GASTO_LIMITS.observacion),
    },
  };
}

/** Lo que se ve de una fila de horas: "12 h", "7,5 h". */
export const horasTexto = (h: number) => `${h.toLocaleString("es-AR", { maximumFractionDigits: 2 })} h`;

// ---------------------------------------------------------------------------
// NNyA: ingreso y egreso
// ---------------------------------------------------------------------------

export const NNYA_MOTIVO_MAX = 300;

/** El egreso de un NNyA: el día (desde su ingreso hasta hoy) y un motivo opcional. */
export function parseEgreso(
  raw: Record<string, unknown>,
  ingreso: string,
  hoy: string
): { ok: true; data: { fecha: string; motivo: string | null } } | { ok: false; error: string } {
  const fecha = parseDia(raw.fecha);
  if (!fecha) return { ok: false, error: "Elegí el día del egreso." };
  if (fecha > hoy) return { ok: false, error: "El egreso no puede ser un día que todavía no pasó." };
  if (fecha < ingreso) return { ok: false, error: `El egreso no puede ser antes del ingreso (${ingreso.split("-").reverse().join("/")}).` };
  return { ok: true, data: { fecha, motivo: texto(raw.motivo, NNYA_MOTIVO_MAX) } };
}
