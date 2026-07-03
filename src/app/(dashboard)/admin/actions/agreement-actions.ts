"use server";

import { createAgreement } from "@/services/admin";
import { createAuditLog } from "@/services/system";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function createAgreementAction(formData: FormData) {
  const session = await auth();

  const title = formData.get("title") as string;
  const number = formData.get("number") as string;
  const parties = formData.get("parties") as string;
  const amountStr = formData.get("amount") as string;
  const amount = amountStr ? parseFloat(amountStr) : 0;
  const description = formData.get("description") as string;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  const areaId = formData.get("areaId") as string;
  const status = formData.get("status") as any;

  if (!title) {
    return { success: false, error: "El título es requerido" };
  }

  try {
    const agreement = await createAgreement({
      title,
      number,
      parties,
      amount,
      description,
      startDate,
      endDate,
      areaId,
      status
    });

    if (session?.user?.id) {
      await createAuditLog(session.user.id, "CREATE", "Agreement", agreement.id, { title: agreement.title });
    }

    revalidatePath("/admin/agreements");
    return { success: true, id: agreement.id };
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { success: false, error: "Ya existe un convenio con ese número" };
    }
    return { success: false, error: "Ocurrió un error al guardar el convenio" };
  }
}
