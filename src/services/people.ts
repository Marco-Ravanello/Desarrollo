import prisma from "@/lib/prisma";
import { PADRON_GAPS, isPadronGap, type PadronGap } from "@/lib/padron-quality";
import { MUNICIPAL_LOCALITIES } from "@/lib/constants/localities";
import { normalizeDni } from "@/lib/padron-import";
import { parseFechaNacimiento, personAddress, barrioLabel } from "@/lib/person-display";

export interface GetPeopleOptions {
  query?: string;
  barrio?: string;
  programa?: string;
  page?: number;
  limit?: number;
  /** Solo personas con un punto real en el mapa (latitud y longitud cargadas). */
  withLocation?: boolean;
  /** Solo a quienes les falta ese dato (panel de calidad del padrón). */
  falta?: PadronGap;
}

export interface PaginatedPeopleResult {
  people: any[];
  total: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export async function ensurePersonInPrisma(personIdOrDni: string) {
  if (!personIdOrDni) return null;

  // 1. Buscar si ya existe en Person por id o por dni
  let person = await prisma.person.findFirst({
    where: {
      OR: [
        { id: personIdOrDni },
        { dni: personIdOrDni }
      ]
    }
  });

  if (person) return person;

  // 2. Si no existe, buscar en padron_unificado
  const padronRows: any[] = await prisma.$queryRawUnsafe(
    `SELECT * FROM padron_unificado WHERE dni = $1 LIMIT 1;`,
    personIdOrDni
  );

  if (padronRows && padronRows.length > 0) {
    const p = padronRows[0];
    let lastName = "Ciudadano";
    let firstName = "";

    if (p.nombre_completo && p.nombre_completo.includes(",")) {
      const parts = p.nombre_completo.split(",");
      lastName = parts[0].trim();
      firstName = parts.slice(1).join(",").trim();
    } else {
      const parts = (p.nombre_completo || "").trim().split(" ");
      lastName = parts[0] || "Ciudadano";
      firstName = parts.slice(1).join(" ") || "";
    }

    // 3. Crear en la tabla Person (usando el DNI como ID para compatibilidad de rutas)
    person = await prisma.person.create({
      data: {
        id: p.dni,
        dni: p.dni,
        firstName,
        lastName,
        address: p.direccion || (p.barrio ? barrioLabel(p.barrio) : "Tres de Febrero"),
        phone: p.telefono || null,
        email: p.email || null,
        gender: p.genero || null,
      }
    });

    return person;
  }

  return null;
}

export async function getPaginatedPeople(options: GetPeopleOptions = {}): Promise<PaginatedPeopleResult> {
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.max(1, Math.min(15000, Number(options.limit) || 20));
  const offset = (page - 1) * limit;

  let whereConditions: string[] = ["1=1"];
  const params: any[] = [];
  let paramIdx = 1;

  if (options.query && options.query.trim()) {
    const q = options.query.trim();
    const numQ = q.replace(/[^0-9]/g, "");
    if (numQ && numQ.length >= 4) {
      whereConditions.push(
        `(dni LIKE $${paramIdx} OR LOWER(nombre_completo) LIKE $${paramIdx + 1} OR LOWER(barrio) LIKE $${paramIdx + 1} OR LOWER(direccion) LIKE $${paramIdx + 1})`
      );
      params.push(`%${numQ}%`, `%${q.toLowerCase()}%`);
      paramIdx += 2;
    } else {
      whereConditions.push(
        `(LOWER(nombre_completo) LIKE $${paramIdx} OR LOWER(barrio) LIKE $${paramIdx} OR LOWER(localidad) LIKE $${paramIdx} OR LOWER(direccion) LIKE $${paramIdx})`
      );
      params.push(`%${q.toLowerCase()}%`);
      paramIdx += 1;
    }
  }

  if (options.barrio && options.barrio.trim() && options.barrio !== "all") {
    const b = options.barrio.trim().toLowerCase();
    whereConditions.push(
      `(LOWER(barrio) LIKE $${paramIdx} OR LOWER(localidad) LIKE $${paramIdx} OR LOWER(direccion) LIKE $${paramIdx})`
    );
    params.push(`%${b}%`);
    paramIdx += 1;
  }

  if (options.programa && options.programa.trim() && options.programa !== "all") {
    const p = options.programa.trim().toLowerCase();
    whereConditions.push(`LOWER(programas_activos) LIKE $${paramIdx}`);
    params.push(`%${p}%`);
    paramIdx += 1;
  }

  if (options.withLocation) {
    whereConditions.push("latitude IS NOT NULL AND longitude IS NOT NULL");
  }

  if (options.falta && isPadronGap(options.falta)) {
    whereConditions.push(PADRON_GAPS[options.falta].sql);
  }

  const whereClause = whereConditions.join(" AND ");

  try {
    const countRes: any[] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as total FROM padron_unificado WHERE ${whereClause};`,
      ...params
    );
    const total = countRes[0]?.total || 0;

    const queryParams = [...params, limit, offset];
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT dni, nombre_completo, cantidad_programas, programas_activos, roles, barrio, localidad, direccion, telefono, email, edad_aprox, latitude, longitude
       FROM padron_unificado
       WHERE ${whereClause}
       ORDER BY cantidad_programas DESC, nombre_completo ASC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1};`,
      ...queryParams
    );

    // Para el mapa no se cae al Registro Único: si nadie del padrón está ubicado, no hay puntos.
    // Tampoco con el filtro de datos faltantes: es del padrón.
    if ((rows && rows.length > 0) || options.withLocation || options.falta) {
      const mappedPeople = rows.map((r: any) => {
        let lastName = "";
        let firstName = "";

        if (r.nombre_completo && r.nombre_completo.includes(",")) {
          const parts = r.nombre_completo.split(",");
          lastName = parts[0].trim();
          firstName = parts.slice(1).join(",").trim();
        } else {
          const parts = (r.nombre_completo || "").trim().split(" ");
          lastName = parts[0] || "Ciudadano";
          firstName = parts.slice(1).join(" ") || "";
        }

        const progs = (r.programas_activos || "")
          .split("|")
          .map((p: string) => p.trim())
          .filter(Boolean);

        return {
          id: r.dni,
          dni: r.dni,
          firstName,
          lastName,
          address: r.direccion ? `${r.direccion}${r.barrio ? ` (${r.barrio})` : ""}` : (r.barrio || r.localidad || "Sin dirección"),
          phone: r.telefono || null,
          email: r.email || null,
          barrio: r.barrio || "",
          localidad: r.localidad || "Tres de Febrero",
          latitude: r.latitude,
          longitude: r.longitude,
          programasActivos: progs,
          casesCount: r.cantidad_programas || progs.length,
          cases: [],
          _count: {
            cases: r.cantidad_programas || progs.length
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };
      });

      return {
        people: mappedPeople,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        pageSize: limit
      };
    }
  } catch (err) {
    console.error("Error al consultar padron_unificado en getPaginatedPeople:", err);
  }

  // Fallback a Prisma Person
  const numericQuery = options.query ? options.query.replace(/[^0-9]/g, '') : null;
  const wherePrisma: any = options.query ? {
    OR: [
      { firstName: { contains: options.query, mode: 'insensitive' } },
      { lastName: { contains: options.query, mode: 'insensitive' } },
      { dni: { contains: options.query } },
      ...(numericQuery ? [{ dni: { contains: numericQuery } }] : []),
    ]
  } : {};
  if (options.withLocation) {
    wherePrisma.latitude = { not: null };
    wherePrisma.longitude = { not: null };
  }

  const totalPrisma = await prisma.person.count({ where: wherePrisma });

  const legacyPeople = await prisma.person.findMany({
    where: wherePrisma,
    include: {
      family: true,
      cases: { include: { area: true } },
      _count: { select: { cases: true } }
    },
    orderBy: { lastName: 'asc' },
    skip: offset,
    take: limit
  });

  const mappedLegacy = legacyPeople.map(p => ({
    ...p,
    barrio: "",
    localidad: "Tres de Febrero",
    programasActivos: p.cases.map(c => c.area.name),
    casesCount: p._count.cases
  }));

  return {
    people: mappedLegacy,
    total: totalPrisma,
    totalPages: Math.ceil(totalPrisma / limit),
    currentPage: page,
    pageSize: limit
  };
}

export async function getPeople(query?: string, limit: number = 60) {
  const result = await getPaginatedPeople({
    query,
    limit,
    page: 1
  });
  return result.people;
}

export async function getPeopleFilterOptions() {
  const defaultBarrios = [
    "Caseros",
    "Ciudadela",
    "Barrio Derqui",
    "Fuerte Apache (Ejército de los Andes)",
    "El Libertador",
    "Puerta 8",
    "Ciudad Jardín Lomas del Palomar",
    "El Palomar",
    "Villa Bosch",
    "Santos Lugares",
    "Sáenz Peña",
    "Loma Hermosa",
    "Martín Coronado",
    "Pablo Podestá",
    "Churruca",
    "Remedios de Escalada",
    "11 de Septiembre",
    "José Ingenieros",
    "Villa Raffo"
  ];

  try {
    const barriosRes: any[] = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT COALESCE(NULLIF(barrio, ''), 'Tres de Febrero') as barrio
       FROM padron_unificado
       WHERE barrio IS NOT NULL AND barrio != ''
       ORDER BY barrio ASC
       LIMIT 40;`
    );

    const dbBarrios = barriosRes.map((r: any) => r.barrio).filter(Boolean);
    const mergedBarrios = Array.from(new Set([...defaultBarrios, ...dbBarrios])).sort();

    const progsRes: any[] = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT programas_activos
       FROM padron_unificado
       WHERE programas_activos IS NOT NULL AND programas_activos != '';`
    );

    const progsSet = new Set<string>();
    progsRes.forEach((r: any) => {
      if (r.programas_activos) {
        r.programas_activos
          .split("|")
          .map((p: string) => p.trim())
          .filter(Boolean)
          .forEach((p: string) => progsSet.add(p));
      }
    });

    const programas = Array.from(progsSet).sort();

    return {
      barrios: mergedBarrios,
      programas
    };
  } catch (err) {
    console.error("Error al obtener opciones de filtro de padrón:", err);
    return {
      barrios: defaultBarrios,
      programas: [
        "Jardines Municipales",
        "Tarjeta Alimentar",
        "Centro de Familia",
        "Programa Envión",
        "Colonias Municipales 2026",
        "Centro de Formación Profesional 3F",
        "Intervenciones Desarrollo Humano",
        "Servicios Locales de Niñez"
      ]
    };
  }
}

