"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getBudgetSummary() {
  const areas = await prisma.area.findMany({
    include: {
      purchaseOrders: {
        where: { status: 'APROBADA' },
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
  await prisma.area.update({
    where: { id: areaId },
    data: { annualBudget: amount }
  });
  revalidatePath("/admin/budget");
}
