"use server";
import { createHRRecord } from "@/services/hr";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
export async function createHRRecordAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN_GENERAL')) { return { error: "No autorizado" }; }
  const data = {
    firstName: formData.get("firstName") as string,
    lastName: formData.get("lastName") as string,
    dni: formData.get("dni") as string,
    fileNumber: formData.get("fileNumber") as string,
    startDate: formData.get("startDate") as string,
    position: formData.get("position") as string,
    status: formData.get("status") as string,
    areaId: formData.get("areaId") as string || undefined
  };
  try { await createHRRecord(data); revalidatePath("/admin/hr"); return { success: true }; }
  catch (error) { console.error(error); return { error: "Error al crear el legajo" }; }
}
