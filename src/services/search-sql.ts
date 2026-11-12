import { Prisma } from "@prisma/client";
import { patronesDeBusqueda } from "@/lib/search-text";

/**
 * Condición para consultas con Prisma.sql: cada palabra buscada tiene que estar en `column`,
 * que ya tiene que venir sin tildes (padron_unificado.texto_busqueda o texto_sin_tildes(...)).
 * Ver src/lib/search-text.ts.
 */
export function palabrasEnSql(column: Prisma.Sql, texto: string): Prisma.Sql {
  const patrones = patronesDeBusqueda(texto);
  if (!patrones.length) return Prisma.sql`TRUE`;
  return Prisma.sql`(${Prisma.join(patrones.map((p) => Prisma.sql`${column} LIKE ${p}`), " AND ")})`;
}

/** Texto de la persona del padrón (nombre, barrio, localidad y dirección) con el alias dado, por ejemplo "p". */
export function textoPadron(alias?: string): Prisma.Sql {
  return alias ? Prisma.raw(`${alias}.texto_busqueda`) : Prisma.raw("texto_busqueda");
}

/**
 * Ids de una tabla común (Person, Case, HRRecord…) cuyas columnas de texto tienen todas las
 * palabras buscadas, sin importar tildes ni orden. Tabla y columnas son nombres fijos del código,
 * nunca lo que escribió la persona.
 */
export async function idsQueCoinciden(
  db: { $queryRaw: <T>(query: Prisma.Sql) => Promise<T> },
  table: '"Person"' | '"Case"' | '"HRRecord"' | '"Agreement"',
  columns: string[],
  texto: string,
  limit: number
): Promise<string[]> {
  const patrones = patronesDeBusqueda(texto);
  if (!patrones.length) return [];
  const cols = columns.map((c) => `"${c}"`).join(", ");
  const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id FROM ${Prisma.raw(table)}
    WHERE ${palabrasEnSql(Prisma.raw(`texto_sin_tildes(concat_ws(' ', ${cols}))`), texto)}
    LIMIT ${limit}`);
  return rows.map((r) => r.id);
}
