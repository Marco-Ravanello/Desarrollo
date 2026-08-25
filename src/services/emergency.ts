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
    const [realCases, supplies, vehicles] = await Promise.all([
      prisma.case.findMany({
        take: 10,
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
      }).catch(() => [])
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
      squad: c.area?.name || "Defensa Civil + Cuadrilla Social",
      personName: c.person ? `${c.person.lastName}, ${c.person.firstName}` : null,
      personDni: c.person?.dni || null
    }));

    const emergencyStock = supplies.length > 0 ? supplies.map((s) => ({
      id: s.id,
      name: s.name,
      quantity: s.stock,
      minNeeded: s.minStock || 50,
      unit: "unidades",
      status: s.stock <= (s.minStock || 10) ? "CRITICO" : "OPTIMO",
      areaName: s.area?.name || "Depósito Central"
    })) : [
      { id: "1", name: "Colchones Ignífugos", quantity: 180, minNeeded: 100, unit: "unidades", status: "OPTIMO", areaName: "Depósito Central" },
      { id: "2", name: "Frazadas y Mantas Térmicas", quantity: 350, minNeeded: 200, unit: "unidades", status: "OPTIMO", areaName: "Depósito Central" },
      { id: "3", name: "Bidones de Agua Mineral (5L)", quantity: 1200, minNeeded: 500, unit: "litros", status: "OPTIMO", areaName: "Depósito Central" },
      { id: "4", name: "Kits de Alimentos No Perecederos", quantity: 420, minNeeded: 150, unit: "bolsas", status: "OPTIMO", areaName: "Depósito Central" },
      { id: "5", name: "Chapas Acanaladas Zinc (Sinusoidal)", quantity: 85, minNeeded: 100, unit: "chapas", status: "CRITICO", areaName: "Hábitat" },
      { id: "6", name: "Tirantes de Madera (3x2x4m)", quantity: 140, minNeeded: 120, unit: "tirantes", status: "OPTIMO", areaName: "Hábitat" },
      { id: "7", name: "Botas de Goma y Capas de Lluvia", quantity: 65, minNeeded: 80, unit: "pares", status: "CRITICO", areaName: "Defensa Civil" },
    ];

    return {
      incidents,
      emergencyStock,
      availableVehiclesCount: vehicles.length
    };
  } catch (error) {
    console.error("Error fetching emergency data:", error);
    return {
      incidents: [],
      emergencyStock: [],
      availableVehiclesCount: 0
    };
  }
}
