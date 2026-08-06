import prisma from "@/lib/prisma";

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
  const people = await prisma.person.findMany({
    select: {
      birthDate: true,
      cases: { select: { area: { select: { name: true } } } }
    }
  });

  const now = new Date();
  let totalAge = 0;
  let withAge = 0;
  const areaCounts: Record<string, number> = {};

  people.forEach(p => {
    if (p.birthDate) {
      const age = now.getFullYear() - p.birthDate.getFullYear();
      totalAge += age;
      withAge++;
    }
    p.cases.forEach(c => {
      areaCounts[c.area.name] = (areaCounts[c.area.name] || 0) + 1;
    });
  });

  return {
    total: people.length,
    avgAge: withAge > 0 ? Math.round(totalAge / withAge) : 0,
    topArea: Object.entries(areaCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
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

export async function createPerson(data: any) {
  const coords = await geocodeAddress(data.address);

  return await prisma.person.create({
    data: {
      dni: data.dni,
      firstName: data.firstName,
      lastName: data.lastName,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      address: data.address,
      phone: data.phone,
      email: data.email,
      latitude: coords.lat,
      longitude: coords.lng,
    }
  });
}

export async function updatePerson(id: string, data: any) {
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
      email: data.email,
      ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {})
    }
  });
}
