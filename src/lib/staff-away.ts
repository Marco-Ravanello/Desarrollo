import { isAwayStatus } from "@/lib/hr-labels";
import { dateToDay } from "@/lib/hr-leaves";

// Si un usuario de la app está de licencia o de vacaciones hoy, según su legajo de RRHH (idea 127).
// Sin base de datos, para poder probarlo solo. Fuera de RRHH solo se dice "de licencia" o "de vacaciones":
// el tipo de licencia (por ejemplo, médica) no se muestra.

export type Away = { kind: "VACACIONES" | "LICENCIA"; /** Último día ("AAAA-MM-DD"), si se sabe. */ until: string | null };

type LeaveLike = { kind: string; startDate: Date; endDate: Date };
type RecordLike = { status: string; statusUntil: Date | null; leaves: LeaveLike[] };

/**
 * Hoy está fuera si tiene una licencia cargada que incluye el día de hoy, o si el legajo figura
 * de licencia o de vacaciones con la vuelta hoy o más adelante (o sin fecha de vuelta).
 * Un legajo de baja no cuenta. `today` es "AAAA-MM-DD" (hora argentina).
 */
export function awayFromRecord(rec: RecordLike, today: string): Away | null {
  if (rec.status === "BAJA") return null;
  const current = rec.leaves
    .filter((l) => dateToDay(l.startDate) <= today && dateToDay(l.endDate) >= today)
    .sort((a, b) => b.endDate.getTime() - a.endDate.getTime())[0];
  if (current) return { kind: current.kind === "VACACIONES" ? "VACACIONES" : "LICENCIA", until: dateToDay(current.endDate) };
  if (isAwayStatus(rec.status)) {
    const until = rec.statusUntil ? dateToDay(rec.statusUntil) : null;
    if (until && until < today) return null; // Ya pasó la fecha de vuelta: falta confirmar en RRHH, pero no se lo trata como ausente.
    return { kind: rec.status === "VACACIONES" ? "VACACIONES" : "LICENCIA", until };
  }
  return null;
}

const shortDay = (day: string) => day.slice(8, 10) + "/" + day.slice(5, 7);

/** "De licencia hasta el 20/11", "De vacaciones" (sin fecha). */
export function awayText(a: Away): string {
  const what = a.kind === "VACACIONES" ? "De vacaciones" : "De licencia";
  return a.until ? `${what} hasta el ${shortDay(a.until)}` : what;
}

/** Lo mismo en minúscula, para seguir una frase: "María está de licencia hasta el 20/11". */
export const awayPhrase = (a: Away) => awayText(a).replace(/^De/, "de");

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Qué cuenta de la app es probablemente la de este legajo: el mismo correo, o el mismo nombre y apellido.
 * Solo una sugerencia: la unión la confirma quien administra RRHH.
 */
export function suggestUserForRecord<T extends { id: string; name: string | null; email: string | null }>(
  rec: { firstName: string; lastName: string; email: string | null },
  users: T[]
): T | null {
  const email = norm(rec.email);
  if (email) {
    const byEmail = users.find((u) => norm(u.email) === email);
    if (byEmail) return byEmail;
  }
  const a = norm(`${rec.firstName} ${rec.lastName}`);
  const b = norm(`${rec.lastName} ${rec.firstName}`);
  const byName = users.filter((u) => {
    const n = norm(u.name).replace(/,/g, "");
    return n === a || n === b;
  });
  return byName.length === 1 ? byName[0] : null;
}
