import type { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

// Datos inventados SOLO para la base de prueba local que se vacía en cada corrida.

let counter = 0;

export async function createArea(name: string) {
  return prisma.area.create({ data: { name } });
}

export async function createUser(role: Role, areaId?: string) {
  counter += 1;
  return prisma.user.create({
    data: { email: `${role.toLowerCase()}-${counter}@prueba.test`, name: `Prueba ${role}`, role, areaId: areaId ?? null },
  });
}

/** Simula que este usuario inició sesión. */
export function loginAs(user: { id: string; name: string | null; email: string | null; role: Role; areaId: string | null } | null) {
  (globalThis as any).__testSession = user ? { user: { ...user } } : null;
}

export async function stockOf(id: string) {
  return (await prisma.supplyItem.findUniqueOrThrow({ where: { id } })).stock;
}
