import prisma from "@/lib/prisma";
import { PADRON_GAPS } from "@/lib/padron-quality";
import { findPadronDuplicates } from "@/services/padron-duplicates";

export type PadronQuality = {
  total: number;
  /** Con dirección con altura, teléfono y punto en el mapa. */
  completos: number;
  sinDireccion: number;
  sinAltura: number;
  sinTelefono: number;
  sinUbicar: number;
  /** De los sin ubicar: falta buscarlos, no se encontraron, o no tienen dirección para buscar. */
  ubicacion: { porBuscar: number; noEncontradas: number; sinDireccion: number };
  /** Pares de posibles duplicados sin revisar. */
  paresDuplicados: number;
};

/** Todo se cuenta en la base con una sola pasada por el padrón (son unas 82.000 personas). */
export async function getPadronQuality(): Promise<PadronQuality> {
  const g = PADRON_GAPS;
  const [rows, duplicates] = await Promise.all([
    prisma.$queryRawUnsafe<Record<string, number>[]>(`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE NOT ${g.direccion.sql} AND NOT ${g.altura.sql} AND NOT ${g.telefono.sql} AND NOT ${g.ubicacion.sql})::int AS completos,
             count(*) FILTER (WHERE ${g.direccion.sql})::int AS sin_direccion,
             count(*) FILTER (WHERE ${g.altura.sql})::int AS sin_altura,
             count(*) FILTER (WHERE ${g.telefono.sql})::int AS sin_telefono,
             count(*) FILTER (WHERE ${g.ubicacion.sql})::int AS sin_ubicar,
             count(*) FILTER (WHERE ${g.ubicacion.sql} AND NOT ${g.direccion.sql} AND (geo_estado IS NULL OR geo_estado = 'SIN_GEOREF'))::int AS por_buscar,
             count(*) FILTER (WHERE ${g.ubicacion.sql} AND NOT ${g.direccion.sql} AND geo_estado = 'NO_ENCONTRADA')::int AS no_encontradas
      FROM padron_unificado
    `),
    findPadronDuplicates({ limit: 0 }).catch(() => ({ total: 0 })),
  ]);
  const r = rows[0] ?? {};
  const n = (k: string) => Number(r[k] ?? 0);
  const sinUbicar = n("sin_ubicar");
  const porBuscar = n("por_buscar");
  const noEncontradas = n("no_encontradas");
  return {
    total: n("total"),
    completos: n("completos"),
    sinDireccion: n("sin_direccion"),
    sinAltura: n("sin_altura"),
    sinTelefono: n("sin_telefono"),
    sinUbicar,
    ubicacion: { porBuscar, noEncontradas, sinDireccion: Math.max(0, sinUbicar - porBuscar - noEncontradas) },
    paresDuplicados: duplicates.total,
  };
}
