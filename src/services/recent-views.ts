import prisma from "@/lib/prisma";
import { parseRecent, type RecentKind } from "@/lib/recent-views";
import { isSensitiveArea } from "@/lib/sensitive-areas";

export interface RecentItem {
  kind: RecentKind;
  id: string;
  title: string;
  subtitle: string;
  url: string;
  /** De las personas, para el color de sus iniciales. */
  dni?: string;
}

function nameFromPadron(nombreCompleto: string | null): string {
  const raw = (nombreCompleto || "").trim();
  if (!raw.includes(",")) return raw;
  const [last, ...rest] = raw.split(",");
  return `${rest.join(",").trim()} ${last.trim()}`.trim();
}

/**
 * Datos para mostrar los vistos recientemente, en el mismo orden. Lo que ya no existe
 * o no se puede ver (expedientes de Violencia de Género sin permiso) queda afuera.
 */
export async function getRecentItems(rawRefs: unknown, canViewSensitive: boolean): Promise<RecentItem[]> {
  const refs = parseRecent(rawRefs);
  const caseIds = refs.filter((r) => r.kind === "case").map((r) => r.id);
  const personIds = refs.filter((r) => r.kind === "person").map((r) => r.id);

  const [cases, people, padron] = await Promise.all([
    caseIds.length
      ? prisma.case.findMany({
          where: { id: { in: caseIds } },
          select: {
            id: true,
            title: true,
            status: true,
            area: { select: { name: true } },
            person: { select: { firstName: true, lastName: true } },
          },
        })
      : [],
    personIds.length
      ? prisma.person.findMany({
          // La ficha de una persona se abre por su id o por su DNI.
          where: { OR: [{ id: { in: personIds } }, { dni: { in: personIds } }] },
          select: { id: true, firstName: true, lastName: true, dni: true },
        })
      : [],
    personIds.length
      ? prisma.padronUnificado.findMany({ where: { dni: { in: personIds } }, select: { dni: true, nombre_completo: true } })
      : [],
  ]);

  const items: RecentItem[] = [];
  for (const ref of refs) {
    if (ref.kind === "case") {
      const c = cases.find((x) => x.id === ref.id);
      if (!c || (isSensitiveArea(c.area?.name) && !canViewSensitive)) continue;
      const titular = c.person ? `${c.person.firstName} ${c.person.lastName}`.trim() : "";
      items.push({
        kind: "case",
        id: c.id,
        title: c.title || "Expediente",
        subtitle: [titular, c.area?.name].filter(Boolean).join(" · "),
        url: `/cases/${c.id}`,
      });
    } else {
      const p = people.find((x) => x.id === ref.id) ?? people.find((x) => x.dni === ref.id);
      const fromPadron = padron.find((x) => x.dni === ref.id);
      const name = p ? `${p.firstName} ${p.lastName}`.trim() : fromPadron ? nameFromPadron(fromPadron.nombre_completo) : "";
      if (!name) continue;
      const dni = p?.dni || fromPadron?.dni || "";
      items.push({ kind: "person", id: ref.id, title: name, subtitle: dni ? `DNI ${dni}` : "", url: `/people/${ref.id}`, dni: dni || undefined });
    }
  }
  return items;
}
