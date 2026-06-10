"use server";

import { createSupply, updateSupplyStock } from "@/services/admin";
import { createAuditLog } from "@/services/system";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function addSupplyAction(formData: FormData) {
  const session = await auth();
  if (session?.user?.role !== 'SUPERADMIN' && session?.user?.role !== 'ADMIN_GENERAL') {
    throw new Error("No autorizado");
  }

  const data = {
    name: formData.get("name") as string,
    description: formData.get("description") as string,
    stock: formData.get("stock") as string,
    minStock: formData.get("minStock") as string,
    areaId: formData.get("areaId") as string,
  };

  const supply = await createSupply(data);
  await createAuditLog(session.user.id, "CREATE", "SupplyItem", supply.id, { name: supply.name });

  revalidatePath("/admin/stock");
  return { success: true };
}

export async function adjustStockAction(id: string, newStock: number) {
  const session = await auth();
  if (session?.user?.role !== 'SUPERADMIN' && session?.user?.role !== 'ADMIN_GENERAL') {
    throw new Error("No autorizado");
  }

  await updateSupplyStock(id, newStock);
  await createAuditLog(session.user.id, "UPDATE", "SupplyItem", id, { newStock });

  revalidatePath("/admin/stock");
  return { success: true };
}
