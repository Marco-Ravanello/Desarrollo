import prisma from "@/lib/prisma";
import { EMERGENCY_CATEGORIES, EmergencyCategoryKey, cleanItemQuantities, quantityText } from "@/lib/emergency-categories";
import { getEmergencyExtraItemOptions } from "@/services/emergency";
import type { FichaHistorial } from "@/services/ficha-social";
import { isSensitiveArea } from "@/lib/sensitive-areas";
import { interventionTypeLabel } from "@/lib/intervention-types";

// Lo que la municipalidad hizo con una persona (por DNI) para la Ficha Social 360°:
// expedientes, intervenciones, fichas de tormenta y entregas recibidas.

const MAX_INTERVENTIONS = 50;

function itemsText(quantities: Partial<Record<EmergencyCategoryKey, number>>, extras: Record<string, number>, names: Map<string, string>): string {
  const parts = EMERGENCY_CATEGORIES.filter((c) => (quantities[c.key] || 0) > 0).map((c) => quantityText(c.key, quantities[c.key]!));
  for (const [id, n] of Object.entries(extras)) parts.push(`${n} ${names.get(id) || "insumo eliminado"}`);
  return parts.join(", ");
}

export async function getFichaHistorial(dni: string, opts: { canViewSensitive: boolean }): Promise<FichaHistorial> {
  const person = await prisma.person.findUnique({
    where: { dni },
    select: { id: true, firstName: true, lastName: true, address: true },
  });

  const records = await prisma.stormVictimRecord.findMany({
    where: { OR: [{ dni }, ...(person ? [{ personId: person.id }] : [])] },
    orderBy: { createdAt: "desc" },
    include: { entregas: { orderBy: { createdAt: "asc" } } },
  });

  const cases = person
    ? await prisma.case.findMany({
        where: { personId: person.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, status: true, priority: true, createdAt: true, updatedAt: true, area: { select: { name: true } } },
      })
    : [];
  const visibleCases = cases.filter((c) => opts.canViewSensitive || !isSensitiveArea(c.area?.name));

  const interventions = person
    ? (
        await prisma.intervention.findMany({
          where: { personId: person.id },
          orderBy: { date: "desc" },
          select: { id: true, date: true, description: true, type: true, userId: true, caseId: true, case: { select: { title: true, area: { select: { name: true } } } } },
        })
      ).filter((i) => opts.canViewSensitive || !isSensitiveArea(i.case?.area?.name))
    : [];
  const shownInterventions = interventions.slice(0, MAX_INTERVENTIONS);

  const userIds = Array.from(new Set(shownInterventions.map((i) => i.userId)));
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [];
  const userNames = new Map(users.map((u) => [u.id, u.name || "Usuario"]));

  const extraNames = new Map((records.length ? await getEmergencyExtraItemOptions() : []).map((o) => [o.id, o.name]));

  return {
    personaId: person?.id ?? null,
    nombre: person ? `${person.lastName}, ${person.firstName}` : records[0]?.nombreApellido ?? null,
    expedientes: visibleCases.map((c) => ({
      id: c.id,
      titulo: c.title,
      estado: c.status,
      prioridad: c.priority,
      area: c.area?.name || "Sin área",
      abierto: c.createdAt.toISOString(),
      actualizado: c.updatedAt.toISOString(),
    })),
    intervenciones: shownInterventions.map((i) => ({
      id: i.id,
      fecha: i.date.toISOString(),
      descripcion: i.description,
      tipo: interventionTypeLabel(i.type),
      expediente: i.case?.title || null,
      expedienteId: i.caseId,
      area: i.case?.area?.name || null,
      usuario: userNames.get(i.userId) || null,
    })),
    intervencionesTotal: interventions.length,
    fichasTormenta: records.map((r) => {
      const pedido = itemsText(
        { COLCHON: r.cantidadColchon, CAMA: r.cantidadCama, CUCHETA: r.cantidadCucheta, FRAZADA: r.cantidadFrazada },
        cleanItemQuantities(r.otrosElementos),
        extraNames
      );
      return {
        id: r.id,
        fecha: r.createdAt.toISOString(),
        domicilio: [r.domicilio, r.barrio].filter(Boolean).join(" · "),
        prioridad: r.prioridad,
        pedido: pedido || "Sin pedido de elementos",
        relevadoPor: r.agentes || null,
        entregas: r.entregas.map((e) => ({
          id: e.id,
          fecha: e.createdAt.toISOString(),
          elementos: itemsText(
            { COLCHON: e.colchones, CAMA: e.camas, CUCHETA: e.cuchetas, FRAZADA: e.frazadas },
            cleanItemQuantities(e.otrosElementos),
            extraNames
          ) || "Sin elementos",
          entregadoPor: e.userName,
          observaciones: e.observaciones || null,
        })),
      };
    }),
  };
}
