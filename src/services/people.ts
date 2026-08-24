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

export async function getPeople(query?: string) {
  const numericQuery = query ? query.replace(/[^0-9]/g, '') : null;

  return await prisma.person.findMany({
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
      cases: {
        include: {
          area: true
        }
      },
      _count: {
        select: { cases: true }
      }
    },
    orderBy: { lastName: 'asc' }
  });
}

export async function getPersonById(id: string) {
  return await prisma.person.findUnique({
    where: { id },
    include: {
      family: {
        include: { members: true }
      },
      cases: {
        include: { area: true }
      },
      interventions: {
        orderBy: { date: 'desc' }
      },
      documents: true
    }
  });
}

export async function getPeopleStats() {
  const total = await prisma.person.count();

  // Load only the birthDate column for citizens with birthDates (extremely light RAM footprint)
  const birthDates = await prisma.person.findMany({
    where: { birthDate: { not: null } },
    select: { birthDate: true }
  });

  const now = new Date();
  const currentYear = now.getFullYear();
  let totalAge = 0;
  const withAge = birthDates.length;

  birthDates.forEach(p => {
    if (p.birthDate) {
      totalAge += (currentYear - p.birthDate.getFullYear());
    }
  });

  const avgAge = withAge > 0 ? Math.round(totalAge / withAge) : 0;

  // Use database aggregation to find the most active area
  const topAreaGroup = await prisma.case.groupBy({
    by: ['areaId'],
    _count: {
      _all: true
    },
    orderBy: {
      _count: {
        areaId: 'desc'
      }
    },
    take: 1
  });

  let topArea = 'N/A';
  if (topAreaGroup.length > 0 && topAreaGroup[0].areaId) {
    const area = await prisma.area.findUnique({
      where: { id: topAreaGroup[0].areaId },
      select: { name: true }
    });
    if (area) {
      topArea = area.name;
    }
  }

  return {
    total,
    avgAge,
    topArea
  };
}

/**
 * Geocodifica una dirección forzando el contexto de Tres de Febrero.
 */
async function geocodeAddress(address: string) {
    try {
        // Añadimos contexto explícito para evitar búsquedas en otros países/provincias
        const fullQuery = `${address}, Tres de Febrero, Buenos Aires, Argentina`;
        const encodedQuery = encodeURIComponent(fullQuery);

        // Parámetros: format=json, countrycodes=ar (Argentina), limit=1
        // También podemos usar viewbox para priorizar el área de Tres de Febrero
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

    // Fallback: Si falla o no encuentra, ubicar aleatoriamente DENTRO de Tres de Febrero
    // Coordenadas aproximadas del centro de Caseros
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