function extractDateFromDetalle(detalle?: string | null): Date {
  if (!detalle) return new Date("2024-01-01T00:00:00.000Z");
  const matchDmy = detalle.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/);
  if (matchDmy) {
    const day = parseInt(matchDmy[1], 10);
    const month = parseInt(matchDmy[2], 10) - 1;
    const year = parseInt(matchDmy[3], 10);
    return new Date(Date.UTC(year, month, day, 12, 0, 0));
  }
  const matchYmd = detalle.match(/\b(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\b/);
  if (matchYmd) {
    const year = parseInt(matchYmd[1], 10);
    const month = parseInt(matchYmd[2], 10) - 1;
    const day = parseInt(matchYmd[3], 10);
    return new Date(Date.UTC(year, month, day, 12, 0, 0));
  }
  const matchYear = detalle.match(/\b(202[0-6]|201[8-9])\b/);
  if (matchYear) {
    return new Date(Date.UTC(parseInt(matchYear[1], 10), 2, 1, 12, 0, 0));
  }
  return new Date("2024-01-01T00:00:00.000Z");
}

export async function getPersonById(id: string) {
  try {
    const padronRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM padron_unificado WHERE dni = $1 LIMIT 1;`,
      id
    );

    if (padronRows && padronRows.length > 0) {
      const p = padronRows[0];
      let lastName = "";
      let firstName = "";

      if (p.nombre_completo && p.nombre_completo.includes(",")) {
        const parts = p.nombre_completo.split(",");
        lastName = parts[0].trim();
        firstName = parts.slice(1).join(",").trim();
      } else {
        const parts = (p.nombre_completo || "").trim().split(" ");
        lastName = parts[0] || "Ciudadano";
        firstName = parts.slice(1).join(" ") || "";
      }

      const partRows: any[] = await prisma.$queryRawUnsafe(
        `SELECT * FROM participaciones_programas WHERE dni = $1 ORDER BY programa ASC;`,
        p.dni
      );

      const familyMembers: any[] = [];
      if (p.nombres_familiares) {
        const famNombres = p.nombres_familiares.split(";").map((n: string) => n.trim()).filter(Boolean);
        const famDnis = (p.dnis_familiares || "").split(",").map((d: string) => d.trim()).filter(Boolean);

        famNombres.forEach((item: string, idx: number) => {
          let tipoRel = "Familiar a cargo";
          let nombre = item;
          const match = item.match(/^(.*?)\s*\((.*?)\)$/);
          if (match) {
            nombre = match[1].trim();
            tipoRel = match[2].trim();
          }
          const relDni = famDnis[idx] || famDnis[0] || "";
          familyMembers.push({
            id: relDni || `fam-${idx}`,
            dni: relDni,
            firstName: nombre,
            lastName: `(${tipoRel})`,
            relationship: tipoRel
          });
        });
      }

      const progs = (p.programas_activos || "").split("|").map((prog: string) => prog.trim()).filter(Boolean);

      const syntheticInterventions = partRows.map((part: any, idx: number) => {
        let areaName: string | undefined = undefined;
        if (part.detalle_destacado) {
          const areaMatch = part.detalle_destacado.match(/Área Municipal:\s*([^|]+)/i);
          if (areaMatch) {
            areaName = areaMatch[1].trim();
          }
        }
        return {
          id: `part-${idx}`,
          title: part.programa,
          description: part.detalle_destacado || `Prestación registrada con rol: ${part.roles}`,
          date: extractDateFromDetalle(part.detalle_destacado),
          area: areaName ? { name: areaName } : undefined
        };
      });

      // Fetch real Prisma cases, interventions, and documents
      const realCases = await prisma.case.findMany({
        where: {
          OR: [
            { personId: p.dni },
            { person: { dni: p.dni } }
          ]
        },
        include: {
          area: true,
          interventions: { orderBy: { date: 'desc' } },
          documents: true
        },
        orderBy: { updatedAt: 'desc' }
      });

      const prismaRecord = await prisma.person.findFirst({
        where: { OR: [{ id: p.dni }, { dni: p.dni }] },
        include: {
          interventions: { orderBy: { date: 'desc' } },
          documents: true,
        }
      });

      const realInterventions = prismaRecord?.interventions || [];
      const allInterventions = [...realInterventions, ...syntheticInterventions];
      const allDocuments = prismaRecord?.documents || [];

      return {
        id: p.dni,
        dni: p.dni,
        firstName,
        lastName,
        address: personAddress(p.direccion, p.barrio, p.localidad),
        phone: p.telefono || null,
        email: p.email || null,
        gender: p.genero || "No especificado",
        birthDate: parseFechaNacimiento(p.fecha_nacimiento) ? new Date(`${parseFechaNacimiento(p.fecha_nacimiento)}T12:00:00Z`) : null,
        fechaNacimientoTexto: !parseFechaNacimiento(p.fecha_nacimiento) && p.fecha_nacimiento?.trim() ? p.fecha_nacimiento.trim() : null,
        edadAprox: p.edad_aprox || "No registrada",
        barrio: p.barrio || "",
        localidad: p.localidad || "Tres de Febrero",
        latitude: p.latitude,
        longitude: p.longitude,
        programasActivos: progs,
        roles: p.roles || "Beneficiario",
        family: familyMembers.length > 0 ? { id: `fam-${p.dni}`, name: `Familia de ${lastName}`, members: familyMembers } : null,
        cases: realCases,
        interventions: allInterventions,
        documents: allDocuments,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
  } catch (err) {
    console.error("Error consultando padron_unificado en getPersonById:", err);
  }

  return await prisma.person.findFirst({
    where: { OR: [{ id }, { dni: id }] },
    include: {
      family: { include: { members: true } },
      cases: { include: { area: true } },
      interventions: { orderBy: { date: 'desc' } },
      documents: true
    }
  });
}

export async function getPeopleStats() {
  try {
    // 1. Total del padrón unificado + Person sin duplicados
    let total = 0;
    try {
      const countRes: any[] = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as total FROM padron_unificado;`
      );
      total = countRes[0]?.total || 0;
    } catch (e) {
      total = 0;
    }
    if (total === 0) {
      total = await prisma.person.count().catch(() => 0);
    }
    // 2. Edad promedio real / demográfica (4 niveles de tolerancia a fallos)
    let avgAge = 0;
    // 2.1 Intentar calcular sobre padron_unificado (edad_aprox o fecha_nacimiento)
    try {
      const avgRes: any[] = await prisma.$queryRawUnsafe(
        `SELECT ROUND(AVG(
           COALESCE(
             CASE
               WHEN edad_aprox IS NOT NULL
                    AND LENGTH(regexp_replace(edad_aprox, '[^0-9]', '', 'g')) BETWEEN 1 AND 3
                    AND regexp_replace(edad_aprox, '[^0-9]', '', 'g')::int BETWEEN 1 AND 110
               THEN regexp_replace(edad_aprox, '[^0-9]', '', 'g')::numeric
               ELSE NULL
             END,
             CASE
               WHEN fecha_nacimiento IS NOT NULL
                    AND fecha_nacimiento ~ '(19[2-9][0-9]|20[0-2][0-9])'
               THEN (EXTRACT(YEAR FROM CURRENT_DATE)::int - substring(fecha_nacimiento from '(19[2-9][0-9]|20[0-2][0-9])')::int)
               ELSE NULL
             END
           )
         ))::int as avg_age
         FROM padron_unificado
         WHERE (edad_aprox IS NOT NULL AND edad_aprox != '')
            OR (fecha_nacimiento IS NOT NULL AND fecha_nacimiento != '');`
      );
      if (avgRes[0]?.avg_age && Number(avgRes[0].avg_age) > 0) {
        avgAge = Number(avgRes[0].avg_age);
      }
    } catch (e) {
      console.error("Error calculando edad desde padron_unificado (fechas/edad):", e);
    }
    // 2.2 Si no dio resultado, calcular desde Person con birthDate
    if (!avgAge || avgAge <= 0) {
      try {
        const personAvgRes: any[] = await prisma.$queryRawUnsafe(
          `SELECT ROUND(AVG(EXTRACT(YEAR FROM age(CURRENT_DATE, "birthDate"))))::int as avg_age
           FROM "Person"
           WHERE "birthDate" IS NOT NULL;`
        );
        if (personAvgRes[0]?.avg_age && Number(personAvgRes[0].avg_age) > 0) {
          avgAge = Number(personAvgRes[0].avg_age);
        }
      } catch (e) {}
    }
    // 2.3 Si no hay fechas explícitas, deducir demográficamente por numeración de DNI (estándar nacional argentino)
    if (!avgAge || avgAge <= 0) {
      try {
        const dniAvgRes: any[] = await prisma.$queryRawUnsafe(
          `SELECT ROUND(AVG(
             GREATEST(16, LEAST(85, EXTRACT(YEAR FROM CURRENT_DATE)::int - (1938 + (NULLIF(regexp_replace(dni, '[^0-9]', '', 'g'), '')::numeric / 1000000.0) * 1.45)))
           ))::int as avg_age
           FROM padron_unificado
           WHERE regexp_replace(dni, '[^0-9]', '', 'g') != ''
             AND LENGTH(regexp_replace(dni, '[^0-9]', '', 'g')) BETWEEN 7 AND 8;`
        );
        if (dniAvgRes[0]?.avg_age && Number(dniAvgRes[0].avg_age) > 0) {
          avgAge = Number(dniAvgRes[0].avg_age);
        }
      } catch (e) {
        console.error("Error calculando edad por DNI en padron_unificado:", e);
      }
    }
    // 2.4 Si padron_unificado no tenía DNIs, intentar deducir desde DNIs de la tabla Person
    if (!avgAge || avgAge <= 0) {
      try {
        const dniPersonRes: any[] = await prisma.$queryRawUnsafe(
          `SELECT ROUND(AVG(
             GREATEST(16, LEAST(85, EXTRACT(YEAR FROM CURRENT_DATE)::int - (1938 + (NULLIF(regexp_replace(dni, '[^0-9]', '', 'g'), '')::numeric / 1000000.0) * 1.45)))
           ))::int as avg_age
           FROM "Person"
           WHERE regexp_replace(dni, '[^0-9]', '', 'g') != ''
             AND LENGTH(regexp_replace(dni, '[^0-9]', '', 'g')) BETWEEN 7 AND 8;`
        );
        if (dniPersonRes[0]?.avg_age && Number(dniPersonRes[0].avg_age) > 0) {
          avgAge = Number(dniPersonRes[0].avg_age);
        }
      } catch (e) {}
    }
    // 3. Barrio o Localidad con Mayor Asistencia
    let topArea = "";
    try {
      const topBarrioRes: any[] = await prisma.$queryRawUnsafe(
        `SELECT barrio, COUNT(*)::int as cant
         FROM padron_unificado
         WHERE barrio IS NOT NULL
           AND TRIM(barrio) != ''
           AND LOWER(TRIM(barrio)) NOT IN (
             'tres de febrero', 'partido de tres de febrero', 'municipio de tres de febrero',
             'sin barrio', 'sin barrio registrado', 'sin dato', 'otro', 'otros', 's/d', 's/n', 'no especifica', 'desconocido'
           )
         GROUP BY barrio
         ORDER BY cant DESC
         LIMIT 1;`
      );
      if (topBarrioRes[0]?.barrio) {
        let b = String(topBarrioRes[0].barrio).trim();
        if (b.includes("/")) {
          b = b.split("/")[0].trim();
        }
        topArea = b;
      }
    } catch (e) {}
    // 4. Población censada desglosada por localidad (100% dinámico)
    const localityTotals: Record<string, number> = {
      "all": total
    };
    for (const loc of MUNICIPAL_LOCALITIES) {
      if (loc.id !== "all") {
        localityTotals[loc.id] = 0;
      }
    }
    try {
      const locRes: any[] = await prisma.$queryRawUnsafe(
        `SELECT LOWER(TRIM(COALESCE(NULLIF(localidad, ''), NULLIF(barrio, ''), ''))) as loc, COUNT(*)::int as cant
         FROM padron_unificado
         WHERE (localidad IS NOT NULL AND TRIM(localidad) != '') OR (barrio IS NOT NULL AND TRIM(barrio) != '')
         GROUP BY loc;`
      );
      locRes.forEach((r: any) => {
        if (r.loc && r.cant) {
          const lKey = String(r.loc).toLowerCase();
          for (const loc of MUNICIPAL_LOCALITIES) {
            if (loc.id === "all") continue;
            const cleanId = loc.id.replace(/[-_]/g, " ");
            const cleanName = loc.name.toLowerCase().replace(/\(.*?\)/g, "").trim();
            if (lKey.includes(cleanId) || lKey.includes(cleanName) || cleanName.includes(lKey)) {
              localityTotals[loc.id] = (localityTotals[loc.id] || 0) + Number(r.cant);
            }
          }
        }
      });
    } catch (e) {}
    if (!topArea || topArea.toLowerCase().includes("tres de febrero") || topArea.toLowerCase().includes("partido")) {
      let maxLocCount = 0;
      let maxLocName = "";
      for (const loc of MUNICIPAL_LOCALITIES) {
        if (loc.id === "all") continue;
        const cnt = localityTotals[loc.id] || 0;
        if (cnt > maxLocCount) {
          maxLocCount = cnt;
          maxLocName = loc.name.replace(/\(.*?\)/g, "").trim();
        }
      }
      topArea = maxLocName || "Sin datos";
    }
    return {
      total,
      avgAge,
      topArea,
      localityTotals
    };
  } catch (err) {
    console.error("Error en getPeopleStats:", err);
    return {
      total: 0,
      avgAge: 0,
      topArea: "Sin datos",
      localityTotals: {
        "all": 0
      }
    };
  }
}

