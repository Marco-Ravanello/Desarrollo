import type { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { diaAR, diaDeVencimiento } from "@/lib/fechas";
import { EXPIRY_NOTICE_DAYS, expiryNotice, type ExpiryKind } from "@/lib/vencimientos";
import { FLEET_ADMIN_ROLES, MANAGEMENT_ROLES } from "@/lib/permissions";

interface ExpiryUser {
  id: string;
  role: Role;
  areaId?: string | null;
}

interface Due {
  kind: ExpiryKind;
  label: string;
  date: Date;
  link: string;
}

/** Lo que vence en el próximo mes (o ya venció) y le toca vigilar a esta persona. */
async function dueFor(user: ExpiryUser, now: Date): Promise<Due[]> {
  const limit = new Date(now.getTime() + (EXPIRY_NOTICE_DAYS + 1) * 86_400_000);
  const due: Due[] = [];

  // Vehículos: quienes administran la flota. Los que están fuera de servicio no se avisan.
  if (FLEET_ADMIN_ROLES.includes(user.role)) {
    const vehicles = await prisma.vehicle.findMany({
      where: {
        status: { not: "FUERA_DE_SERVICIO" },
        OR: [{ vtvExpiry: { lte: limit } }, { insuranceExpiry: { lte: limit } }],
      },
      select: { id: true, plate: true, vtvExpiry: true, insuranceExpiry: true },
    });
    for (const v of vehicles) {
      const link = `/admin/vehicles/${v.id}`;
      if (v.vtvExpiry && v.vtvExpiry <= limit) due.push({ kind: "vtv", label: v.plate, date: v.vtvExpiry, link });
      if (v.insuranceExpiry && v.insuranceExpiry <= limit) due.push({ kind: "seguro", label: v.plate, date: v.insuranceExpiry, link });
    }
  }

  // Convenios vigentes o en revisión: la conducción, todos; la Dirección de Área, los de su área.
  const allAgreements = MANAGEMENT_ROLES.includes(user.role);
  if (allAgreements || (user.role === "DIRECTOR_AREA" && user.areaId)) {
    const agreements = await prisma.agreement.findMany({
      where: {
        status: { in: ["VIGENTE", "EN_REVISION"] },
        endDate: { lte: limit },
        ...(allAgreements ? {} : { areaId: user.areaId }),
      },
      select: { id: true, number: true, title: true, endDate: true },
    });
    for (const a of agreements) {
      const name = a.title.length > 60 ? `${a.title.slice(0, 57)}…` : a.title;
      due.push({ kind: "convenio", label: a.number ? `${a.number} (${name})` : name, date: a.endDate!, link: `/admin/agreements/${a.id}` });
    }
  }
  return due;
}

/**
 * Manda a la campanita los vencimientos de VTV, seguros y convenios: un mes antes, una semana antes y al vencer.
 * Se llama cuando la campanita pide los avisos; cada etapa de cada vencimiento se avisa una sola vez
 * (y vuelve a avisarse cuando se carga una fecha nueva, por ejemplo al renovar la VTV).
 */
export async function notifyExpirations(user: ExpiryUser, now = new Date()): Promise<number> {
  const due = await dueFor(user, now);
  if (due.length === 0) return 0;
  const today = diaAR(now);

  return prisma.$transaction(async (tx) => {
    // Si la campanita pide los avisos dos veces seguidas, el segundo pedido espera y no repite.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"vencimientos:" + user.id}))`;
    let sent = 0;
    for (const d of due) {
      const notice = expiryNotice(d.kind, d.label, diaDeVencimiento(d.date), today);
      if (!notice) continue;
      // Ya se avisó esta etapa para esta fecha (los avisos de una fecha vieja no cuentan).
      const since = new Date(d.date.getTime() - (EXPIRY_NOTICE_DAYS + 1) * 86_400_000);
      const already = await tx.notification.findFirst({
        where: { userId: user.id, link: d.link, title: notice.title, createdAt: { gte: since } },
        select: { id: true },
      });
      if (already) continue;
      await tx.notification.create({ data: { userId: user.id, title: notice.title, message: notice.message, link: d.link } });
      sent += 1;
    }
    return sent;
  });
}
