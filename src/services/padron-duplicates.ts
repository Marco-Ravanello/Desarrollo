import prisma from "@/lib/prisma";
import { mergePeople } from "@/services/person-merge";
import { duplicateSignals, nameKey, pairKey, type DuplicateSignal } from "@/lib/padron-duplicates";
import { nombrePropio } from "@/lib/nombres";

// Posibles personas repetidas en el padrón (mismo nombre con DNI distinto y algo
// más en común) y cómo unirlas en una sola sin perder datos.

export type DuplicatePerson = {
  dni: string;
  nombre: string | null;
  direccion: string | null;
  barrio: string | null;
  localidad: string | null;
  telefono: string | null;
  fechaNacimiento: string | null;
  programas: string[];
  expedientes: number;
  fichasTormenta: number;
};

export type DuplicatePair = { a: DuplicatePerson; b: DuplicatePerson; signals: DuplicateSignal[] };

type Row = {
  dni: string;
  nombre_completo: string | null;
  direccion: string | null;
  barrio: string | null;
  localidad: string | null;
  telefono: string | null;
  fecha_nacimiento: string | null;
  programas_activos: string | null;
};

const splitPrograms = (s?: string | null) => (s || "").split("|").map((p) => p.trim()).filter(Boolean);

/**
 * Un nombre cargado más veces que esto es genérico ("Sin nombre", "Vecino", un apellido
 * solo con una inicial…): compararlos todos contra todos no sirve y tardaría demasiado.
 */
export const MAX_NAME_GROUP = 40;

/**
 * La base agrupa por `nombre_clave` (el nombre sin tildes, signos ni orden de las palabras,
 * con índice) y devuelve solo los nombres que aparecen con más de un DNI; acá se decide
 * qué pares parecen la misma persona.
 */
export async function findPadronDuplicates(
  opts: { limit?: number } = {}
): Promise<{ pairs: DuplicatePair[]; total: number; skippedNames: number }> {
  const groups = await prisma.$queryRawUnsafe<{ size: number; rows: Row[] | null }[]>(`
    SELECT count(*)::int AS size,
           CASE WHEN count(*) <= ${MAX_NAME_GROUP} THEN json_agg(json_build_object(
             'dni', dni, 'nombre_completo', nombre_completo, 'direccion', direccion, 'barrio', barrio,
             'localidad', localidad, 'telefono', telefono, 'fecha_nacimiento', fecha_nacimiento,
             'programas_activos', programas_activos) ORDER BY dni) END AS rows
    FROM padron_unificado
    WHERE nombre_clave IN (
      SELECT nombre_clave FROM padron_unificado WHERE nombre_clave IS NOT NULL GROUP BY nombre_clave HAVING count(*) > 1
    )
    GROUP BY nombre_clave
  `);

  const dismissed = new Set(
    (await prisma.padronDuplicadoDescartado.findMany({ select: { dni_a: true, dni_b: true } })).map((d) => `${d.dni_a}|${d.dni_b}`)
  );

  const found: { a: Row; b: Row; signals: DuplicateSignal[] }[] = [];
  let skippedNames = 0;
  for (const { rows } of groups) {
    if (!rows) {
      skippedNames += 1;
      continue;
    }
    // La base y JavaScript pueden diferir en algún caracter raro: se vuelve a confirmar el nombre acá.
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i];
        const b = rows[j];
        if (nameKey(a.nombre_completo) !== nameKey(b.nombre_completo)) continue;
        if (dismissed.has(pairKey(a.dni, b.dni).join("|"))) continue;
        const signals = duplicateSignals(a, b);
        if (signals.length) found.push({ a, b, signals });
      }
    }
  }
  // Primero los que tienen más motivos; después por nombre.
  found.sort((x, y) => y.signals.length - x.signals.length || (x.a.nombre_completo || "").localeCompare(y.a.nombre_completo || ""));

  const shown = found.slice(0, opts.limit ?? 200);
  const dnis = Array.from(new Set(shown.flatMap((p) => [p.a.dni, p.b.dni])));
  const people = dnis.length
    ? await prisma.person.findMany({
        where: { dni: { in: dnis } },
        select: { dni: true, _count: { select: { cases: true, stormVictims: true } } },
      })
    : [];
  const counts = new Map(people.map((p) => [p.dni, p._count]));
  const toPerson = (r: Row): DuplicatePerson => ({
    dni: r.dni,
    nombre: nombrePropio(r.nombre_completo),
    direccion: r.direccion,
    barrio: r.barrio,
    localidad: r.localidad,
    telefono: r.telefono,
    fechaNacimiento: r.fecha_nacimiento,
    programas: splitPrograms(r.programas_activos),
    expedientes: counts.get(r.dni)?.cases ?? 0,
    fichasTormenta: counts.get(r.dni)?.stormVictims ?? 0,
  });

  return { pairs: shown.map((p) => ({ a: toPerson(p.a), b: toPerson(p.b), signals: p.signals })), total: found.length, skippedNames };
}

export async function dismissPadronDuplicate(userId: string, dniA: string, dniB: string) {
  const [dni_a, dni_b] = pairKey(dniA, dniB);
  await prisma.padronDuplicadoDescartado.upsert({
    where: { dni_a_dni_b: { dni_a, dni_b } },
    create: { dni_a, dni_b, userId },
    update: {},
  });
  await prisma.auditLog.create({
    data: { userId, action: "PADRON_DUPLICADO_DESCARTADO", entity: "PadronUnificado", entityId: dni_a, details: `DNI ${dni_a} y ${dni_b}: no son la misma persona.` },
  });
}

/**
 * Une dos registros del padrón en uno: queda el DNI `keepDni` y desaparece `removeDni`. Lo hace
 * `mergePeople` (services/person-merge.ts), igual que "Unir con otra ficha" en la ficha de la persona.
 */
export async function mergePadronDuplicates(userId: string, keepDni: string, removeDni: string) {
  await mergePeople(userId, keepDni, removeDni);
}
