"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  abrirClase, borrarClase, createCurso, deleteCurso, guardarAsistencia, inscribir, marcarDejo, reabrirCurso, terminarCurso,
  updateCurso, volverAInscribir,
} from "@/services/cursos";

const SESSION_EXPIRED = { success: false as const, error: "Tu sesión expiró. Volvé a iniciar sesión." };

async function sessionUser() {
  const session = await auth();
  return session?.user?.id ? session.user : null;
}

function refresh(cursoId?: string) {
  revalidatePath("/cursos");
  if (cursoId) revalidatePath(`/cursos/${cursoId}`);
}

export async function saveCursoAction(id: string | null, data: Record<string, unknown>) {
  const user = await sessionUser();
  if (!user) return SESSION_EXPIRED;
  const res = id ? await updateCurso(user, id, data) : await createCurso(user, data);
  if (res.success) refresh(id ?? ("id" in res ? String(res.id) : undefined));
  return res;
}

export async function terminarCursoAction(id: string, terminar: boolean) {
  const user = await sessionUser();
  if (!user) return SESSION_EXPIRED;
  const res = terminar ? await terminarCurso(user, id) : await reabrirCurso(user, id);
  if (res.success) refresh(id);
  return res;
}

export async function deleteCursoAction(id: string) {
  const user = await sessionUser();
  if (!user) return SESSION_EXPIRED;
  const res = await deleteCurso(user, id);
  if (res.success) refresh();
  return res;
}

export async function inscribirAction(cursoId: string, dni: string, dia?: string) {
  const user = await sessionUser();
  if (!user) return SESSION_EXPIRED;
  const res = await inscribir(user, cursoId, dni, dia);
  if (res.success) refresh(cursoId);
  return res;
}

export async function marcarDejoAction(cursoId: string, inscriptoId: string, motivo: string, bajaDelPrograma: boolean) {
  const user = await sessionUser();
  if (!user) return SESSION_EXPIRED;
  const res = await marcarDejo(user, inscriptoId, motivo, bajaDelPrograma);
  if (res.success) refresh(cursoId);
  return res;
}

export async function volverAInscribirAction(cursoId: string, inscriptoId: string) {
  const user = await sessionUser();
  if (!user) return SESSION_EXPIRED;
  const res = await volverAInscribir(user, inscriptoId);
  if (res.success) refresh(cursoId);
  return res;
}

export async function abrirClaseAction(cursoId: string, dia: string) {
  const user = await sessionUser();
  if (!user) return SESSION_EXPIRED;
  const res = await abrirClase(user, cursoId, dia);
  if (res.success) refresh(cursoId);
  return res;
}

export async function guardarAsistenciaAction(cursoId: string, claseId: string, marcas: Record<string, string>, tema: string) {
  const user = await sessionUser();
  if (!user) return SESSION_EXPIRED;
  const res = await guardarAsistencia(user, claseId, marcas, tema);
  if (res.success) {
    refresh(cursoId);
    revalidatePath(`/cursos/${cursoId}/clases/${claseId}`);
  }
  return res;
}

export async function borrarClaseAction(cursoId: string, claseId: string) {
  const user = await sessionUser();
  if (!user) return SESSION_EXPIRED;
  const res = await borrarClase(user, claseId);
  if (res.success) refresh(cursoId);
  return res;
}
