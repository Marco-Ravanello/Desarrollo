"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function createVehicleAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN_GENERAL')) {
    return { error: "No autorizado" };
  }

  const plate = formData.get("plate") as string;
  const brand = formData.get("brand") as string;
  const model = formData.get("model") as string;

  try {
    const vehicle = await prisma.vehicle.create({
      data: {
        plate: plate.toUpperCase(),
        brand,
        model
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: 'CREATE_VEHICLE',
        entity: 'Vehicle',
        entityId: vehicle.id,
        details: `Nuevo vehículo: ${brand} ${model} (${plate})`
      }
    });

    revalidatePath("/admin/vehicles");
    return { success: true };
  } catch (error) {
    console.error(error);
    if ((error as any).code === 'P2002') return { error: "Ya existe un vehículo con esa patente" };
    return { error: "Error al registrar el vehículo" };
  }
}
