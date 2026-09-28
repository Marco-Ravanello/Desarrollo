"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { OrderStatus } from "@prisma/client";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  BORRADOR: ["PENDIENTE_APROBACION", "CANCELADA"],
  PENDIENTE_APROBACION: ["APROBADA", "RECHAZADA", "BORRADOR", "CANCELADA"],
  APROBADA: ["CUMPLIDA", "CANCELADA"],
  RECHAZADA: ["BORRADOR"],
  CUMPLIDA: [],
  CANCELADA: []
};

export async function updatePurchaseOrderStatusAction(id: string, newStatus: string, reason?: string) {
  const session = await auth();
  if (!session?.user?.role) {
    return { success: false, error: "No autorizado" };
  }

  const userRole = session.user.role as any;
  const targetStatus = newStatus.trim().toUpperCase() as OrderStatus;

  try {
    const currentOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: { id: true, status: true, number: true }
    });

    if (!currentOrder) {
      return { success: false, error: "Orden de compra no encontrada" };
    }

    const currentStatus = currentOrder.status;

    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      return {
        success: false,
        error: `No es posible cambiar el estado de '${currentStatus}' a '${targetStatus}'.`
      };
    }

    if (targetStatus === "APROBADA" || targetStatus === "CANCELADA") {
      const canApprove =
        userRole === "SUPERADMIN" ||
        userRole === "ADMIN_GENERAL" ||
        hasPermission(userRole, PERMISSIONS.APPROVE_PURCHASE_ORDER);

      if (!canApprove) {
        return { success: false, error: "No tiene permisos suficientes para aprobar o cancelar órdenes de compra." };
      }
    }

    const updatedOrder = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: targetStatus }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: `PURCHASE_ORDER_STATUS_${targetStatus}`,
        entity: "PurchaseOrder",
        entityId: id,
        details: `Orden N° ${currentOrder.number}: Estado cambiado de ${currentStatus} a ${targetStatus}. Motivo: ${reason || "Actualización por operador"}`
      }
    });

    revalidatePath("/admin/purchase-orders");
    revalidatePath(`/admin/purchase-orders/${id}`);
    return { success: true, status: targetStatus };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al actualizar el estado de la orden" };
  }
}
