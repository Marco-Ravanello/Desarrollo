// Ver el punto en el mapa mientras se escribe la dirección (idea 157). Sin base de datos, para poder probarlo solo.

import { insideTresDeFebreroBounds } from "@/lib/geocoding";
import { MUNICIPAL_LOCALITIES, TRES_DE_FEBRERO_CENTER } from "@/lib/constants/localities";

/** Cuánto se espera después de la última tecla antes de buscar la dirección. */
export const ADDRESS_PREVIEW_DEBOUNCE_MS = 900;

export type AddressPreview =
  | { status: "UBICADA"; lat: number; lon: number }
  | { status: "SIN_ALTURA" }
  | { status: "NO_ENCONTRADA" }
  | { status: "SIN_SERVICIO" };

export type PickedPoint = { lat: number; lon: number };

/** El punto que se marcó a mano en el formulario, si es un número dentro del partido. */
export function parsePickedPoint(lat: unknown, lon: unknown): PickedPoint | null {
  if (lat === null || lat === undefined || lon === null || lon === undefined || lat === "" || lon === "") return null;
  const la = Number(lat);
  const lo = Number(lon);
  if (!insideTresDeFebreroBounds(la, lo)) return null;
  // Seis decimales alcanzan (unos 10 cm).
  return { lat: Math.round(la * 1e6) / 1e6, lon: Math.round(lo * 1e6) / 1e6 };
}

/** Clave para no buscar dos veces la misma dirección. */
export function addressPreviewKey(direccion: string, localidad: string, barrio: string): string {
  return [direccion, localidad, barrio].map((s) => s.trim().toLowerCase().replace(/\s+/g, " ")).join("|");
}

/** Dónde centrar el mapa si no se encontró la dirección: la localidad o el barrio escritos, o el partido. */
export function startingPointFor(localidad: string | null | undefined, barrio: string | null | undefined): [number, number] {
  const text = `${barrio || ""} ${localidad || ""}`.toLowerCase();
  if (!text.trim()) return TRES_DE_FEBRERO_CENTER;
  const loc = MUNICIPAL_LOCALITIES.find((l) => {
    if (l.id === "all") return false;
    const name = l.name.toLowerCase().replace(/\(.*?\)/g, "").trim();
    return text.includes(name) || text.includes(l.id.replace(/-/g, " "));
  });
  return loc?.coordinates || TRES_DE_FEBRERO_CENTER;
}
