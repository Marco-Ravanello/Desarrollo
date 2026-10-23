"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { OrderStatus } from "@prisma/client";
import { actionErrorMessage } from "@/lib/action-error";
import { canChangeOrderStatus, orderStatusLabel, ORDER_STATUS_LABEL } from "@/lib/purchase-orders";

export async function updatePurchaseOrderStatusAction(id: string, newStatus: string, reason?: string) {
  const session = await auth();
  if (!session?.user?.role) {
    return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  }

  const userRole = session.user.role;
  const targetStatus = newStatus.trim().toUpperCase() as OrderStatus;
  if (!(targetStatus in ORDER_STATUS_LABEL)) {
    return { success: false, error: "Ese estado no existe." };
  }

  try {
    const currentOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: { id: true, status: true, number: true }
    });

    if (!currentOrder) {
      return { success: false, error: "No encontramos la orden de compra." };
    }

    const currentStatus = currentOrder.status;
    if (currentStatus === targetStatus) {
      return { success: true, status: targetStatus };
    }
    if (!canChangeOrderStatus(userRole, currentStatus, targetStatus)) {
      return {
        success: false,
        error: `Tu rol no puede pasar la orden de "${orderStatusLabel(currentStatus)}" a "${orderStatusLabel(targetStatus)}".`
      };
    }

    // Solo si nadie la cambió mientras tanto.
    const { count } = await prisma.purchaseOrder.updateMany({
      where: { id, status: currentStatus },
      data: { status: targetStatus }
    });
    if (count === 0) {
      return { success: false, error: "Otra persona cambió esta orden recién. Recargá la página para ver cómo quedó." };
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: `PURCHASE_ORDER_STATUS_${targetStatus}`,
        entity: "PurchaseOrder",
        entityId: id,
        details: `Orden N° ${currentOrder.number}: pasó de "${orderStatusLabel(currentStatus)}" a "${orderStatusLabel(targetStatus)}".${reason ? ` Motivo: ${reason}` : ""}`
      }
    });

    revalidatePath("/admin/purchase-orders");
    revalidatePath(`/admin/purchase-orders/${id}`);
    return { success: true, status: targetStatus };
  } catch (error: any) {
    return { success: false, error: actionErrorMessage(error, "No se pudo actualizar el estado de la orden") };
  }
}
