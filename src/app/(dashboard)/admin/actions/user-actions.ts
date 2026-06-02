"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

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
