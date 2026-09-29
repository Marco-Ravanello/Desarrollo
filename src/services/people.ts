import prisma from "@/lib/prisma";
import { z } from "zod";
import { MUNICIPAL_LOCALITIES, TRES_DE_FEBRERO_CENTER } from "@/lib/constants/localities";

export const CreatePersonSchema = z.object({
  dni: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  birthDate: z.string().or(z.date()).optional().nullable(),
  address: z.string().min(1),
  phone: z.string().optional().nullable(),
  email: z.string().email().or(z.string().length(0)).optional().nullable(),
});

export const UpdatePersonSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email().or(z.string().length(0)).optional().nullable(),
});

export interface GetPeopleOptions {
  query?: string;
  barrio?: string;
  programa?: string;
  page?: number;
  limit?: number;
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
        address: p.direccion || (p.barrio ? `Barrio ${p.barrio}` : "Tres de Febrero"),
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

    if (rows && rows.length > 0) {
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
        address: p.direccion ? `${p.direccion}${p.barrio ? ` - Barrio ${p.barrio}` : ""}` : (p.barrio || p.localidad || "Sin dirección"),
        phone: p.telefono || null,
        email: p.email || null,
        gender: p.genero || "No especificado",
        birthDate: null,
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

  return await prisma.person.findUnique({
    where: { id },
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

    // 2. Edad promedio real / demográfica
    let avgAge = 0;
    // 2.1 Intentar calcular sobre padron_unificado (edad_aprox o fecha_nacimiento)
    try {
      const avgRes: any[] = await prisma.$queryRawUnsafe(
        `SELECT ROUND(AVG(
           COALESCE(
             CASE
               WHEN edad_aprox IS NOT NULL AND regexp_replace(edad_aprox, '[^0-9]', '', 'g') != ''
                    AND regexp_replace(edad_aprox, '[^0-9]', '', 'g')::int BETWEEN 1 AND 110
               THEN regexp_replace(edad_aprox, '[^0-9]', '', 'g')::numeric
               ELSE NULL
             END,
             CASE
               WHEN fecha_nacimiento IS NOT NULL AND substring(fecha_nacimiento from '([0-9]{4})') != ''
                    AND substring(fecha_nacimiento from '([0-9]{4})')::int BETWEEN 1920 AND EXTRACT(YEAR FROM CURRENT_DATE)::int - 1
               THEN (EXTRACT(YEAR FROM CURRENT_DATE) - substring(fecha_nacimiento from '([0-9]{4})')::int)
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
    } catch (e) {}

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

    // Si aún no se determinó topArea o es genérico, tomar la localidad con mayor conteo real
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
      topArea = maxLocName || (total > 0 ? "Caseros" : "Sin datos");
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
 * Obtiene personas para el mapa social asignando coordenadas según centroides de localidades cuando no hay GPS explícito
 */
export async function getPeopleForMap(limit = 1500) {
  const people = await getPeople(undefined, limit);

  return people.map((p, idx) => {
    if (p.latitude && p.longitude) {
      return p;
    }

    const locKey = `${p.barrio} ${p.localidad} ${p.address}`.toLowerCase();
    let centroid: [number, number] = TRES_DE_FEBRERO_CENTER;

    for (const loc of MUNICIPAL_LOCALITIES) {
      if (loc.id === "all") continue;
      const cleanId = loc.id.replace(/[-_]/g, " ");
      const cleanName = loc.name.toLowerCase().replace(/\(.*?\)/g, "").trim();
      if (locKey.includes(cleanId) || locKey.includes(cleanName)) {
        centroid = loc.coordinates;
        break;
      }
    }

    // Pseudo-random offset determinístico dentro de ~1.2 km basado en DNI
    const dniNum = Number(String(p.dni).replace(/[^0-9]/g, "")) || (idx * 12345);
    const latOffset = (((dniNum * 9301 + 49297) % 233280) / 233280 - 0.5) * 0.022;
    const lngOffset = (((dniNum * 49297 + 9301) % 233280) / 233280 - 0.5) * 0.022;

    return {
      ...p,
      latitude: centroid[0] + latOffset,
      longitude: centroid[1] + lngOffset
    };
  });
}

/**
 * Geocodifica una dirección forzando el contexto de Tres de Febrero.
 */
async function geocodeAddress(address: string) {
  try {
    const fullQuery = `${address}, Tres de Febrero, Buenos Aires, Argentina`;
    const encodedQuery = encodeURIComponent(fullQuery);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=1&countrycodes=ar`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MuniGestio-TresDeFebrero/1.0'
      }
    });

    if (!response.ok) throw new Error("OSM Request failed");

    const data = await response.json();

    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
  } catch (error) {
    console.error("Geocoding error:", error);
  }

  return {
    lat: null,
    lng: null
  };
}

export async function createPerson(rawData: z.infer<typeof CreatePersonSchema>) {
  const data = CreatePersonSchema.parse(rawData);
  const coords = await geocodeAddress(data.address);
  const nombreCompleto = `${data.lastName}, ${data.firstName}`;

  // 1. Crear o actualizar en tabla Person (usando DNI como ID para compatibilidad de rutas)
  const person = await prisma.person.upsert({
    where: { dni: data.dni },
    update: {
      firstName: data.firstName,
      lastName: data.lastName,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      address: data.address,
      phone: data.phone || null,
      email: data.email || null,
      latitude: coords.lat,
      longitude: coords.lng,
    },
    create: {
      id: data.dni,
      dni: data.dni,
      firstName: data.firstName,
      lastName: data.lastName,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      address: data.address,
      phone: data.phone || null,
      email: data.email || null,
      latitude: coords.lat,
      longitude: coords.lng,
    }
  });

  // 2. Sincronizar en padron_unificado para que aparezca inmediatamente en el listado general
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO padron_unificado (dni, nombre_completo, direccion, telefono, email, latitude, longitude, cantidad_programas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
       ON CONFLICT (dni) DO UPDATE SET
         nombre_completo = EXCLUDED.nombre_completo,
         direccion = EXCLUDED.direccion,
         telefono = EXCLUDED.telefono,
         email = EXCLUDED.email,
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude;`,
      data.dni,
      nombreCompleto,
      data.address,
      data.phone || null,
      data.email || null,
      coords.lat,
      coords.lng
    );
  } catch (err) {
    console.error("Error sincronizando nuevo ciudadano en padron_unificado:", err);
  }

  return person;
}

export async function updatePerson(id: string, rawData: z.infer<typeof UpdatePersonSchema>) {
  const data = UpdatePersonSchema.parse(rawData);
  let coords = undefined;
  if (data.address) {
    coords = await geocodeAddress(data.address);
  }

  return await prisma.person.update({
    where: { id },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      address: data.address,
      phone: data.phone,
      email: data.email || null,
      ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {})
    }
  });
}
