import prisma from "@/lib/prisma";
import { EmergencyRadarData, VulnerableGroupStats, HydrologicalZone, RadarAtmosphericMetrics } from "@/types/emergency";

function formatRelativeTime(date: Date) {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return "Recién";
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} h`;
  return new Date(date).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

async function getLiveAtmosphericMetrics(): Promise<RadarAtmosphericMetrics> {
  try {
    const res = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=-34.603&longitude=-58.558&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_gusts_10m,precipitation&timezone=America/Argentina/Buenos_Aires",
      { next: { revalidate: 300 } }
    );
    if (!res.ok) throw new Error("Weather API failed");
    const data = await res.json();
    const cur = data.current || {};
    return {
      surfaceTempC: Math.round((cur.temperature_2m ?? 21.0) * 10) / 10,
      humidityPercent: Math.round(cur.relative_humidity_2m ?? 65),
      pressureHpa: Math.round((cur.surface_pressure ?? 1012.0) * 10) / 10,
      windGustsKmH: Math.round(cur.wind_gusts_10m ?? 22),
      dewPointC: Math.round(((cur.temperature_2m ?? 21.0) - ((100 - (cur.relative_humidity_2m ?? 65)) / 5)) * 10) / 10,
      accumulatedRain24hMm: Math.round((cur.precipitation ?? 0) * 10) / 10
    };
  } catch (e) {
    return {
      surfaceTempC: 21.0,
      humidityPercent: 65,
      pressureHpa: 1012.0,
      windGustsKmH: 22,
      dewPointC: 14.0,
      accumulatedRain24hMm: 0.0
    };
  }
}

export async function getEmergencyVulnerableStats(): Promise<VulnerableGroupStats> {
  let totalInFloodRiskAreas = 0;
  let electrodependientesCount = 0;
  let disabilityCudCount = 0;
  let minorsUnder5Count = 0;
  let elderlyOver75Count = 0;
  try {
    const [floodRes, minorsRes, elderlyRes, specialNeedsRes]: any[] = await Promise.all([
      prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as count FROM padron_unificado
         WHERE LOWER(COALESCE(barrio, localidad, direccion, '')) SIMILAR TO '%(puerta 8|libertador|churruca|11 de septiembre|derqui|ciudadela sur|loma hermosa|andes|apache)%';`
      ).catch(() => [{ count: 0 }]),
      prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as count FROM padron_unificado
         WHERE (edad_aprox ~ '^[0-9]+$' AND edad_aprox::int <= 5)
            OR (fecha_nacimiento ~ '[0-9]{4}' AND (EXTRACT(YEAR FROM CURRENT_DATE) - substring(fecha_nacimiento from '([0-9]{4})')::int) <= 5);`
      ).catch(() => [{ count: 0 }]),
      prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as count FROM padron_unificado
         WHERE (edad_aprox ~ '^[0-9]+$' AND edad_aprox::int >= 75)
            OR (fecha_nacimiento ~ '[0-9]{4}' AND (EXTRACT(YEAR FROM CURRENT_DATE) - substring(fecha_nacimiento from '([0-9]{4})')::int) >= 75);`
      ).catch(() => [{ count: 0 }]),
      prisma.$queryRawUnsafe(
        `SELECT
          COUNT(CASE WHEN LOWER(COALESCE(roles, '')) LIKE '%electro%' THEN 1 END)::int as electro,
          COUNT(CASE WHEN LOWER(COALESCE(roles, '')) LIKE '%cud%' OR LOWER(COALESCE(roles, '')) LIKE '%discapacidad%' THEN 1 END)::int as cud
         FROM padron_unificado;`
      ).catch(() => [{ electro: 0, cud: 0 }])
    ]);
    totalInFloodRiskAreas = floodRes[0]?.count || 0;
    minorsUnder5Count = minorsRes[0]?.count || 0;
    elderlyOver75Count = elderlyRes[0]?.count || 0;
    electrodependientesCount = specialNeedsRes[0]?.electro || 0;
    disabilityCudCount = specialNeedsRes[0]?.cud || 0;
  } catch (e) {
    console.error("Error computing dynamic vulnerable stats:", e);
  }
  if (totalInFloodRiskAreas === 0 && minorsUnder5Count === 0 && elderlyOver75Count === 0) {
    try {
      const [personMinors, personElderly] = await Promise.all([
        prisma.$queryRawUnsafe(
          `SELECT COUNT(*)::int as count FROM "Person" WHERE "birthDate" >= CURRENT_DATE - INTERVAL '5 years';`
        ).catch(() => [{ count: 0 }]),
        prisma.$queryRawUnsafe(
          `SELECT COUNT(*)::int as count FROM "Person" WHERE "birthDate" <= CURRENT_DATE - INTERVAL '75 years';`
        ).catch(() => [{ count: 0 }])
      ]);
      minorsUnder5Count = (personMinors as any)[0]?.count || 0;
      elderlyOver75Count = (personElderly as any)[0]?.count || 0;
      totalInFloodRiskAreas = minorsUnder5Count + elderlyOver75Count;
    } catch (e) {}
  }
  return {
    totalInFloodRiskAreas,
    electrodependientesCount,
    disabilityCudCount,
    minorsUnder5Count,
    elderlyOver75Count
  };
}

