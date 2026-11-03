"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { agregarFiltro, parseFiltros, quitarFiltro, type FiltroGuardado } from "@/lib/filtros-guardados";

type Result = { success: true; filtros: FiltroGuardado[] } | { success: false; error: string };
const SIN_SESION = "Tu sesión expiró. Volvé a iniciar sesión.";

async function guardar(userId: string, filtros: FiltroGuardado[]) {
  await prisma.user.update({ where: { id: userId }, data: { caseFilters: filtros as unknown as Prisma.InputJsonValue } });
  revalidatePath("/cases");
}

/** Guarda los filtros puestos en la lista de Expedientes con un nombre (solo para quien los guarda). */
export async function guardarFiltroAction(nombre: string, consulta: string): Promise<Result> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: SIN_SESION };
  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { caseFilters: true } });
    const res = agregarFiltro(parseFiltros(user?.caseFilters), nombre, consulta);
    if (!res.ok) return { success: false, error: res.error };
    await guardar(session.user.id, res.filtros);
    return { success: true, filtros: res.filtros };
  } catch {
    return { success: false, error: "No se pudo guardar el filtro. Probá de nuevo." };
  }
}

export async function borrarFiltroAction(nombre: string): Promise<Result> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: SIN_SESION };
  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { caseFilters: true } });
    const filtros = quitarFiltro(parseFiltros(user?.caseFilters), nombre);
    await guardar(session.user.id, filtros);
    return { success: true, filtros };
  } catch {
    return { success: false, error: "No se pudo borrar el filtro. Probá de nuevo." };
  }
}
