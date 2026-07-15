"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateItemFulfillmentAction(itemId: string, increment: number) {
  try {
    const item = await prisma.purchaseOrderItem.findUnique({
      where: { id: itemId },
      include: { order: true }
    });

    if (!item) throw new Error("Ítem no encontrado");

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

    const session = await (await import("@/auth")).auth();
    if (session?.user?.id) {
        await prisma.auditLog.create({
            data: {
                userId: session.user.id,
                action: 'UPDATE_FULFILLMENT',
                entity: 'PurchaseOrder',
                entityId: item.orderId,
                details: `Registrada entrega de ${increment} ${item.unitOfMeasure || 'unidades'} para "${item.description.substring(0, 30)}..."`
            }
        });
    }

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
    }

    revalidatePath(`/admin/purchase-orders/${item.orderId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Fulfillment Error:", error);
    return { success: false, error: error.message };
  }
}
