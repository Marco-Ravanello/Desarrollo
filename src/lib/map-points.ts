// Puntos del Mapa Social. Para todo el padrón son más de 80.000, así que viajan al navegador
// como texto (DNI y coordenadas separados por coma) y se arman recién en el navegador:
// pesa menos y se lee mucho más rápido que una lista de 160.000 números.

export interface MapStats {
  /** Personas del padrón que cumplen los filtros (tengan o no punto). */
  total: number;
  /** De esas, cuántas tienen un punto en el mapa. */
  located: number;
  /** De las ubicadas, cuántas tienen un punto aproximado (la dirección solo tiene el barrio). */
  approximate: number;
  topBarrio: string;
  topProgram: string;
}

export interface MapData {
  /** DNI de cada punto, en el mismo orden que `coords`. Primero los exactos, después los aproximados. */
  dnis: string[];
  /** Con programas elegidos: a cuáles pertenece cada punto (bit k = programa k), en el orden de `dnis`. */
  programMask?: number[];
  /** Los primeros `exactCount` puntos son exactos; el resto, aproximados (solo barrio). */
  exactCount: number;
  /** Coordenadas planas: [lat0, lon0, lat1, lon1, ...] (5 decimales, ~1 m). */
  coords: number[];
  stats: MapStats;
}

/** Lo mismo que MapData, como viaja del servidor al navegador. */
export interface PackedMapData {
  /** DNI separados por coma. */
  dnis: string;
  /** Coordenadas por 100.000, sin decimales y separadas por coma: lat0,lon0,lat1,lon1… */
  coords: string;
  /** Con programas elegidos: la máscara de cada punto, separadas por coma. */
  programMask?: string;
  exactCount: number;
  stats: MapStats;
}

const split = (s: string | null | undefined) => (s ? s.split(",") : []);

export function unpackMapData(packed: PackedMapData): MapData {
  const dnis = split(packed.dnis);
  const raw = split(packed.coords);
  const coords: number[] = new Array(raw.length);
  for (let i = 0; i < raw.length; i++) coords[i] = Number(raw[i]) / 1e5;
  const data: MapData = { dnis, exactCount: packed.exactCount, coords, stats: packed.stats };
  if (packed.programMask != null) data.programMask = split(packed.programMask).map((m) => Number(m) || 0);
  return data;
}

/** Mapa sin puntos todavía (mientras se cargan), con las cifras que ya se conocen. */
export function emptyMapData(stats: MapStats): MapData {
  return { dnis: [], exactCount: 0, coords: [], stats };
}
