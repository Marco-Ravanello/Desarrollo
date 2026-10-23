import prisma from "@/lib/prisma";
import { todayInArgentina } from "@/lib/follow-up-dates";
import { plural } from "@/lib/formato";
import { TZ_AR } from "@/lib/fechas";

function formatRelativeTime(date: Date) {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return "Ahora mismo";
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} h`;
  return new Date(date).toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: TZ_AR });
}

export async function getWarRoomData() {
  try {
    let totalCitizens = 0;
    try {
      const padronCountRes: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as total FROM padron_unificado;`);
      totalCitizens = padronCountRes[0]?.total || 0;
    } catch (e) {
      totalCitizens = await prisma.person.count().catch(() => 0);
    }

    const [
      activeCriticalCases,
      resolvedToday,
      activeVehicles,
      totalVehicles,
      committedBudgetAgg,
      realCases,
      areasWithCases,
      supplies
    ] = await Promise.all([
      prisma.case.count({
        where: {
          priority: { in: ['URGENTE', 'ALTA'] },
          status: { in: ['ABIERTO', 'EN_PROCESO', 'PENDIENTE'] }
        }
      }).catch(() => 0),
      // Cerrados hoy (día de Argentina): antes contaba todos los cerrados de la historia.
      prisma.case.count({
        where: { status: 'CERRADO', updatedAt: { gte: new Date(`${todayInArgentina()}T00:00:00-03:00`) } }
      }).catch(() => 0),
      prisma.vehicle.count({ where: { status: 'DISPONIBLE' } }).catch(() => 0),
      prisma.vehicle.count().catch(() => 0),
      prisma.purchaseOrder.aggregate({
        where: { status: { in: ['APROBADA', 'CUMPLIDA'] } },
        _sum: { amount: true }
      }).catch(() => ({ _sum: { amount: null } })),
      prisma.case.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: {
          area: true,
          person: true
        }
      }).catch(() => []),
      prisma.area.findMany({
        include: {
          _count: {
            select: { cases: { where: { status: { in: ['ABIERTO', 'EN_PROCESO'] } } } }
          }
        }
      }).catch(() => []),
      prisma.supplyItem.findMany().catch(() => [])
    ]);

    const budgetTotal = Number(committedBudgetAgg._sum.amount || 0);
    const committedBudgetFormatted = budgetTotal > 0
      ? `$ ${budgetTotal.toLocaleString("es-AR")}`
      : "$ 0";

    // Cuántos insumos están por debajo de su mínimo (antes era un porcentaje que no se entendía).
    const suppliesBelowMin = supplies.filter((item) => item.stock < item.minStock).length;
    const suppliesTotal = supplies.length;

    const territorialAlerts = realCases.map((c) => ({
      id: c.id,
      area: c.area?.name || "Sin área",
      title: `${c.title} — ${c.person ? `${c.person.lastName}, ${c.person.firstName}` : 'Sin titular'} ${c.person?.address ? `(${c.person.address})` : ''}`,
      time: formatRelativeTime(c.createdAt),
      priority: c.priority,
      status: c.status
    }));

    const totalActiveCasesAll = areasWithCases.reduce((acc, a) => acc + a._count.cases, 0);
    const areaStatus = areasWithCases.map((a) => {
      const activeCount = a._count.cases;
      const percentage = totalActiveCasesAll > 0 ? Math.round((activeCount / totalActiveCasesAll) * 100) : 0;
      return {
        id: a.id,
        name: a.name,
        activeCases: activeCount,
        percentage,
        badgeText: activeCount > 0 ? plural(activeCount, "expediente abierto") : "Sin expedientes abiertos"
      };
    });

    return {
      totalCitizens,
      activeCriticalCases,
      resolvedToday,
      activeVehicles,
      totalVehicles,
      suppliesBelowMin,
      suppliesTotal,
      committedBudgetFormatted,
      territorialAlerts,
      areaStatus
    };
  } catch (error) {
    console.error("Error fetching War Room data:", error);
    return {
      totalCitizens: 0,
      activeCriticalCases: 0,
      resolvedToday: 0,
      activeVehicles: 0,
      totalVehicles: 0,
      suppliesBelowMin: 0,
      suppliesTotal: 0,
      committedBudgetFormatted: "$ 0",
      territorialAlerts: [],
      areaStatus: []
    };
  }
}