async function getHydrologicalZonesData(): Promise<HydrologicalZone[]> {
  const zoneDefinitions = [
    {
      id: "zone-1",
      name: "Cuenca Baja Puerta 8 & B° El Libertador",
      basin: "Arroyo Morón - Tramo Norte 3F",
      waterLevelMeters: 2.15,
      criticalThresholdMeters: 2.50,
      status: "ALERTA_PREVENTIVA" as const,
      activePumps: 3,
      totalPumps: 4,
      coordinates: [-34.5680, -58.6050] as [number, number],
      neighborhoodKeywords: ["puerta 8", "libertador", "el libertador"]
    },
    {
      id: "zone-2",
      name: "Cuenca Arroyo Morón (Ruta 8)",
      basin: "Arroyo Morón - Loma Hermosa",
      waterLevelMeters: 1.85,
      criticalThresholdMeters: 2.80,
      status: "NORMAL" as const,
      activePumps: 2,
      totalPumps: 3,
      coordinates: [-34.5680, -58.5980] as [number, number],
      neighborhoodKeywords: ["loma hermosa", "moron", "ruta 8"]
    },
    {
      id: "zone-3",
      name: "Cuenca Ciudadela Sur & Barrio Rivadavia",
      basin: "Cuenca Maldonado - Ramos Mejía Limit",
      waterLevelMeters: 2.42,
      criticalThresholdMeters: 2.60,
      status: "DESBORDE_IMMINENTE" as const,
      activePumps: 4,
      totalPumps: 4,
      coordinates: [-34.6430, -58.5390] as [number, number],
      neighborhoodKeywords: ["ciudadela", "ciudadela sur", "rivadavia"]
    },
    {
      id: "zone-4",
      name: "Churruca & Once de Septiembre",
      basin: "Arroyo Morón - Colector Secundario",
      waterLevelMeters: 1.40,
      criticalThresholdMeters: 2.40,
      status: "NORMAL" as const,
      activePumps: 2,
      totalPumps: 2,
      coordinates: [-34.5700, -58.6180] as [number, number],
      neighborhoodKeywords: ["churruca", "11 de septiembre", "once de septiembre"]
    },
    {
      id: "zone-5",
      name: "Pasos Bajo Nivel Caseros / Santos Lugares",
      basin: "Sistema Depresor FFCC San Martín / Urquiza",
      waterLevelMeters: 1.10,
      criticalThresholdMeters: 2.00,
      status: "NORMAL" as const,
      activePumps: 3,
      totalPumps: 3,
      coordinates: [-34.6080, -58.5630] as [number, number],
      neighborhoodKeywords: ["caseros", "santos lugares"]
    }
  ];

  return await Promise.all(
    zoneDefinitions.map(async (zd) => {
      let vulnerablePeopleCount = 0;
      let cuitElectrodependientes = 0;
      let minorsUnder5 = 0;
      let elderlyOver75 = 0;
      try {
        const pattern = `%(${zd.neighborhoodKeywords.join("|")})%`;
        const res: any[] = await prisma.$queryRawUnsafe(
          `SELECT
            COUNT(*)::int as total,
            COUNT(CASE WHEN (edad_aprox ~ '^[0-9]+$' AND edad_aprox::int <= 5) OR (fecha_nacimiento ~ '(2019|202[0-9])') THEN 1 END)::int as minors,
            COUNT(CASE WHEN (edad_aprox ~ '^[0-9]+$' AND edad_aprox::int >= 75) OR (fecha_nacimiento ~ '19[0-4][0-9]') THEN 1 END)::int as elderly,
            COUNT(CASE WHEN LOWER(COALESCE(roles, '')) LIKE '%electro%' THEN 1 END)::int as electro
           FROM padron_unificado
           WHERE LOWER(COALESCE(barrio, localidad, direccion, '')) SIMILAR TO $1;`,
          pattern
        );
        const row = res[0] || {};
        vulnerablePeopleCount = row.total || 0;
        cuitElectrodependientes = row.electro || 0;
        minorsUnder5 = row.minors || 0;
        elderlyOver75 = row.elderly || 0;
      } catch (e) {}

      if (vulnerablePeopleCount === 0) {
        try {
          const personRes = await prisma.person.findMany({
            where: {
              OR: zd.neighborhoodKeywords.map((k) => ({
                address: { contains: k, mode: "insensitive" as const }
              }))
            },
            select: { birthDate: true }
          });
          vulnerablePeopleCount = personRes.length;
          const nowYear = new Date().getFullYear();
          personRes.forEach((p) => {
            if (p.birthDate) {
              const age = nowYear - new Date(p.birthDate).getFullYear();
              if (age <= 5) minorsUnder5++;
              if (age >= 75) elderlyOver75++;
            }
          });
        } catch (e) {}
      }

      return {
        id: zd.id,
        name: zd.name,
        basin: zd.basin,
        waterLevelMeters: zd.waterLevelMeters,
        criticalThresholdMeters: zd.criticalThresholdMeters,
        status: zd.status,
        activePumps: zd.activePumps,
        totalPumps: zd.totalPumps,
        vulnerablePeopleCount,
        cuitElectrodependientes,
        minorsUnder5,
        elderlyOver75,
        coordinates: zd.coordinates
      };
    })
  );
}

