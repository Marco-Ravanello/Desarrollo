"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

const DEACTIVATED_KEY = "muni-deactivated-users";

export async function getDeactivatedUserIds(): Promise<string[]> {
  try {
    const record = await prisma.systemSetting.findUnique({
      where: { key: DEACTIVATED_KEY }
    });
    if (record?.value) {
      return JSON.parse(record.value) as string[];
    }
    return [];
  } catch (error) {
    console.error("Error al obtener usuarios desactivados:", error);
    return [];
  }
}

export async function createUserAction(formData: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'SUPERADMIN') {
    return { error: "Solo los administradores generales pueden crear usuarios" };
  }

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const role = formData.get("role") as Role;
  const areaId = formData.get("areaId") as string;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        areaId: areaId || null,
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: 'CREATE_USER',
        entity: 'User',
        entityId: user.id,
        details: `Nuevo usuario creado: ${email} con rol ${role}`
      }
    });

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error(error);
    if ((error as any).code === 'P2002') return { error: "Ya existe un usuario con ese email" };
    return { error: "Error al crear el usuario" };
  }
}

export interface UpdateUserInput {
  id: string;
  name: string;
  email: string;
  role: Role;
  areaId?: string | null;
  password?: string;
  isActive?: boolean;
}

export async function updateUserAction(input: UpdateUserInput) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'SUPERADMIN') {
    return { success: false, error: "No tiene permisos para modificar usuarios" };
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { id: input.id }
    });

    if (!existing) {
      return { success: false, error: "Usuario no encontrado" };
    }

    if (input.email !== existing.email) {
      const duplicate = await prisma.user.findUnique({
        where: { email: input.email }
      });
      if (duplicate && duplicate.id !== input.id) {
        return { success: false, error: "El correo electrónico ya está registrado por otro agente" };
      }
    }

    const dataToUpdate: any = {
      name: input.name,
      email: input.email,
      role: input.role,
      areaId: input.areaId || null,
    };

    if (input.password && input.password.trim().length >= 6) {
      dataToUpdate.password = await bcrypt.hash(input.password.trim(), 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: input.id },
      data: dataToUpdate
    });

    if (typeof input.isActive === "boolean") {
      let deactivated = await getDeactivatedUserIds();

      if (!input.isActive) {
        if (!deactivated.includes(input.id)) {
          deactivated.push(input.id);
        }
      } else {
        deactivated = deactivated.filter((id) => id !== input.id);
      }

      await prisma.systemSetting.upsert({
        where: { key: DEACTIVATED_KEY },
        update: { value: JSON.stringify(deactivated) },
        create: { key: DEACTIVATED_KEY, value: JSON.stringify(deactivated) }
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: 'UPDATE_USER',
        entity: 'User',
        entityId: updatedUser.id,
        details: `Actualización de perfil/rol/área para usuario: ${updatedUser.email}`
      }
    });

    revalidatePath("/admin/users");
    return { success: true, user: updatedUser };
  } catch (error: any) {
    console.error("Error al actualizar usuario:", error);
    return { success: false, error: error.message || "Error al actualizar el usuario" };
  }
}

export async function toggleUserStatusAction(userId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'SUPERADMIN') {
    return { success: false, error: "No autorizado" };
  }

  if (session.user.id === userId) {
    return { success: false, error: "No puede desactivar su propia cuenta activa de administrador" };
  }

  try {
    let deactivated = await getDeactivatedUserIds();
    const isCurrentlyDeactivated = deactivated.includes(userId);

    if (isCurrentlyDeactivated) {
      deactivated = deactivated.filter((id) => id !== userId);
    } else {
      deactivated.push(userId);
    }

    await prisma.systemSetting.upsert({
      where: { key: DEACTIVATED_KEY },
      update: { value: JSON.stringify(deactivated) },
      create: { key: DEACTIVATED_KEY, value: JSON.stringify(deactivated) }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: isCurrentlyDeactivated ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
        entity: 'User',
        entityId: userId,
        details: `Cambio de estado de cuenta (${isCurrentlyDeactivated ? 'Activado' : 'Suspendido/Inactivo'})`
      }
    });

    revalidatePath("/admin/users");
    return { success: true, isDeactivated: !isCurrentlyDeactivated };
  } catch (error: any) {
    return { success: false, error: error.message || "Error al alternar estado del usuario" };
  }
}
