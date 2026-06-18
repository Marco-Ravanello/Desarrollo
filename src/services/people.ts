import prisma from "@/lib/prisma";

export async function getPeople(query?: string) {
  return await prisma.person.findMany({
    where: query ? {
      OR: [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { dni: { contains: query } },
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

/**
 * Intenta geocodificar una dirección usando el servicio público de OSM Nominatim.
 * Retorna coordenadas por defecto (Muni) si falla.
 */
async function geocodeAddress(address: string) {
    try {
        // Codificar la dirección para la URL
        const query = encodeURIComponent(address);
        // Nominatim requiere un User-Agent identificable
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
            headers: {
                'User-Agent': 'MuniGestio-Platform/1.0'
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

    // Coordenadas por defecto si falla (Centro aproximado del municipio)
    return {
        lat: -34.6037 + (Math.random() - 0.5) * 0.01,
        lng: -58.3816 + (Math.random() - 0.5) * 0.01
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
  // Si la dirección cambió, re-geocodificamos
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
