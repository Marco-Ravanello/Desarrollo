"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { actionErrorMessage } from "@/lib/action-error";
import { auth } from "@/auth";
import { PURCHASING_EDIT_ROLES } from "@/lib/permissions";

export async function updateItemFulfillmentAction(itemId: string, increment: number) {
  const session = await auth();
  if (session?.user && !PURCHASING_EDIT_ROLES.includes(session.user.role)) {
    return { success: false, error: "No se pudo registrar la entrega: tu rol no puede modificar órdenes de compra." };
  }
  if (!session?.user?.id) {
    return { success: false, error: "No tenés permiso para hacer esto o tu sesión expiró. Si sigue pasando, volvé a iniciar sesión." };
  }

  try {
    const item = await prisma.purchaseOrderItem.findUnique({
      where: { id: itemId },
      include: { order: true }
    });

    if (!item) return { success: false, error: "No encontramos ese renglón de la orden." };
    if (item.order.status !== "APROBADA") {
      return { success: false, error: "Solo se registran entregas de órdenes aprobadas." };
    }
    if (!Number.isFinite(increment) || increment <= 0) {
      return { success: false, error: "La cantidad entregada tiene que ser mayor que cero." };
    }

    const newFulfilled = Number(item.fulfilledQuantity) + increment;

    if (newFulfilled > Number(item.quantity)) {
      throw new Error("La cantidad entregada supera la cantidad total");
    }

    await prisma.purchaseOrderItem.update({
      where: { id: itemId },
      data: {
        fulfilledQuantity: newFulfilled
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_FULFILLMENT',
        entity: 'PurchaseOrder',
        entityId: item.orderId,
        details: `Entrega de ${increment.toLocaleString("es-AR")} ${item.unitOfMeasure || (increment === 1 ? "unidad" : "unidades")} de "${item.description.length > 40 ? `${item.description.slice(0, 40)}…` : item.description}"`
      }
    });

    // Check if all items are fulfilled to update order status
    const allItems = await prisma.purchaseOrderItem.findMany({
      where: { orderId: item.orderId }
    });

    const isFullyFulfilled = allItems.every(i =>
        (i.id === itemId ? newFulfilled : Number(i.fulfilledQuantity)) >= Number(i.quantity)
    );

    if (isFullyFulfilled && item.order.status === "APROBADA") {
        await prisma.purchaseOrder.update({
            where: { id: item.orderId },
            data: { status: "CUMPLIDA" }
        });
        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: "PURCHASE_ORDER_STATUS_CUMPLIDA",
            entity: "PurchaseOrder",
            entityId: item.orderId,
            details: `Orden N° ${item.order.number}: se entregó todo y pasó a "Cumplida".`
          }
        });
    }

    revalidatePath(`/admin/purchase-orders/${item.orderId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Fulfillment Error:", error);
    return { success: false, error: actionErrorMessage(error, "No se pudo registrar la entrega") };
  }
}
