import prisma from "@/lib/prisma";
import { todayInArgentina, addDays } from "@/lib/follow-up-dates";
import { diaAR, diaDeVencimiento, formatHora } from "@/lib/fechas";
import { getAreaShortName } from "@/lib/area-theme";
import { courseMeetsOn, courseStartMinutes, reservationWhen, sortTodayItems, type TodayItem } from "@/lib/war-room-tv";

/**
 * "Hoy en la Secretaría" para la tele de la Sala de Situación (idea 117): vehículos que salen,
 * recorridas, entregas de órdenes de compra y cursos del día. Nada de personas atendidas ni
 * de expedientes: es una pantalla que puede ver cualquiera que pase.
 */
export async function getWarRoomToday(now = new Date()): Promise<{ today: string; items: TodayItem[]; total: number }> {
  const today = todayInArgentina(now);
  const dayStart = new Date(`${today}T00:00:00-03:00`);
  const dayEnd = new Date(`${addDays(today, 1)}T00:00:00-03:00`);
  // Las fechas de calendario (recorridas, cursos) se guardan a medianoche UTC.
  const calendarDay = new Date(`${today}T00:00:00Z`);

  const [reservations, recorridas, orders, cursos] = await Promise.all([
    prisma.vehicleReservation
      .findMany({
        where: { status: { in: ["APROBADA", "EN_CURSO", "PENDIENTE"] }, startDate: { lt: dayEnd }, endDate: { gt: dayStart } },
        select: {
          id: true, startDate: true, endDate: true, status: true, reason: true,
          vehicle: { select: { brand: true, model: true, plate: true } },
          user: { select: { area: { select: { name: true } } } },
        },
        take: 30,
      })
      .catch(() => []),
    prisma.recorrida
      .findMany({
        where: { fecha: calendarDay },
        select: { id: true, barrio: true, objetivo: true, estado: true, _count: { select: { visitas: true } } },
        take: 30,
      })
      .catch(() => []),
    prisma.purchaseOrder
      .findMany({
        // Un margen de un día para cada lado: después se mira el día con la misma regla que los vencimientos.
        where: { status: "APROBADA", deliveryDate: { gte: new Date(dayStart.getTime() - 86400000), lt: new Date(dayEnd.getTime() + 86400000) } },
        select: { id: true, number: true, description: true, providerName: true, provider: { select: { name: true } }, deliveryDate: true },
        take: 30,
      })
      .catch(() => []),
    prisma.curso
      .findMany({
        where: { estado: "ABIERTO", fechaInicio: { lte: calendarDay }, OR: [{ fechaFin: null }, { fechaFin: { gte: calendarDay } }] },
        select: { id: true, nombre: true, horario: true, lugar: true, tipo: true },
        take: 100,
      })
      .catch(() => []),
  ]);

  const items: TodayItem[] = [];

  for (const r of reservations) {
    const { when, sortMinutes } = reservationWhen(
      today,
      { day: diaAR(r.startDate), time: formatHora(r.startDate) },
      { day: diaAR(r.endDate), time: formatHora(r.endDate) }
    );
    const area = r.user?.area?.name ? getAreaShortName(r.user.area.name) : null;
    items.push({
      id: `v-${r.id}`,
      kind: "vehiculo",
      when,
      sortMinutes,
      title: `${r.vehicle.brand} ${r.vehicle.model} (${r.vehicle.plate})`,
      detail: [area, r.status === "EN_CURSO" ? "En la calle" : null].filter(Boolean).join(" · ") || null,
      pending: r.status === "PENDIENTE",
    });
  }

  for (const r of recorridas) {
    items.push({
      id: `r-${r.id}`,
      kind: "recorrida",
      when: r.estado === "HECHA" ? "Ya se hizo" : "Todo el día",
      sortMinutes: -1,
      title: `Recorrida por ${r.barrio}`,
      detail: [r.objetivo?.trim() || null, r._count.visitas ? `${r._count.visitas} ${r._count.visitas === 1 ? "casa" : "casas"} para visitar` : null]
        .filter(Boolean)
        .join(" · ") || null,
      pending: false,
    });
  }

  for (const o of orders) {
    if (!o.deliveryDate || diaDeVencimiento(o.deliveryDate) !== today) continue;
    items.push({
      id: `o-${o.id}`,
      kind: "entrega",
      when: "Todo el día",
      sortMinutes: -1,
      title: `Entrega de la orden ${o.number}`,
      detail: o.provider?.name || o.providerName || o.description || null,
      pending: false,
    });
  }

  for (const c of cursos) {
    if (!courseMeetsOn(c.horario, today)) continue;
    items.push({
      id: `c-${c.id}`,
      kind: "clase",
      when: c.horario || "",
      sortMinutes: courseStartMinutes(c.horario),
      title: `${c.tipo === "TALLER" ? "Taller" : "Curso"}: ${c.nombre}`,
      detail: c.lugar || null,
      pending: false,
    });
  }

  return { today, items: sortTodayItems(items), total: items.length };
}
