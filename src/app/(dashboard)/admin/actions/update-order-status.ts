"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { OrderStatus } from "@prisma/client";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

const VALID_ORDER_STATUSES: OrderStatus[] = [
  "BORRADOR",
  "PENDIENTE_APROBACION",
  "APROBADA",
  "RECHAZADA",
  "CUMPLIDA",
  "CANCELADA"
];

export async function updatePurchaseOrderStatusAction(id: string, status: string) {
  const session = await auth();
  if (!session?.user?.role) {
    return { error: "No autorizado" };
  }

  const userRole = session.user.role as any;
  const canApprove =
    userRole === "SUPERADMIN" ||
    userRole === "ADMIN_GENERAL" ||
    hasPermission(userRole, PERMISSIONS.APPROVE_PURCHASE_ORDER);

  if (!canApprove) {
    return { error: "No tiene permisos para modificar el estado de órdenes de compra." };
  }

  const targetStatus = status.trim().toUpperCase() as OrderStatus;
  if (!VALID_ORDER_STATUSES.includes(targetStatus)) {
    return { error: `Estado '${status}' no es un estado válido para una orden de compra.` };
  }

  try {
    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: targetStatus }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: 'UPDATE_ORDER_STATUS',
        entity: 'PurchaseOrder',
        entityId: id,
        details: `Estado cambiado a ${targetStatus}`
      }
    });

    revalidatePath("/admin/purchase-orders");
    return { success: true };
  } catch (error) {
    return { error: "Error al actualizar el estado de la orden de compra." };
  }
}
