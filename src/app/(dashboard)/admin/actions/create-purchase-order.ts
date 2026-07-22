"use server";

import { createPurchaseOrder } from "@/services/admin";
import { createAuditLog } from "@/services/system";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function createPurchaseOrderAction(formData: FormData) {
  const session = await auth();
  const number = formData.get("number") as string;
  const providerId = formData.get("providerId") as string;
  const providerName = formData.get("providerName") as string;
  const providerCuit = formData.get("providerCuit") as string;
  const providerNumber = formData.get("providerNumber") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const description = formData.get("description") as string;
  const expediente = formData.get("expediente") as string;
  const deliveryDate = formData.get("deliveryDate") as string;
  const deliveryPlace = formData.get("deliveryPlace") as string;
  const paymentTerms = formData.get("paymentTerms") as string;
  const itemsJson = formData.get("items") as string;
  const items = itemsJson ? JSON.parse(itemsJson) : [];

  if (!number || (!providerId && !providerName) || isNaN(amount)) {
    return { success: false, error: "Número, proveedor e importe son requeridos" };
  }

  try {
    const order = await createPurchaseOrder({
      number,
      providerId,
      providerName,
      providerCuit,
      providerNumber,
      amount,
      description,
      expediente,
      deliveryDate,
      deliveryPlace,
      paymentTerms,
      items
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