export async function getEmergencyRadarData(overrideStats?: VulnerableGroupStats): Promise<EmergencyRadarData> {
  const [metrics, hydrologicalZones] = await Promise.all([
    getLiveAtmosphericMetrics(),
    getHydrologicalZonesData()
  ]);

  return {
    alert: {
      level: "AMARILLO",
      title: "Alerta Amarilla por Tormentas Fuertes - SMN SAT",
      description: "Se prevén tormentas aisladas con abundante caída de agua en cortos períodos, ráfagas de viento de hasta 75 km/h y eventual caída de granizo en el Área Metropolitana de Buenos Aires.",
      issuedAt: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      validUntil: "23:59 hs",
      windSpeedMaxKmH: 75,
      expectedRainfallMm: 45,
      hailRisk: true
    },
    radarCells: [
      {
        id: "cell-1",
        name: "Celda S-01 (Frente Sudoeste)",
        reflectivityDbz: 52,
        distanceKm: 18,
        bearingDeg: 220,
        direction: "Sudoeste -> Noreste",
        estimatedArrivalMinutes: 22,
        cellType: "SEVERA",
        affectedNeighborhoods: ["Ciudadela Sur", "Barrio Ejército de los Andes", "Caseros"]
      },
      {
        id: "cell-2",
        name: "Celda N-02 (Cuenca Arroyo Morón)",
        reflectivityDbz: 42,
        distanceKm: 28,
        bearingDeg: 310,
        direction: "Noroeste -> Este",
        estimatedArrivalMinutes: 35,
        cellType: "MODERADA",
        affectedNeighborhoods: ["Barrio El Libertador", "Puerta 8", "Loma Hermosa"]
      },
      {
        id: "cell-3",
        name: "Celda C-03 (Frente Sur)",
        reflectivityDbz: 38,
        distanceKm: 12,
        bearingDeg: 180,
        direction: "Sur -> Norte",
        estimatedArrivalMinutes: 15,
        cellType: "MODERADA",
        affectedNeighborhoods: ["Sáenz Peña", "Santos Lugares", "José Ingenieros"]
      }
    ],
    hydrologicalZones,
    vulnerableStats: overrideStats || {
      totalInFloodRiskAreas: 0,
      electrodependientesCount: 0,
      disabilityCudCount: 0,
      minorsUnder5Count: 0,
      elderlyOver75Count: 0
    },
    metrics,
    lastRadarSweep: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
  };
}

