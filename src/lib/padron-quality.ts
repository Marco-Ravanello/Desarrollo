// Qué le falta a cada persona del padrón. Las mismas condiciones sirven para contar (panel de
// calidad de datos) y para listar a quiénes les falta (filtro "falta" del Registro Único).

export const PADRON_GAPS = {
  direccion: {
    label: "Sin dirección",
    hint: "No tienen ninguna dirección cargada.",
    sql: `(direccion IS NULL OR btrim(direccion) = '')`,
  },
  altura: {
    label: "Dirección sin altura",
    hint: "Tienen la calle o el barrio, pero no el número: no se pueden ubicar bien ni visitar.",
    sql: `(direccion IS NOT NULL AND btrim(direccion) <> '' AND direccion_con_altura IS NOT TRUE)`,
  },
  telefono: {
    label: "Sin teléfono",
    hint: "No tienen teléfono, o el que tienen no llega a 6 números.",
    sql: `(telefono IS NULL OR length(regexp_replace(telefono, '[^0-9]', '', 'g')) < 6)`,
  },
  ubicacion: {
    label: "Sin ubicar en el mapa",
    hint: "No tienen punto en el Mapa Social.",
    sql: `(latitude IS NULL OR longitude IS NULL)`,
  },
} as const;

export type PadronGap = keyof typeof PADRON_GAPS;

export function isPadronGap(v: unknown): v is PadronGap {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(PADRON_GAPS, v);
}

/** Porcentaje redondeado a un decimal, para mostrar ("12,5 %"). 0 si no hay total. */
export function share(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}
