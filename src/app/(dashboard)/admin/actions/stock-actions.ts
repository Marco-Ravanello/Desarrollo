"use server";

import { createSupply, updateSupplyStock } from "@/services/admin";
import { createAuditLog } from "@/services/system";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { actionErrorMessage } from "@/lib/action-error";

type StockActionResult = { success: true } | { success: false; error: string };

async function canManageStock() {
  const session = await auth();
  if (session?.user?.role !== 'SUPERADMIN' && session?.user?.role !== 'ADMIN_GENERAL') {
    return null;
  }
  return session;
}

export async function addSupplyAction(formData: FormData): Promise<StockActionResult> {
  const session = await canManageStock();
  if (!session) {
    return { success: false, error: "No se pudo registrar el insumo: tu rol no tiene permiso para cargar stock." };
  }

  const data = {
    name: formData.get("name") as string,
    description: formData.get("description") as string,
    stock: formData.get("stock") as string,
    minStock: formData.get("minStock") as string,
    areaId: formData.get("areaId") as string,
  };

  try {
    const supply = await createSupply(data);
    await createAuditLog(session.user.id, "CREATE", "SupplyItem", supply.id, { name: supply.name });
  } catch (error) {
    console.error("Error en addSupplyAction:", error);
    return { success: false, error: actionErrorMessage(error, "No se pudo registrar el insumo") };
  }

  revalidatePath("/admin/stock");
  return { success: true };
}

export async function adjustStockAction(id: string, newStock: number): Promise<StockActionResult> {
  const session = await canManageStock();
  if (!session) {
    return { success: false, error: "No se pudo actualizar el stock: tu rol no tiene permiso para modificarlo." };
  }

  if (!Number.isFinite(newStock) || newStock < 0) {
    return { success: false, error: "No se pudo actualizar el stock: la cantidad tiene que ser 0 o más." };
  }

  try {
    await updateSupplyStock(id, newStock);
    await createAuditLog(session.user.id, "UPDATE", "SupplyItem", id, { newStock });
  } catch (error) {
    console.error("Error en adjustStockAction:", error);
    return { success: false, error: actionErrorMessage(error, "No se pudo actualizar el stock") };
  }

  revalidatePath("/admin/stock");
  return { success: true };
}