export async function getEmergencyData() {
  try {
    const [realCases, supplies, availableVehicles, allVehicles, shelters, dynamicVulnerableStats] = await Promise.all([
      prisma.case.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          area: true,
          person: true
        }
      }).catch(() => []),
      prisma.supplyItem.findMany({
        include: { area: true }
      }).catch(() => []),
      prisma.vehicle.findMany({
        where: { status: 'DISPONIBLE' }
      }).catch(() => []),
      prisma.vehicle.findMany().catch(() => []),
      // @ts-ignore
      prisma.shelter ? prisma.shelter.findMany({ orderBy: { createdAt: 'desc' } }).catch(() => []) : Promise.resolve([]),
      getEmergencyVulnerableStats().catch(() => ({
        totalInFloodRiskAreas: 0,
        electrodependientesCount: 0,
        disabilityCudCount: 0,
        minorsUnder5Count: 0,
        elderlyOver75Count: 0
      }))
    ]);

    const incidents = realCases.map((c) => ({
      id: c.id,
      neighborhood: c.person?.address ? c.person.address.split(",")[0] : "Territorio Municipal",
      address: c.person?.address || "Mesa de Entradas General",
      type: c.title,
      priority: c.priority === 'URGENTE' ? 'CRITICA' : c.priority,
      affectedPeople: 1,
      time: formatRelativeTime(c.createdAt),
      status: c.status === 'CERRADO' ? 'ASISTIDO' : 'EN_CURSO',
      squad: c.area?.name || "Defensa Civil + Guardia Territorial",
      personName: c.person ? `${c.person.lastName}, ${c.person.firstName}` : null,
      personDni: c.person?.dni || null
    }));

    const emergencyStock = supplies.map((s) => ({
      id: s.id,
      name: s.name,
      quantity: s.stock,
      minNeeded: s.minStock || 50,
      unit: "unidades",
      status: s.stock <= (s.minStock || 10) ? "CRITICO" : "OPTIMO",
      areaName: s.area?.name || "Depósito Central"
    }));

    const realShelters = shelters.map((sh: any) => ({
      id: sh.id,
      name: sh.name,
      address: sh.address,
      coordinator: sh.coordinator,
      capacity: sh.capacity,
      occupied: sh.occupied,
      rationsDelivered: sh.rationsDelivered,
      status: sh.status
    }));

    const radarData = await getEmergencyRadarData(dynamicVulnerableStats);

    return {
      incidents,
      emergencyStock,
      shelters: realShelters,
      availableVehiclesCount: availableVehicles.length,
      totalVehiclesCount: allVehicles.length,
      radarData
    };
  } catch (error) {
    console.error("Error fetching emergency data:", error);
    const radarData = await getEmergencyRadarData();
    return {
      incidents: [],
      emergencyStock: [],
      shelters: [],
      availableVehiclesCount: 0,
      totalVehiclesCount: 0,
      radarData
    };
  }
}
