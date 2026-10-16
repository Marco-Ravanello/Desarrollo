// Filtros del Mapa Social, resueltos en la base (padron_unificado).
// Sin acceso a la base: arma el WHERE y sus parámetros, para poder probarlo aparte.
import { MUNICIPAL_LOCALITIES } from "@/lib/constants/localities";

export interface MapFilters {
  localityId?: string;
  program?: string;
  query?: string;
}

/** Distancia (km) hasta el centro de la localidad para contar a alguien que no la tiene escrita en su dirección. */
export const LOCALITY_RADIUS_KM = 1.8;

export function normalizeMapFilters(input: MapFilters | null | undefined): Required<MapFilters> {
  const localityId = String(input?.localityId || "all");
  return {
    localityId: MUNICIPAL_LOCALITIES.some((l) => l.id === localityId) ? localityId : "all",
    program: String(input?.program || "all").trim().slice(0, 120) || "all",
    query: String(input?.query || "").trim().slice(0, 100),
  };
}

class SqlBuilder {
  params: unknown[] = [];
  param(value: unknown) {
    this.params.push(value);
    return `$${this.params.length}`;
  }
  /** Alguno de los campos contiene alguno de los textos (sin distinguir mayúsculas). */
  contains(fields: string[], terms: string[]) {
    const parts: string[] = [];
    for (const term of terms) {
      const p = this.param(`%${term.toLowerCase()}%`);
      for (const f of fields) parts.push(`LOWER(COALESCE(${f}, '')) LIKE ${p}`);
    }
    return `(${parts.join(" OR ")})`;
  }
}

const LOC = "localidad";
const BARRIO = "barrio";
const DIR = "direccion";

function localityCondition(b: SqlBuilder, localityId: string): string | null {
  const locality = MUNICIPAL_LOCALITIES.find((l) => l.id === localityId);
  if (!locality || locality.id === "all") return null;
  let byText: string;
  switch (locality.id) {
    case "caseros":
      byText = `(${b.contains([LOC, BARRIO, DIR], ["caseros"])} OR ${b.contains([BARRIO], ["derqui"])})`;
      break;
    case "barrio-derqui":
      byText = b.contains([BARRIO, DIR, LOC], ["derqui"]);
      break;
    case "barrio-el-libertador":
      byText = b.contains([BARRIO, LOC, DIR], ["libertador"]);
      break;
    case "barrio-puerta-8":
      byText = `(${b.contains([BARRIO], ["puerta 8", "puerta ocho"])} OR ${b.contains([DIR, LOC], ["puerta 8"])})`;
      break;
    case "ciudadela":
      byText = `(${b.contains([LOC, BARRIO, DIR], ["ciudadela"])} AND NOT ${b.contains([BARRIO], ["norte", "sur", "ejército", "ejercito", "apache"])})`;
      break;
    case "ciudadela-norte":
      byText = `(${b.contains([LOC, BARRIO], ["ciudadela norte"])} OR (${b.contains([BARRIO], ["norte"])} AND ${b.contains([LOC, DIR], ["ciudadela"])}))`;
      break;
    case "ciudadela-sur":
      byText = `(${b.contains([LOC, BARRIO], ["ciudadela sur"])} OR (${b.contains([BARRIO], ["sur"])} AND ${b.contains([LOC, DIR], ["ciudadela"])}))`;
      break;
    case "ejercito-de-los-andes":
      byText = `(${b.contains([BARRIO], ["ejército", "ejercito", "andes", "apache"])} OR ${b.contains([LOC], ["ejército", "apache"])})`;
      break;
    default:
      byText = b.contains([LOC, BARRIO, DIR], [locality.name.split("(")[0].trim()]);
  }
  // Cerca del centro de la localidad (aproximación plana, alcanza para pocos km).
  const lat = b.param(locality.coordinates[0]);
  const lon = b.param(locality.coordinates[1]);
  const radius = b.param(LOCALITY_RADIUS_KM);
  const near = `(latitude IS NOT NULL AND longitude IS NOT NULL AND sqrt(power((latitude - ${lat}::float8) * 111.32, 2) + power((longitude - ${lon}::float8) * 111.32 * cos(radians(${lat}::float8)), 2)) <= ${radius}::float8)`;
  return `(${byText} OR ${near})`;
}

/** WHERE para padron_unificado con los filtros del Mapa Social. */
export function buildMapWhere(input: MapFilters | null | undefined): { where: string; params: unknown[] } {
  const filters = normalizeMapFilters(input);
  const b = new SqlBuilder();
  const conditions: string[] = [];

  const locality = localityCondition(b, filters.localityId);
  if (locality) conditions.push(locality);

  if (filters.program !== "all") {
    const p = b.param(filters.program);
    conditions.push(`EXISTS (SELECT 1 FROM unnest(string_to_array(COALESCE(programas_activos, ''), '|')) AS prog WHERE trim(prog) = ${p})`);
  }

  if (filters.query) {
    const q = filters.query;
    const digits = q.replace(/\D/g, "");
    const parts = [b.contains(["nombre_completo", DIR, BARRIO], [q])];
    if (digits.length >= 3) parts.push(`dni LIKE ${b.param(`%${digits}%`)}`);
    conditions.push(`(${parts.join(" OR ")})`);
  }

  return { where: conditions.length ? conditions.join(" AND ") : "TRUE", params: b.params };
}
