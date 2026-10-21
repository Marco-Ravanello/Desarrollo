// Datos que se muestran arriba de todo en un expediente: estado, prioridad,
// cuánto tiempo lleva abierto y cuándo fue la última intervención.

export const CASE_STATUS_LABEL: Record<string, string> = {
  ABIERTO: "Abierto",
  EN_PROCESO: "En proceso",
  DERIVADO: "Derivado",
  CERRADO: "Cerrado",
  PENDIENTE: "Pendiente",
};

export const CASE_PRIORITY_LABEL: Record<string, string> = {
  BAJA: "Prioridad baja",
  MEDIA: "Prioridad media",
  ALTA: "Prioridad alta",
  URGENTE: "Urgente",
};

/** Días sin intervenciones a partir de los cuales un expediente abierto se marca como quieto. */
export const STALE_DAYS = 30;

const TZ = "America/Argentina/Buenos_Aires";
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

/** Días de calendario (hora argentina) entre dos fechas. */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.parse(dayKey(from));
  const b = Date.parse(dayKey(to));
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** "hoy", "1 día", "12 días". */
export function daysText(days: number): string {
  if (days <= 0) return "hoy";
  return days === 1 ? "1 día" : `${days} días`;
}

/** "hoy", "ayer", "hace 12 días". */
export function agoText(days: number): string {
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  return `hace ${days} días`;
}

export function fechaCorta(d: Date): string {
  return d.toLocaleDateString("es-AR", { timeZone: TZ });
}

export type CaseSummary = {
  closed: boolean;
  /** Días que lleva abierto, o que estuvo abierto si ya se cerró. */
  openDays: number;
  /** Días desde la última intervención (null si no tiene ninguna). */
  lastInterventionDays: number | null;
  /** Abierto y sin intervenciones hace STALE_DAYS días o más. */
  stale: boolean;
  /** Días sin movimiento (desde la última intervención o, si no hay, desde la apertura). */
  quietDays: number;
};

export function summarizeCase(input: {
  status: string;
  createdAt: Date;
  closedAt?: Date | null;
  lastInterventionAt?: Date | null;
  now?: Date;
}): CaseSummary {
  const now = input.now ?? new Date();
  const closed = input.status === "CERRADO";
  const end = closed ? input.closedAt ?? now : now;
  const lastInterventionDays = input.lastInterventionAt ? daysBetween(input.lastInterventionAt, now) : null;
  const quietDays = lastInterventionDays ?? daysBetween(input.createdAt, now);
  return {
    closed,
    openDays: daysBetween(input.createdAt, end),
    lastInterventionDays,
    stale: !closed && quietDays >= STALE_DAYS,
    quietDays,
  };
}

const TITLE_TAGS: { prefix: RegExp; label: string }[] = [
  { prefix: /^\s*\[CONTINGENCIA TORMENTA\]\s*/i, label: "Tormenta" },
];

/**
 * Separa la marca entre corchetes que algunos expedientes llevan al principio
 * (por ejemplo "[CONTINGENCIA TORMENTA]") para mostrarla como etiqueta chica.
 * No cambia lo guardado: solo cómo se muestra.
 */
export function splitCaseTitle(title: string): { tag: string | null; title: string } {
  for (const t of TITLE_TAGS) {
    if (t.prefix.test(title)) {
      const rest = title.replace(t.prefix, "").trim();
      return { tag: t.label, title: rest || title };
    }
  }
  return { tag: null, title };
}

/** Los DNI provisorios ("TEMP-…") se cargan cuando la persona no tenía documento a mano. */
export function isProvisionalDni(dni: string | null | undefined): boolean {
  return Boolean(dni?.startsWith("TEMP-"));
}
