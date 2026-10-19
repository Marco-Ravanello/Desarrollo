// Reglas para detectar posibles personas repetidas en el padrón (con DNI distinto).
// Mismo nombre solo no alcanza (hay homónimos): además tiene que coincidir la
// fecha de nacimiento, el domicilio, o el DNI tiene que ser casi igual (un número mal tipeado).

export type DuplicateSignal = "DNI_PARECIDO" | "MISMA_FECHA_NACIMIENTO" | "MISMO_DOMICILIO";

export const SIGNAL_LABELS: Record<DuplicateSignal, string> = {
  DNI_PARECIDO: "DNI casi igual",
  MISMA_FECHA_NACIMIENTO: "Misma fecha de nacimiento",
  MISMO_DOMICILIO: "Mismo domicilio",
};

const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Nombre sin tildes, mayúsculas, signos ni orden: "Pérez, Juan" y "JUAN PEREZ" dan lo mismo. */
export function nameKey(name?: string | null): string {
  const words = stripAccents(name || "")
    .toUpperCase()
    .replace(/[^A-Z ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return words.length >= 2 ? words.sort().join(" ") : "";
}

/** Domicilio comparable: sin tildes, signos ni espacios de más. */
export function addressKey(address?: string | null): string {
  const key = stripAccents(address || "")
    .toUpperCase()
    .replace(/\bN(RO|°|º)?\.?\s*(?=\d)/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Una dirección sin números ("S/D", "SIN DATO", solo el barrio) no sirve para comparar.
  return /\d/.test(key) && key.length >= 5 ? key : "";
}

/** Fecha de nacimiento comparable: solo los números (acepta 01/02/1990, 1990-02-01 escrito igual en los dos). */
export function birthKey(date?: string | null): string {
  const digits = (date || "").replace(/\D/g, "");
  return digits.length >= 6 ? digits : "";
}

const dniDigits = (dni: string) => dni.replace(/\D/g, "");

/** Dos DNI que difieren en un número, en dos números vecinos invertidos, o en un número de más o de menos. */
export function dniLooksMistyped(a: string, b: string): boolean {
  const x = dniDigits(a);
  const y = dniDigits(b);
  if (!x || !y || x === y || x.length < 6 || y.length < 6) return false;
  if (x.length === y.length) {
    const diffs: number[] = [];
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) diffs.push(i);
    if (diffs.length === 1) return true;
    return diffs.length === 2 && diffs[1] === diffs[0] + 1 && x[diffs[0]] === y[diffs[1]] && x[diffs[1]] === y[diffs[0]];
  }
  if (Math.abs(x.length - y.length) !== 1) return false;
  const [long, short] = x.length > y.length ? [x, y] : [y, x];
  for (let i = 0; i < long.length; i++) {
    if (long.slice(0, i) + long.slice(i + 1) === short) return true;
  }
  return false;
}

export type DuplicateCandidate = {
  dni: string;
  nombre_completo: string | null;
  direccion: string | null;
  fecha_nacimiento: string | null;
};

/** Por qué dos personas con el mismo nombre parecen ser la misma. Vacío si no hay motivo suficiente. */
export function duplicateSignals(a: DuplicateCandidate, b: DuplicateCandidate): DuplicateSignal[] {
  const signals: DuplicateSignal[] = [];
  if (dniLooksMistyped(a.dni, b.dni)) signals.push("DNI_PARECIDO");
  const birthA = birthKey(a.fecha_nacimiento);
  if (birthA && birthA === birthKey(b.fecha_nacimiento)) signals.push("MISMA_FECHA_NACIMIENTO");
  const addrA = addressKey(a.direccion);
  if (addrA && addrA === addressKey(b.direccion)) signals.push("MISMO_DOMICILIO");
  return signals;
}

/** El par se guarda siempre en el mismo orden, para reconocerlo al descartarlo. */
export function pairKey(dniA: string, dniB: string): [string, string] {
  return dniA < dniB ? [dniA, dniB] : [dniB, dniA];
}
