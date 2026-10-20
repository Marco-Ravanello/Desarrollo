import { cleanDni } from "@/services/ficha-social";

// Cuentas del grupo familiar que no usan la base (se prueban sin base de datos).

export function normalizarDireccion(value: string | null | undefined): string {
  return (value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** "Juan Pérez (Hijo); Ana Gómez" y "30111222, 40222333" → nombre, vínculo y DNI de cada familiar. */
export function parseFamiliaresDeclarados(nombres: string | null, dnis: string | null): { dni: string | null; nombre: string; vinculo: string }[] {
  const listaNombres = (nombres || "").split(";").map((n) => n.trim()).filter(Boolean);
  const listaDnis = (dnis || "").split(/[,;]/).map((d) => cleanDni(d)).filter(Boolean);
  const out = listaNombres.map((item, i) => {
    const match = item.match(/^(.*\S)\s*\(([^()]*)\)$/);
    return { nombre: (match ? match[1] : item).trim(), vinculo: match ? match[2].trim() : "Familiar", dni: listaDnis[i] ?? null };
  });
  // DNIs sin nombre: igual se buscan en el padrón.
  for (const dni of listaDnis.slice(listaNombres.length)) out.push({ dni, nombre: "", vinculo: "Familiar" });
  return out;
}

/** Edad a partir de la fecha de nacimiento del padrón (dd/mm/aaaa o aaaa-mm-dd) o de la edad aproximada. */
export function edadDe(fechaNacimiento: string | null, edadAprox: string | null, now = new Date()): number | null {
  const f = (fechaNacimiento || "").trim();
  let d: Date | null = null;
  let m = f.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = d ? null : f.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d && !isNaN(d.getTime())) {
    let edad = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) edad--;
    if (edad >= 0 && edad < 120) return edad;
  }
  const aprox = parseInt((edadAprox || "").replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(aprox) && aprox >= 0 && aprox < 120 ? aprox : null;
}
