/** "Barrio X", sin repetir la palabra cuando el barrio cargado ya la trae ("Barrio Barrio X"). */
export function barrioLabel(barrio?: string | null): string {
  const b = (barrio || "").trim();
  if (!b) return "";
  return /^(barrio|b[º°]\.?)\s/i.test(b) ? b : `Barrio ${b}`;
}

/** Dirección para mostrar, sin repetir el barrio cuando ya viene en la calle ("Barrio X - Barrio X"). */
export function personAddress(direccion?: string | null, barrio?: string | null, localidad?: string | null): string {
  const calle = (direccion || "").trim();
  const b = (barrio || "").trim();
  if (!calle) return b ? barrioLabel(b) : (localidad || "").trim() || "Sin dirección";
  if (!b || calle.toLowerCase().includes(b.toLowerCase())) return calle;
  return `${calle} - ${barrioLabel(b)}`;
}

/** Apellido y nombre a partir del nombre del padrón ("APELLIDO, NOMBRE" o "APELLIDO NOMBRE"). */
export function splitNombreCompleto(nombre?: string | null): { lastName: string; firstName: string } {
  const text = (nombre || "").trim();
  if (text.includes(",")) {
    const [last, ...rest] = text.split(",");
    return { lastName: last.trim(), firstName: rest.join(",").trim() };
  }
  const [last, ...rest] = text.split(/\s+/);
  return { lastName: last || "", firstName: rest.join(" ") };
}

/**
 * Fecha de nacimiento escrita en el padrón (texto libre) como fecha, si se entiende:
 * "31/12/1980", "31-12-1980" o "1980-12-31". Devuelve "AAAA-MM-DD" o null.
 */
export function parseFechaNacimiento(text?: string | null): string | null {
  const t = (text || "").trim();
  let y: number, m: number, d: number;
  let match = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "AAAA-MM-DD" como "DD/MM/AAAA". */
export function fechaIsoATexto(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Opciones de género para elegir al cargar o editar (es opcional). */
export const GENEROS = ["Femenino", "Masculino", "No binario"] as const;
