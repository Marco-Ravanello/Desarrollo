"use server";

import { createPurchaseOrder } from "@/services/admin";
import { createAuditLog } from "@/services/system";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function createPurchaseOrderAction(formData: FormData) {
  const session = await auth();
  const number = formData.get("number") as string;
  const providerId = formData.get("providerId") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const description = formData.get("description") as string;

  if (!number || !providerId || isNaN(amount)) {
    return { success: false, error: "Número, proveedor e importe son requeridos" };
  }

  try {
    const order = await createPurchaseOrder({
      number,
      providerId,
      amount,
      description,
    });

    if (session?.user?.id) {
      await createAuditLog(session.user.id, "CREATE", "PurchaseOrder", order.id, { number: order.number });
    }

    revalidatePath("/admin/purchase-orders");
    return { success: true, id: order.id };
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { success: false, error: "Ya existe una orden con ese número" };
    }
    return { success: false, error: "Ocurrió un error al guardar la orden" };
  }
}
