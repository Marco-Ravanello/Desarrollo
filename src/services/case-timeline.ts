import prisma from "@/lib/prisma";
import type { DerivationRow } from "@/services/derivations";

// Movimientos de un expediente que no son intervenciones (apertura, derivaciones
// y sus respuestas, cierre), para mostrarlos junto con las intervenciones en
// una sola línea de tiempo.

export type CaseEventKind = "APERTURA" | "CIERRE" | "DERIVACION" | "RESPUESTA";

export type CaseEvent = {
  id: string;
  kind: CaseEventKind;
  date: string;
  title: string;
  detail: string | null;
  author: string | null;
  /** Cómo terminó una derivación (para el color). */
  outcome?: "PENDIENTE" | "ACEPTADA" | "RECHAZADA";
};

export async function getCaseEvents(
  caseItem: { id: string; createdAt: Date; areaName: string },
  derivations: DerivationRow[]
): Promise<CaseEvent[]> {
  const logs = await prisma.auditLog.findMany({
    where: { entity: "Case", entityId: caseItem.id, action: { in: ["CREATE_CASE", "CLOSE_CASE"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, action: true, userId: true, createdAt: true },
  });
  const userIds = Array.from(new Set(logs.map((l) => l.userId).filter((id): id is string => Boolean(id))));
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [];
  const names = new Map(users.map((u) => [u.id, u.name || null]));
  const nameOf = (userId: string | null) => (userId ? names.get(userId) ?? null : null);

  // El área en la que se abrió es la que hizo la primera derivación (si la hubo).
  const firstDerivation = [...derivations].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  const openedIn = firstDerivation?.fromArea || caseItem.areaName;
  const created = logs.find((l) => l.action === "CREATE_CASE");

  const events: CaseEvent[] = [
    {
      id: "apertura",
      kind: "APERTURA",
      date: caseItem.createdAt.toISOString(),
      title: "Se abrió el expediente",
      detail: `En ${openedIn}.`,
      author: nameOf(created?.userId ?? null),
    },
  ];

  for (const d of derivations) {
    events.push({
      id: `deriv-${d.id}`,
      kind: "DERIVACION",
      date: d.createdAt,
      title: `Derivado de ${d.fromArea} a ${d.toArea}`,
      detail: [`Motivo: ${d.reason}`, d.observations ? `Observaciones: ${d.observations}` : null].filter(Boolean).join("\n"),
      author: d.createdBy,
      outcome: d.status === "RECHAZADA" ? "RECHAZADA" : d.status === "PENDIENTE" ? "PENDIENTE" : "ACEPTADA",
    });
    if (d.respondedAt && d.status !== "PENDIENTE") {
      const rejected = d.status === "RECHAZADA";
      events.push({
        id: `resp-${d.id}`,
        kind: "RESPUESTA",
        date: d.respondedAt,
        title: rejected ? `${d.toArea} rechazó la derivación` : `${d.toArea} aceptó la derivación`,
        detail: rejected
          ? `Volvió a ${d.fromArea}.${d.response ? ` Motivo: ${d.response}` : ""}`
          : `El expediente pasó a ${d.toArea}.${d.response ? ` ${d.response}` : ""}`,
        author: d.respondedBy,
        outcome: rejected ? "RECHAZADA" : "ACEPTADA",
      });
    }
  }

  for (const l of logs.filter((l) => l.action === "CLOSE_CASE")) {
    events.push({
      id: `cierre-${l.id}`,
      kind: "CIERRE",
      date: l.createdAt.toISOString(),
      title: "Se cerró el expediente",
      detail: null,
      author: nameOf(l.userId),
    });
  }

  return events;
}
