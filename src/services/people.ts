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

export async function getPeople(query?: string, limit: number = 60) {
  let where = "1=1";
  if (query && query.trim()) {
    const q = query.trim().replace(/'/g, "''");
    const numQ = q.replace(/[^0-9]/g, "");
    if (numQ && numQ.length >= 4) {
      where += ` AND (dni LIKE '%${numQ}%' OR LOWER(nombre_completo) LIKE '%${q.toLowerCase()}%' OR LOWER(barrio) LIKE '%${q.toLowerCase()}%')`;
    } else {
      where += ` AND (LOWER(nombre_completo) LIKE '%${q.toLowerCase()}%' OR LOWER(barrio) LIKE '%${q.toLowerCase()}%' OR LOWER(localidad) LIKE '%${q.toLowerCase()}%')`;
    }
  }

  try {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT dni, nombre_completo, cantidad_programas, programas_activos, roles, barrio, localidad, direccion, telefono, email, edad_aprox
       FROM padron_unificado
       WHERE ${where}
       ORDER BY cantidad_programas DESC, nombre_completo ASC
       LIMIT ${limit};`
    );

    if (rows && rows.length > 0) {
      return rows.map((r: any) => {
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
          programasActivos: progs,
          casesCount: r.cantidad_programas || progs.length,
          _count: {
            cases: r.cantidad_programas || progs.length
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };
      });
    }
  } catch (err) {
    console.error("Error al consultar padron_unificado en getPeople:", err);
  }

  const numericQuery = query ? query.replace(/[^0-9]/g, '') : null;
  const legacyPeople = await prisma.person.findMany({
    where: query ? {
      OR: [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { dni: { contains: query } },
        ...(numericQuery ? [{ dni: { contains: numericQuery } }] : []),
      ]
    } : undefined,
    include: {
      family: true,
      cases: { include: { area: true } },
      _count: { select: { cases: true } }
    },
    orderBy: { lastName: 'asc' },
    take: limit
  });

  return legacyPeople.map(p => ({
    ...p,
    barrio: "",
    localidad: "Tres de Febrero",
    programasActivos: p.cases.map(c => c.area.name),
    casesCount: p._count.cases
  }));
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

      const cases = progs.map((progName: string, idx: number) => ({
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

      const interventions = partRows.map((part: any, idx: number) => ({
        id: `part-${idx}`,
        title: part.programa,
        description: part.detalle_destacado || `Prestación registrada con rol: ${part.roles}`,
        date: new Date(),
        area: { name: part.programa }
      }));

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
        programasActivos: progs,
        roles: p.roles || "Beneficiario",
        family: familyMembers.length > 0 ? { id: `fam-${p.dni}`, name: `Familia de ${lastName}`, members: familyMembers } : null,
        cases,
        interventions,
        documents: [],
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
