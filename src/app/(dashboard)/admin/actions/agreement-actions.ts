"use server";

import prisma from "@/lib/prisma";
import { createAgreement } from "@/services/admin";
import { createAuditLog } from "@/services/system";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { actionErrorMessage } from "@/lib/action-error";
import { canCreateAgreements, parseAgreementInput } from "@/lib/convenios";

type Result = { success: true; id: string } | { success: false; error: string };

export async function createAgreementAction(formData: FormData): Promise<Result> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  }
  if (!canCreateAgreements(session.user.role)) {
    return { success: false, error: "Los convenios los cargan Administración General, Dirección General y Superadmin." };
  }

  const parsed = parseAgreementInput(Object.fromEntries(formData.entries()));
  if (!parsed.ok) return { success: false, error: parsed.error };
  const data = parsed.data;
  if (data.areaId && !(await prisma.area.findUnique({ where: { id: data.areaId }, select: { id: true } }))) {
    return { success: false, error: "El área elegida ya no existe. Recargá la página." };
  }

  try {
    const agreement = await createAgreement(data);
    await createAuditLog(session.user.id, "CREATE", "Agreement", agreement.id, { title: agreement.title });
    revalidatePath("/admin/agreements");
    return { success: true, id: agreement.id };
  } catch (error: any) {
    if (error?.code === "P2002") {
      return { success: false, error: "Ya hay un convenio cargado con ese número." };
    }
    return { success: false, error: actionErrorMessage(error, "No se pudo guardar el convenio") };
  }
}
