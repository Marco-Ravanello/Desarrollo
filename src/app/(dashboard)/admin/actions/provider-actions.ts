"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatCuit, normalizeCuit } from "@/services/providers";

const ProviderSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Ingrese la razón social"),
  cuit: z.string().trim().refine((v) => normalizeCuit(v).length === 11, "El CUIT debe tener 11 dígitos"),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  bank: z.string().trim().optional(),
  cbu: z.string().trim().refine((v) => !v || /^\d{22}$/.test(v), "El CBU debe tener 22 dígitos").optional(),
});

export type ProviderInput = z.infer<typeof ProviderSchema>;

const ROLES_THAT_EDIT = ["SUPERADMIN", "ADMIN_GENERAL", "DIRECCION_GENERAL"];

export async function saveProviderAction(input: ProviderInput) {
  const session = await auth();
  if (!session?.user || !ROLES_THAT_EDIT.includes(session.user.role as string)) {
    return { success: false, error: "No tiene permisos para modificar proveedores" };
  }

  const parsed = ProviderSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Datos inválidos" };
  }
  const data = parsed.data;
  const cuit = formatCuit(data.cuit);

  const duplicate = await prisma.provider.findMany({ select: { id: true, cuit: true } });
  if (duplicate.some((p) => p.id !== data.id && normalizeCuit(p.cuit) === normalizeCuit(cuit))) {
    return { success: false, error: "Ya existe un proveedor con ese CUIT" };
  }

  const fields = {
    name: data.name,
    cuit,
    address: data.address || null,
    phone: data.phone || null,
    email: data.email || null,
    bank: data.bank || null,
    cbu: data.cbu || null,
  };

  try {
    const provider = data.id
      ? await prisma.provider.update({ where: { id: data.id }, data: fields })
      : await prisma.provider.create({ data: fields });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: data.id ? "UPDATE_PROVIDER" : "CREATE_PROVIDER",
        entity: "Provider",
        entityId: provider.id,
        details: `${data.id ? "Actualización" : "Alta"} de proveedor ${provider.name} (CUIT ${provider.cuit})`,
      },
    });

    revalidatePath("/admin/providers");
    revalidatePath(`/admin/providers/${provider.id}`);
    return { success: true, id: provider.id };
  } catch (error) {
    console.error("Error al guardar proveedor:", error);
    return { success: false, error: "No se pudo guardar el proveedor" };
  }
}
