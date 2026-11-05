// Preguntas que el Asistente de IA no pudo responder. Las ve solo el Superadmin, juntas por pregunta, para
// saber qué le falta aprender sin esperar a que alguien lo encuentre. Sin acceso a la base.

/** Días que se guarda cada vez que se hizo una pregunta sin respuesta. */
export const UNANSWERED_RETENTION_DAYS = 60;
/** Filas que se leen como mucho para armar la lista (después se juntan por pregunta). */
export const UNANSWERED_MAX_ROWS = 5000;
const MAX_QUESTION = 500;

export type UnansweredReason = "NO_ENTENDIO" | "ERROR";

export const UNANSWERED_REASON_LABEL: Record<UnansweredReason, string> = {
  NO_ENTENDIO: "No la entendió",
  ERROR: "Dio error",
};

/** La misma frase que usa el asistente cuando no encuentra nada (services/ai-assistant.ts, NO_DATA). */
const NO_DATA_MARK = "no encontré datos en la app";

/**
 * Si la respuesta cuenta como "no pudo responder". Solo cuando no encontró ninguna consulta para la pregunta
 * o falló algo. Si la entendió y no hay resultados (nadie con ese nombre, ningún expediente) no se anota.
 */
export function unansweredReason(result: { intent?: string | null; answer?: string | null } | null | undefined): UnansweredReason | null {
  if (!result) return null;
  if (result.intent === "error") return "ERROR";
  if (result.intent === "fallback") return "NO_ENTENDIO";
  if ((result.answer ?? "").toLowerCase().includes(NO_DATA_MARK)) return "NO_ENTENDIO";
  return null;
}

export const HIDDEN_NUMBER = "•••••••";

/** Tapa los números de 7 cifras o más (DNI, CUIL, teléfonos), aunque vengan con puntos, guiones o espacios. */
export function maskLongNumbers(text: string): string {
  return (text ?? "").replace(/\d[\d.\-\s]*\d/g, (m) => {
    const digits = m.replace(/\D/g, "").length;
    return digits < 7 ? m : HIDDEN_NUMBER;
  });
}

/** La pregunta como se guarda: en un renglón, con los números largos tapados y recortada. */
export function cleanUnansweredQuestion(question: string): string {
  return maskLongNumbers((question ?? "").replace(/\s+/g, " ").trim()).slice(0, MAX_QUESTION).trim();
}

/** Para juntar las preguntas iguales: sin mayúsculas, tildes, signos ni espacios de más. */
export function unansweredKey(question: string): string {
  return cleanUnansweredQuestion(question)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ•\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/** Lo que se borra: lo que se preguntó antes de esta fecha. */
export function unansweredCutoff(now = new Date()): Date {
  return new Date(now.getTime() - UNANSWERED_RETENTION_DAYS * 86400000);
}

export type UnansweredRow = {
  question: string;
  key: string;
  reason: string;
  role: string | null;
  areaName: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
};

export type UnansweredGroup = {
  key: string;
  /** Cómo se escribió la última vez. */
  question: string;
  times: number;
  firstAt: Date;
  lastAt: Date;
  errors: number;
  /** Quiénes la hicieron: cada rol con su área, sin repetir. */
  askers: { role: string | null; areaName: string | null }[];
  resolvedAt: Date | null;
};

/** Junta las veces que se hizo cada pregunta. Primero las que más se repiten; entre iguales, la más reciente. */
export function groupUnanswered(rows: UnansweredRow[]): UnansweredGroup[] {
  const byKey = new Map<string, UnansweredGroup & { seen: Set<string> }>();
  for (const r of rows) {
    if (!r.key) continue;
    let g = byKey.get(r.key);
    if (!g) {
      g = {
        key: r.key,
        question: r.question,
        times: 0,
        firstAt: r.createdAt,
        lastAt: r.createdAt,
        errors: 0,
        askers: [],
        resolvedAt: r.resolvedAt,
        seen: new Set(),
      };
      byKey.set(r.key, g);
    }
    g.times += 1;
    if (r.reason === "ERROR") g.errors += 1;
    if (r.createdAt < g.firstAt) g.firstAt = r.createdAt;
    if (r.createdAt >= g.lastAt) {
      g.lastAt = r.createdAt;
      g.question = r.question;
    }
    if (r.resolvedAt && (!g.resolvedAt || r.resolvedAt > g.resolvedAt)) g.resolvedAt = r.resolvedAt;
    const who = `${r.role ?? ""}|${r.areaName ?? ""}`;
    if ((r.role || r.areaName) && !g.seen.has(who)) {
      g.seen.add(who);
      g.askers.push({ role: r.role, areaName: r.areaName });
    }
  }
  return [...byKey.values()]
    .map(({ seen: _seen, ...g }) => g)
    .sort((a, b) => b.times - a.times || b.lastAt.getTime() - a.lastAt.getTime());
}
