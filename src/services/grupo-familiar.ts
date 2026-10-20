import prisma from "@/lib/prisma";
import { isSensitiveArea } from "@/lib/sensitive-areas";
import { MAX_MISMO_DOMICILIO, cleanDni } from "@/services/ficha-social";
import type { GrupoFamiliar, MiembroFamiliar } from "@/services/ficha-social";
import { edadDe, normalizarDireccion, parseFamiliaresDeclarados } from "@/lib/grupo-familiar";

// Grupo familiar para la Ficha Social 360°: los familiares cargados en los
// programas y quienes figuran en el padrón con el mismo domicilio, cada uno con
// lo que la municipalidad hizo con esa persona.

type PadronRow = {
  dni: string;
  nombre_completo: string | null;
  programas_activos: string | null;
  fecha_nacimiento: string | null;
  edad_aprox: string | null;
  direccion: string | null;
  localidad: string | null;
  barrio: string | null;
  direccion_con_altura: boolean | null;
  dnis_familiares: string | null;
  nombres_familiares: string | null;
};

const PADRON_COLS = `dni, nombre_completo, programas_activos, fecha_nacimiento, edad_aprox, direccion, localidad, barrio,
  direccion_con_altura, dnis_familiares, nombres_familiares`;

const programasDe = (row: PadronRow | undefined) =>
  (row?.programas_activos || "").split("|").map((p) => p.trim()).filter(Boolean);

/** Cuánto atendió la municipalidad a cada DNI: expedientes, intervenciones, fichas de tormenta y entregas. */
async function atencionPorDni(dnis: string[], canViewSensitive: boolean) {
  const result = new Map<string, MiembroFamiliar["atencion"]>();
  if (!dnis.length) return result;
  const empty = () => ({ expedientes: 0, expedientesAbiertos: 0, intervenciones: 0, fichasTormenta: 0, entregas: 0 });
  for (const dni of dnis) result.set(dni, empty());

  const people = await prisma.person.findMany({ where: { dni: { in: dnis } }, select: { id: true, dni: true } });
  const dniByPerson = new Map(people.map((p) => [p.id, p.dni]));
  const personIds = people.map((p) => p.id);

  if (personIds.length) {
    const cases = await prisma.case.findMany({
      where: { personId: { in: personIds } },
      select: { personId: true, status: true, area: { select: { name: true } } },
    });
    for (const c of cases) {
      if (!canViewSensitive && isSensitiveArea(c.area?.name)) continue;
      const a = result.get(dniByPerson.get(c.personId!)!);
      if (!a) continue;
      a.expedientes++;
      if (c.status !== "CERRADO") a.expedientesAbiertos++;
    }
    const interventions = await prisma.intervention.findMany({
      where: { personId: { in: personIds } },
      select: { personId: true, case: { select: { area: { select: { name: true } } } } },
    });
    for (const i of interventions) {
      if (!canViewSensitive && isSensitiveArea(i.case?.area?.name)) continue;
      const a = result.get(dniByPerson.get(i.personId)!);
      if (a) a.intervenciones++;
    }
  }

  const records = await prisma.stormVictimRecord.findMany({
    where: { OR: [{ dni: { in: dnis } }, ...(personIds.length ? [{ personId: { in: personIds } }] : [])] },
    select: { dni: true, personId: true, _count: { select: { entregas: true } } },
  });
  for (const r of records) {
    const dni = (r.dni && result.has(r.dni) ? r.dni : null) ?? (r.personId ? dniByPerson.get(r.personId) : null);
    const a = dni ? result.get(dni) : undefined;
    if (!a) continue;
    a.fichasTormenta++;
    a.entregas += r._count.entregas;
  }
  return result;
}

