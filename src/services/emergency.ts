import prisma from "@/lib/prisma";
import { EmergencyRadarData } from "@/types/emergency";

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

export function getEmergencyRadarData(): EmergencyRadarData {
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
    hydrologicalZones: [
      {
        id: "zone-1",
        name: "Cuenca Baja Puerta 8 & B° El Libertador",
        basin: "Arroyo Morón - Tramo Norte 3F",
        waterLevelMeters: 2.15,
        criticalThresholdMeters: 2.50,
        status: "ALERTA_PREVENTIVA",
        activePumps: 3,
        totalPumps: 4,
        vulnerablePeopleCount: 1420,
        cuitElectrodependientes: 12,
        minorsUnder5: 380,
        elderlyOver75: 210,
        coordinates: [-34.5680, -58.6050]
      },
      {
        id: "zone-2",
        name: "Cuenca Arroyo Morón (Ruta 8)",
        basin: "Arroyo Morón - Loma Hermosa",
        waterLevelMeters: 1.85,
        criticalThresholdMeters: 2.80,
        status: "NORMAL",
        activePumps: 2,
        totalPumps: 3,
        vulnerablePeopleCount: 890,
        cuitElectrodependientes: 6,
        minorsUnder5: 195,
        elderlyOver75: 115,
        coordinates: [-34.5680, -58.5980]
      },
      {
        id: "zone-3",
        name: "Cuenca Ciudadela Sur & Barrio Rivadavia",
        basin: "Cuenca Maldonado - Ramos Mejía Limit",
        waterLevelMeters: 2.42,
        criticalThresholdMeters: 2.60,
        status: "DESBORDE_IMMINENTE",
        activePumps: 4,
        totalPumps: 4,
        vulnerablePeopleCount: 2150,
        cuitElectrodependientes: 18,
        minorsUnder5: 520,
        elderlyOver75: 340,
        coordinates: [-34.6430, -58.5390]
      },
      {
        id: "zone-4",
        name: "Churruca & Once de Septiembre",
        basin: "Arroyo Morón - Colector Secundario",
        waterLevelMeters: 1.40,
        criticalThresholdMeters: 2.40,
        status: "NORMAL",
        activePumps: 2,
        totalPumps: 2,
        vulnerablePeopleCount: 640,
        cuitElectrodependientes: 4,
        minorsUnder5: 140,
        elderlyOver75: 90,
        coordinates: [-34.5700, -58.6180]
      },
      {
        id: "zone-5",
        name: "Pasos Bajo Nivel Caseros / Santos Lugares",
        basin: "Sistema Depresor FFCC San Martín / Urquiza",
        waterLevelMeters: 1.10,
        criticalThresholdMeters: 2.00,
        status: "NORMAL",
        activePumps: 3,
        totalPumps: 3,
        vulnerablePeopleCount: 310,
        cuitElectrodependientes: 2,
        minorsUnder5: 45,
        elderlyOver75: 85,
        coordinates: [-34.6080, -58.5630]
      }
    ],
    vulnerableStats: {
      totalInFloodRiskAreas: 5410,
      electrodependientesCount: 42,
      disabilityCudCount: 380,
      minorsUnder5Count: 1280,
      elderlyOver75Count: 840
    },
    metrics: {
      surfaceTempC: 22.4,
      humidityPercent: 88,
      pressureHpa: 1008.2,
      windGustsKmH: 58,
      dewPointC: 20.1,
      accumulatedRain24hMm: 34.5
    },
    lastRadarSweep: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
  };
}

export async function getEmergencyData() {
  try {
    const [realCases, supplies, vehicles, shelters] = await Promise.all([
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
      // @ts-ignore
      prisma.shelter ? prisma.shelter.findMany({ orderBy: { createdAt: 'desc' } }).catch(() => []) : Promise.resolve([])
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

    const radarData = getEmergencyRadarData();

    return {
      incidents,
      emergencyStock,
      shelters: realShelters,
      availableVehiclesCount: vehicles.length,
      radarData
    };
  } catch (error) {
    console.error("Error fetching emergency data:", error);
    return {
      incidents: [],
      emergencyStock: [],
      shelters: [],
      availableVehiclesCount: 0,
      radarData: getEmergencyRadarData()
    };
  }
}
