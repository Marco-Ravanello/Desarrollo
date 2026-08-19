import prisma from "@/lib/prisma";

export interface NearbyPersonResult {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  address: string | null;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  casesCount?: number;
}

/**
 * Calculates the Haversine distance in meters between two lat/lng points.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Searches for citizens/people within a given radius (in meters) of a reference point.
 * Uses Bounding Box optimization + Haversine filtering, with fallback for PostGIS.
 */
export async function findPeopleNearPoint(
  centerLat: number,
  centerLng: number,
  radiusMeters: number = 500
): Promise<NearbyPersonResult[]> {
  // 1. Try PostGIS query first if available
  try {
    const rawResults = await prisma.$queryRaw<any[]>`
      SELECT
        id,
        "firstName",
        "lastName",
        dni,
        address,
        latitude,
        longitude,
        ROUND(
          ST_Distance(
            ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${centerLng}, ${centerLat}), 4326)::geography
          )::numeric, 1
        ) AS "distanceMeters"
      FROM "Person"
      WHERE latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${centerLng}, ${centerLat}), 4326)::geography,
          ${radiusMeters}
        )
      ORDER BY "distanceMeters" ASC
      LIMIT 50;
    `;
    if (Array.isArray(rawResults) && rawResults.length >= 0) {
      return rawResults.map(r => ({
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        dni: r.dni,
        address: r.address,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        distanceMeters: Number(r.distanceMeters),
      }));
    }
  } catch (postGisError) {
    // PostGIS extension not active on PostgreSQL, fallback smoothly to Bounding Box + Haversine
  }

  // 2. High-performance Bounding Box calculation using @@index([latitude, longitude])
  const latDelta = radiusMeters / 111320;
  const lngDelta = radiusMeters / (111320 * Math.cos((centerLat * Math.PI) / 180));

  const minLat = centerLat - latDelta;
  const maxLat = centerLat + latDelta;
  const minLng = centerLng - lngDelta;
  const maxLng = centerLng + lngDelta;

  const candidatePeople = await prisma.person.findMany({
    where: {
      latitude: { gte: minLat, lte: maxLat, not: null },
      longitude: { gte: minLng, lte: maxLng, not: null },
    },
    include: {
      _count: {
        select: { cases: true }
      }
    },
    take: 100,
  });

  const nearbyPeople: NearbyPersonResult[] = [];

  for (const person of candidatePeople) {
    if (person.latitude === null || person.longitude === null) continue;

    const distance = calculateHaversineDistance(
      centerLat,
      centerLng,
      person.latitude,
      person.longitude
    );

    if (distance <= radiusMeters) {
      nearbyPeople.push({
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        dni: person.dni,
        address: person.address,
        latitude: person.latitude,
        longitude: person.longitude,
        distanceMeters: distance,
        casesCount: person._count.cases,
      });
    }
  }

  nearbyPeople.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return nearbyPeople.slice(0, 50);
}
