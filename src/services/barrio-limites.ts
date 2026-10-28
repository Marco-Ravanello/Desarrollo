import prisma from "@/lib/prisma";
import { BARRIOS_3F, type Barrio3F } from "@/lib/barrios";
import { CONTORNOS_OSM } from "@/lib/barrios-contornos-osm";
import { barrioDelPunto, canEditLimites, limiteDeJson, parseLimite, puntoDentro, type Limite } from "@/lib/barrio-limites";

// El límite de cada barrio: el que se dibujó en la app o, si no hay, el contorno de OpenStreetMap que viene
// con la app. Sirve para marcar en el mapa del barrio los puntos que caen afuera y decir dónde caen.

type Actor = { id?: string | null; role?: string | null };
type Result = { success: true } | { success: false; error: string };

export type LimiteOrigen = "DIBUJADO" | "OSM";
export type LimiteBarrio = { puntos: Limite; origen: LimiteOrigen; editadoPor: string | null; editadoEl: Date | null };

const officialBarrio = (barrio: string): Barrio3F | null => BARRIOS_3F.find((b) => b === barrio) ?? null;

/** Los límites de todos los barrios que tienen uno (el dibujado le gana al de OpenStreetMap). */
export async function getLimites(): Promise<Map<Barrio3F, LimiteBarrio>> {
  const rows = await prisma.barrioLimite.findMany();
  const users = rows.map((r) => r.updatedById).filter((id): id is string => Boolean(id));
  const names = new Map(
    (users.length ? await prisma.user.findMany({ where: { id: { in: users } }, select: { id: true, name: true, username: true } }) : []).map((u) => [
      u.id,
      u.name || u.username || null,
    ])
  );
  const out = new Map<Barrio3F, LimiteBarrio>();
  for (const b of BARRIOS_3F) {
    const osm = CONTORNOS_OSM[b];
    if (osm) out.set(b, { puntos: osm, origen: "OSM", editadoPor: null, editadoEl: null });
  }
  for (const r of rows) {
    const b = officialBarrio(r.barrio);
    const puntos = limiteDeJson(r.puntos);
    if (b && puntos) out.set(b, { puntos, origen: "DIBUJADO", editadoPor: r.updatedById ? names.get(r.updatedById) ?? null : null, editadoEl: r.updatedAt });
  }
  return out;
}

export async function getLimite(barrio: Barrio3F): Promise<LimiteBarrio | null> {
  return (await getLimites()).get(barrio) ?? null;
}

/** Guarda el límite dibujado. Solo la conducción. Queda en Auditoría. */
export async function saveLimite(user: Actor, barrio: string, raw: unknown): Promise<Result> {
  if (!user.id || !canEditLimites(user.role)) return { success: false, error: "Los límites de los barrios los dibuja la conducción." };
  const b = officialBarrio(barrio);
  if (!b) return { success: false, error: "No se encontró el barrio." };
  const parsed = parseLimite(raw);
  if (!parsed.ok) return { success: false, error: parsed.error };
  await prisma.$transaction([
    prisma.barrioLimite.upsert({
      where: { barrio: b },
      create: { barrio: b, puntos: parsed.puntos, updatedById: user.id },
      update: { puntos: parsed.puntos, updatedById: user.id },
    }),
    prisma.auditLog.create({
      data: { userId: user.id, action: "BARRIO_LIMITE", entity: "Barrio", entityId: b, details: `Dibujó el límite de ${b} (${parsed.puntos.length} puntos).` },
    }),
  ]);
  return { success: true };
}

/** Borra el límite dibujado: vuelve el de OpenStreetMap (o ninguno). */
export async function deleteLimite(user: Actor, barrio: string): Promise<Result> {
  if (!user.id || !canEditLimites(user.role)) return { success: false, error: "Los límites de los barrios los dibuja la conducción." };
  const b = officialBarrio(barrio);
  if (!b) return { success: false, error: "No se encontró el barrio." };
  const { count } = await prisma.barrioLimite.deleteMany({ where: { barrio: b } });
  if (count) {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "BARRIO_LIMITE_BORRADO",
        entity: "Barrio",
        entityId: b,
        details: CONTORNOS_OSM[b] ? `Volvió al límite de OpenStreetMap en ${b}.` : `Borró el límite de ${b}.`,
      },
    });
  }
  return { success: true };
}

/** Para cada punto, si cae afuera del límite (sin límite, ninguno está afuera). */
export function marcarFuera(limite: Limite | null, puntos: { lat: number; lng: number }[]): boolean[] {
  return puntos.map((p) => (limite ? !puntoDentro(p.lat, p.lng, limite) : false));
}

/** En qué barrio cae el punto según los límites que hay, o null. */
export function barrioDondeCae(limites: Map<Barrio3F, LimiteBarrio>, lat: number, lng: number): Barrio3F | null {
  return barrioDelPunto(lat, lng, [...limites.entries()].map(([b, l]) => [b, l.puntos] as [Barrio3F, Limite]));
}
