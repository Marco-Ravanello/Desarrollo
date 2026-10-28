// El límite de cada barrio en el mapa: si un punto cae adentro, en qué barrio cae y cómo se revisa
// un límite dibujado. Sin acceso a la base: se usa en pantalla y en el servidor.
import type { Role } from "@prisma/client";
import { MANAGEMENT_ROLES } from "@/lib/permissions";
import { TRES_DE_FEBRERO_BOUNDS } from "@/lib/geocoding";

/** Lista de puntos [lat, lng] que se cierra sola. */
export type Limite = [number, number][];

export const LIMITE_MIN_PUNTOS = 3;
export const LIMITE_MAX_PUNTOS = 500;

/** Dibujan y corrigen los límites de los barrios: la conducción. */
export const canEditLimites = (role?: Role | string | null) => MANAGEMENT_ROLES.includes(role as Role);

/** ¿El punto está adentro del límite? (cuenta cuántas veces una línea hacia el este cruza el borde). */
export function puntoDentro(lat: number, lng: number, limite: Limite): boolean {
  let dentro = false;
  for (let i = 0, j = limite.length - 1; i < limite.length; j = i++) {
    const [yi, xi] = limite[i];
    const [yj, xj] = limite[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Superficie aproximada (en grados al cuadrado: solo para comparar barrios entre sí). */
export function superficie(limite: Limite): number {
  let s = 0;
  for (let i = 0, j = limite.length - 1; i < limite.length; j = i++) s += (limite[j][1] + limite[i][1]) * (limite[j][0] - limite[i][0]);
  return Math.abs(s / 2);
}

/**
 * En qué barrio cae un punto. Los barrios chicos (Ejército de los Andes, Puerta 8…) están dentro de una
 * localidad (Ciudadela, Churruca…): se elige el más chico que lo contiene. Null si no cae en ninguno.
 */
export function barrioDelPunto<B extends string>(lat: number, lng: number, limites: [B, Limite][]): B | null {
  let mejor: { barrio: B; area: number } | null = null;
  for (const [barrio, limite] of limites) {
    if (!puntoDentro(lat, lng, limite)) continue;
    const area = superficie(limite);
    if (!mejor || area < mejor.area) mejor = { barrio, area };
  }
  return mejor?.barrio ?? null;
}

/** Margen alrededor del partido para aceptar un punto dibujado (un límite puede pasar justo por el borde). */
const MARGEN = 0.01;

/** Revisa un límite dibujado en el mapa. Devuelve los puntos redondeados o el error para mostrar. */
export function parseLimite(raw: unknown): { ok: true; puntos: Limite } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "No llegó el límite. Probá de nuevo." };
  const puntos: Limite = [];
  for (const p of raw) {
    if (!Array.isArray(p) || p.length !== 2) return { ok: false, error: "El límite tiene un punto mal formado." };
    const [lat, lng] = p.map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, error: "El límite tiene un punto mal formado." };
    const b = TRES_DE_FEBRERO_BOUNDS;
    if (lat < b.south - MARGEN || lat > b.north + MARGEN || lng < b.west - MARGEN || lng > b.east + MARGEN) {
      return { ok: false, error: "El límite tiene puntos fuera de Tres de Febrero." };
    }
    puntos.push([Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5]);
  }
  // Si el último repite al primero (polígono cerrado), se saca: el límite se cierra solo.
  if (puntos.length > 1 && puntos[0][0] === puntos[puntos.length - 1][0] && puntos[0][1] === puntos[puntos.length - 1][1]) puntos.pop();
  if (puntos.length < LIMITE_MIN_PUNTOS) return { ok: false, error: `Marcá al menos ${LIMITE_MIN_PUNTOS} puntos en el mapa.` };
  if (puntos.length > LIMITE_MAX_PUNTOS) return { ok: false, error: `El límite puede tener hasta ${LIMITE_MAX_PUNTOS} puntos.` };
  if (superficie(puntos) === 0) return { ok: false, error: "Los puntos están en línea: marcá un área." };
  return { ok: true, puntos };
}

/** Lo que vuelve de la base (JSON) como límite, o null si no sirve. */
export function limiteDeJson(value: unknown): Limite | null {
  const r = parseLimite(value);
  return r.ok ? r.puntos : null;
}
