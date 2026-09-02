"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function createShelterAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "No autorizado" };

  const name = formData.get("name") as string;
  const address = formData.get("address") as string;
  const coordinator = (formData.get("coordinator") as string) || "Guardia Municipal";
  const capacity = Number(formData.get("capacity")) || 50;

  if (!name || !address) {
    return { success: false, error: "Complete el nombre y dirección del centro" };
  }

  try {
    const shelter = await prisma.shelter.create({
      data: {
        name,
        address,
        coordinator,
        capacity,
        occupied: 0,
        rationsDelivered: 0,
        status: "HABILITADO"
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_SHELTER",
        entity: "Shelter",
        entityId: shelter.id,
        details: `Alta de Centro de Evacuados: ${shelter.name} (${capacity} plazas)`
      }
    });

    revalidatePath("/admin/emergency");
    revalidatePath("/admin/war-room");
    return { success: true, shelter };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al registrar centro de evacuados" };
  }
}

export async function updateShelterOccupancyAction(id: string, data: { occupied?: number; rationsDelivered?: number }) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "No autorizado" };

  try {
    const shelter = await prisma.shelter.update({
      where: { id },
      data
    });

    revalidatePath("/admin/emergency");
    revalidatePath("/admin/war-room");
    return { success: true, shelter };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al actualizar ocupación" };
  }
}

export async function createEmergencyIncidentAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "No autorizado" };

  const neighborhood = formData.get("neighborhood") as string;
  const address = formData.get("address") as string;
  const type = (formData.get("type") as string) || "Alerta de Emergencia Climática";
  const priority = (formData.get("priority") as string) || "URGENTE";

  if (!neighborhood || !address) {
    return { success: false, error: "Barrio y dirección son obligatorios" };
  }

  try {
    // Buscar o crear persona genérica para reportes COE
    let reportPerson = await prisma.person.findFirst({
      where: { dni: "00000000" }
    });

    if (!reportPerson) {
      reportPerson = await prisma.person.create({
        data: {
          firstName: "Alerta COE",
          lastName: "Territorial",
          dni: "00000000",
          address: "Centro de Operaciones de Emergencia"
        }
      });
    }

    // Buscar área de Hábitat o Protección Social
    const area = await prisma.area.findFirst({
      where: {
        OR: [
          { name: { contains: "Hábitat", mode: "insensitive" } },
          { name: { contains: "Protección", mode: "insensitive" } },
          { name: { contains: "Desarrollo", mode: "insensitive" } }
        ]
      }
    }) || await prisma.area.findFirst();

    if (!area) {
      return { success: false, error: "No hay áreas municipales configuradas en el sistema" };
    }

    const newCase = await prisma.case.create({
      data: {
        title: `[COE ${priority}] ${type} - ${neighborhood}`,
        description: `Incidente registrado en COE: ${type} en ${address}, ${neighborhood}.`,
        status: "ABIERTO",
        priority: priority as any,
        personId: reportPerson.id,
        areaId: area.id,
        assignedToId: session.user.id
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "EMERGENCY_INCIDENT_REPORTED",
        entity: "Case",
        entityId: newCase.id,
        details: `Incidente de crisis en ${neighborhood}: ${type}`
      }
    });

    revalidatePath("/admin/emergency");
    revalidatePath("/admin/war-room");
    revalidatePath("/dashboard");
    return { success: true, case: newCase };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al registrar alerta de emergencia" };
  }
}

export async function dispatchEmergencyStockAction(supplyId: string, quantity: number = 10) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "No autorizado" };

  try {
    const item = await prisma.supplyItem.findUnique({ where: { id: supplyId } });
    if (!item) return { success: false, error: "Artículo no encontrado" };

    if (item.stock < quantity) {
      return { success: false, error: `Stock insuficiente (${item.stock} disponibles)` };
    }

    const updatedItem = await prisma.supplyItem.update({
      where: { id: supplyId },
      data: { stock: Math.max(0, item.stock - quantity) }
    });

    await prisma.supplyRequest.create({
      data: {
        supplyId,
        areaId: item.areaId || (await prisma.area.findFirst())?.id || "",
        quantity,
        reason: "Despacho de contingencia por Emergencia Climática (COE)",
        status: "ENTREGADO"
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "EMERGENCY_STOCK_DISPATCH",
        entity: "SupplyItem",
        entityId: supplyId,
        details: `Despacho COE: ${quantity} unidades de ${item.name}`
      }
    });

    revalidatePath("/admin/emergency");
    revalidatePath("/admin/stock");
    revalidatePath("/admin/war-room");
    return { success: true, newStock: updatedItem.stock };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al despachar insumo" };
  }
}
