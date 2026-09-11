import prisma from "@/lib/prisma";
import { z } from "zod";

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
  const limit = Math.max(1, Math.min(100, Number(options.limit) || 20));
  const offset = (page - 1) * limit;

  let whereConditions: string[] = ["1=1"];

  if (options.query && options.query.trim()) {
    const q = options.query.trim().replace(/'/g, "''");
    const numQ = q.replace(/[^0-9]/g, "");
    if (numQ && numQ.length >= 4) {
      whereConditions.push(
        `(dni LIKE '%${numQ}%' OR LOWER(nombre_completo) LIKE '%${q.toLowerCase()}%' OR LOWER(barrio) LIKE '%${q.toLowerCase()}%' OR LOWER(direccion) LIKE '%${q.toLowerCase()}%')`
      );
    } else {
      whereConditions.push(
        `(LOWER(nombre_completo) LIKE '%${q.toLowerCase()}%' OR LOWER(barrio) LIKE '%${q.toLowerCase()}%' OR LOWER(localidad) LIKE '%${q.toLowerCase()}%' OR LOWER(direccion) LIKE '%${q.toLowerCase()}%')`
      );
    }
  }

  if (options.barrio && options.barrio.trim() && options.barrio !== "all") {
    const b = options.barrio.trim().replace(/'/g, "''").toLowerCase();
    whereConditions.push(
      `(LOWER(barrio) LIKE '%${b}%' OR LOWER(localidad) LIKE '%${b}%' OR LOWER(direccion) LIKE '%${b}%')`
    );
  }

  if (options.programa && options.programa.trim() && options.programa !== "all") {
    const p = options.programa.trim().replace(/'/g, "''").toLowerCase();
    whereConditions.push(`LOWER(programas_activos) LIKE '%${p}%'`);
  }

  const whereClause = whereConditions.join(" AND ");

  try {
    const countRes: any[] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as total FROM padron_unificado WHERE ${whereClause};`
    );
    const total = countRes[0]?.total || 0;

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT dni, nombre_completo, cantidad_programas, programas_activos, roles, barrio, localidad, direccion, telefono, email, edad_aprox, latitude, longitude
       FROM padron_unificado
       WHERE ${whereClause}
       ORDER BY cantidad_programas DESC, nombre_completo ASC
       LIMIT ${limit} OFFSET ${offset};`
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
          cases: progs.map((prog: string, idx: number) => ({
            id: `prog-${r.dni}-${idx}`,
            areaId: prog,
            area: { id: prog, name: prog }
          })),
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

      const syntheticCases = progs.map((progName: string, idx: number) => ({
        id: `case-prog-${idx}`,
        title: `Asistencia: ${progName}`,
        description: `Programa social activo en padrón municipal de Tres de Febrero. Roles: ${p.roles || "Beneficiario"}`,
        status: "ACTIVO",
        priority: "MEDIA",
        createdAt: new Date(),
        updatedAt: new Date(),
        area: {
          id: `area-${idx}`,
          name: progName
        }
      }));

      const syntheticInterventions = partRows.map((part: any, idx: number) => ({
        id: `part-${idx}`,
        title: part.programa,
        description: part.detalle_destacado || `Prestación registrada con rol: ${part.roles}`,
        date: new Date(),
        area: { name: part.programa }
      }));

      // Fetch real Prisma cases, interventions, and documents if present
      const prismaRecord = await prisma.person.findFirst({
        where: { OR: [{ id: p.dni }, { dni: p.dni }] },
        include: {
          cases: { include: { area: true } },
          interventions: { orderBy: { date: 'desc' } },
          documents: true,
        }
      });

      const realCases = prismaRecord?.cases || [];
      const allCases = [...realCases, ...syntheticCases];
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
        cases: allCases,
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
    const countRes: any[] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as total FROM padron_unificado;`
    );
    const total = countRes[0]?.total || 0;

    const topBarrioRes: any[] = await prisma.$queryRawUnsafe(
      `SELECT COALESCE(NULLIF(barrio, ''), 'Tres de Febrero') as barrio, COUNT(*)::int as cant
       FROM padron_unificado
       GROUP BY barrio
       ORDER BY cant DESC
       LIMIT 1;`
    );
    const topArea = topBarrioRes[0]?.barrio || "Desarrollo Humano";

    return {
      total: total > 0 ? total : await prisma.person.count(),
      avgAge: 33,
      topArea: `${topArea}`
    };
  } catch (err) {
    return {
      total: await prisma.person.count(),
      avgAge: 0,
      topArea: "Desarrollo Humano"
    };
  }
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
        lat: -34.603 + (Math.random() - 0.5) * 0.02,
        lng: -58.558 + (Math.random() - 0.5) * 0.02
    };
}

export async function createPerson(rawData: z.infer<typeof CreatePersonSchema>) {
  const data = CreatePersonSchema.parse(rawData);
  const coords = await geocodeAddress(data.address);

  return await prisma.person.create({
    data: {
      dni: data.dni,
      firstName: data.firstName,
      lastName: data.lastName,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      address: data.address,
      phone: data.phone,
      email: data.email || null,
      latitude: coords.lat,
      longitude: coords.lng,
    }
  });
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
