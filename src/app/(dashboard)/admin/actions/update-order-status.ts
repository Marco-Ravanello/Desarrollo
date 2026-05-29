"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { OrderStatus } from "@prisma/client";

export async function updatePurchaseOrderStatusAction(id: string, status: string) {
  const session = await auth();
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN_GENERAL')) {
    return { error: "No autorizado" };
  }

  try {
    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: status as OrderStatus }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: 'UPDATE_STATUS',
        entity: 'PurchaseOrder',
        entityId: id,
        details: `Estado cambiado a ${status}`
      }
    });

    revalidatePath("/admin/purchase-orders");
    return { success: true };
  } catch (error) {
    return { error: "Error al actualizar estado" };
  }
}
