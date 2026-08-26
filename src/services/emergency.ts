import prisma from "@/lib/prisma";

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

    return {
      incidents,
      emergencyStock,
      shelters: realShelters,
      availableVehiclesCount: vehicles.length
    };
  } catch (error) {
    console.error("Error fetching emergency data:", error);
    return {
      incidents: [],
      emergencyStock: [],
      shelters: [],
      availableVehiclesCount: 0
    };
  }
}
