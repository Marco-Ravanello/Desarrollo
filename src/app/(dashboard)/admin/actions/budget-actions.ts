"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function getBudgetSummary() {
  const areas = await prisma.area.findMany({
    include: {
      purchaseOrders: {
        where: { status: { in: ['APROBADA', 'CUMPLIDA'] } },
        select: { amount: true }
      }
    }
  });

  return areas.map(area => {
    const budget = Number(area.annualBudget);
    const spent = area.purchaseOrders.reduce((sum, po) => sum + Number(po.amount), 0);
    const percentage = budget > 0 ? (spent / budget) * 100 : 0;

    return {
      id: area.id,
      name: area.name,
      budget,
      spent,
      percentage
    };
  });
}

export async function updateAreaBudget(areaId: string, amount: number) {
  const session = await auth();

  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN_GENERAL')) {
    return { success: false, error: "No autorizado" };
  }

  if (typeof amount !== "number" || isNaN(amount) || amount < 0) {
    return { success: false, error: "Monto de presupuesto inválido" };
  }

  try {
    const updatedArea = await prisma.area.update({
      where: { id: areaId },
      data: { annualBudget: amount }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: 'UPDATE_BUDGET',
        entity: 'Area',
        entityId: areaId,
        details: `Presupuesto de secretaría ${updatedArea.name} actualizado a $${amount.toLocaleString('es-AR')}`
      }
    });

    revalidatePath("/admin/budget");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al actualizar presupuesto" };
  }
}