/**
 * Personas para el mapa social: solo las que tienen un punto real (Georef, OpenStreetMap o marcado a mano).
 * Las que todavía no se ubicaron no se dibujan; se ubican desde Mapa Social > Ubicar en el mapa.
 */
export async function getPeopleForMap(limit = 1500) {
  const result = await getPaginatedPeople({ limit, page: 1, withLocation: true });
  return result.people.filter((p) => p.latitude != null && p.longitude != null);
}

/**
 * Persona que ya está cargada con ese DNI, en el Registro Único o en el padrón.
 * "Cargar persona" la usa para avisar en vez de pisar sus datos.
 */
export async function findExistingPersonByDni(dni: string): Promise<{ id: string; nombre: string } | null> {
  const candidates = Array.from(new Set([dni.trim(), normalizeDni(dni)].filter((d): d is string => Boolean(d))));
  if (candidates.length === 0) return null;

  const padron = await prisma.padronUnificado.findFirst({
    where: { dni: { in: candidates } },
    select: { dni: true, nombre_completo: true },
  });
  if (padron) return { id: padron.dni, nombre: padron.nombre_completo || `DNI ${padron.dni}` };

  const person = await prisma.person.findFirst({
    where: { dni: { in: candidates } },
    select: { id: true, firstName: true, lastName: true },
  });
  if (person) return { id: person.id, nombre: `${person.lastName}, ${person.firstName}` };

  return null;
}

/** Integrantes del grupo familiar cargado en el Registro Único (los que se pueden desvincular). */
export async function getRegistroFamilyMembers(dni: string) {
  const person = await prisma.person.findUnique({ where: { dni }, select: { id: true, familyId: true } });
  if (!person?.familyId) return [];
  return prisma.person.findMany({
    where: { familyId: person.familyId, NOT: { id: person.id } },
    select: { id: true, dni: true, firstName: true, lastName: true },
    orderBy: { lastName: "asc" },
  });
}
