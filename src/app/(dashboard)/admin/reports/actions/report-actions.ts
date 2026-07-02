"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";

export async function getWeeklyExecutiveData() {
  const session = await auth();
  if (!session?.user) throw new Error("No autorizado");

  const now = new Date();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(now.getDate() - 7);

  const [newCases, newInterventions, poStats, criticalCases] = await Promise.all([
    // Nuevos casos de la semana
    prisma.case.count({ where: { createdAt: { gte: oneWeekAgo } } }),

    // Intervenciones de la semana
    prisma.intervention.count({ where: { createdAt: { gte: oneWeekAgo } } }),

    // Órdenes de compra aprobadas vs pendientes
    prisma.purchaseOrder.findMany({
      where: { createdAt: { gte: oneWeekAgo } },
      select: { amount: true, status: true }
    }),

    // Casos Críticos actuales
    prisma.case.count({ where: { priority: 'URGENTE', status: { not: 'CERRADO' } } })
  ]);

  const totalSpent = poStats
    .filter(p => p.status === 'APROBADA' || p.status === 'CUMPLIDA')
    .reduce((acc, p) => acc + Number(p.amount), 0);

  const pendingAmount = poStats
    .filter(p => p.status === 'PENDIENTE_APROBACION' || p.status === 'BORRADOR')
    .reduce((acc, p) => acc + Number(p.amount), 0);

  return {
    period: `${oneWeekAgo.toLocaleDateString()} - ${now.toLocaleDateString()}`,
    newCases,
    newInterventions,
    totalSpent,
    pendingAmount,
    criticalCases,
    timestamp: new Date().toLocaleString()
  };
}