export async function getGrupoFamiliar(rawDni: string, opts: { canViewSensitive: boolean }): Promise<GrupoFamiliar> {
  const dni = cleanDni(rawDni);
  const vacio: GrupoFamiliar = { declarados: [], mismoDomicilio: [], domicilio: null, sinDomicilio: null, personasEnDomicilio: 0 };
  if (!dni) return vacio;

  const [persona] = await prisma.$queryRawUnsafe<PadronRow[]>(`SELECT ${PADRON_COLS} FROM padron_unificado WHERE dni = $1 LIMIT 1`, dni);
  const registro = await prisma.person.findUnique({ where: { dni }, select: { address: true, familyId: true } });

  // 1) Familiares cargados en los programas, y el grupo familiar del Registro Único.
  const declarados = persona ? parseFamiliaresDeclarados(persona.nombres_familiares, persona.dnis_familiares) : [];
  if (registro?.familyId) {
    const familia = await prisma.person.findMany({
      where: { familyId: registro.familyId, NOT: { dni } },
      select: { dni: true, firstName: true, lastName: true },
    });
    for (const f of familia) {
      if (!declarados.some((d) => d.dni === f.dni)) declarados.push({ dni: f.dni, nombre: `${f.lastName}, ${f.firstName}`, vinculo: "Grupo familiar" });
    }
  }

  // 2) Mismo domicilio en el padrón (solo si la dirección tiene calle y altura).
  const direccion = persona?.direccion || registro?.address || null;
  const conAltura = persona ? persona.direccion_con_altura === true : Boolean(direccion && /\d/.test(direccion));
  let mismoDomicilio: PadronRow[] = [];
  let personasEnDomicilio = 0;
  let sinDomicilio: GrupoFamiliar["sinDomicilio"] = null;
  if (!direccion) sinDomicilio = "SIN_DIRECCION";
  else if (!conAltura) sinDomicilio = "SIN_ALTURA";
  else {
    const params: unknown[] = [normalizarDireccion(direccion), dni];
    let localidadFiltro = "";
    if (persona?.localidad) {
      params.push(persona.localidad.trim().toLowerCase());
      localidadFiltro = ` AND lower(trim(coalesce(localidad, ''))) = $3`;
    }
    const where = `lower(regexp_replace(trim(direccion), '\\s+', ' ', 'g')) = $1 AND dni <> $2${localidadFiltro}`;
    const [{ n }] = await prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM padron_unificado WHERE ${where}`, ...params);
    personasEnDomicilio = n;
    if (n > 0) {
      mismoDomicilio = await prisma.$queryRawUnsafe<PadronRow[]>(
        `SELECT ${PADRON_COLS} FROM padron_unificado WHERE ${where} ORDER BY nombre_completo LIMIT ${MAX_MISMO_DOMICILIO}`,
        ...params
      );
    }
  }

  // Datos del padrón de los familiares cargados con DNI.
  const dnisDeclarados = declarados.map((d) => d.dni).filter((d): d is string => Boolean(d) && d !== dni);
  const padronDeclarados = dnisDeclarados.length
    ? await prisma.$queryRawUnsafe<PadronRow[]>(`SELECT ${PADRON_COLS} FROM padron_unificado WHERE dni = ANY($1::text[])`, dnisDeclarados)
    : [];
  const padronPorDni = new Map([...padronDeclarados, ...mismoDomicilio].map((r) => [r.dni, r]));

  const todos = Array.from(new Set([...dnisDeclarados, ...mismoDomicilio.map((r) => r.dni)]));
  const atencion = await atencionPorDni(todos, opts.canViewSensitive);
  const sinAtencion = { expedientes: 0, expedientesAbiertos: 0, intervenciones: 0, fichasTormenta: 0, entregas: 0 };

  const miembro = (d: { dni: string | null; nombre: string; vinculo: string }): MiembroFamiliar => {
    const row = d.dni ? padronPorDni.get(d.dni) : undefined;
    return {
      dni: d.dni,
      nombre: d.nombre || row?.nombre_completo || (d.dni ? `DNI ${d.dni}` : "Sin nombre"),
      vinculo: d.vinculo,
      edad: row ? edadDe(row.fecha_nacimiento, row.edad_aprox) : null,
      programas: programasDe(row),
      enPadron: Boolean(row),
      atencion: (d.dni && atencion.get(d.dni)) || sinAtencion,
    };
  };

  const yaDeclarados = new Set(dnisDeclarados);
  return {
    declarados: declarados.filter((d) => d.dni !== dni).map(miembro),
    mismoDomicilio: mismoDomicilio
      .filter((r) => !yaDeclarados.has(r.dni))
      .map((r) => miembro({ dni: r.dni, nombre: r.nombre_completo || "", vinculo: "Mismo domicilio" })),
    domicilio: direccion,
    sinDomicilio,
    personasEnDomicilio,
  };
}
