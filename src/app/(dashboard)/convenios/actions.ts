"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  activarCuidadora, agregarHoras, borrarCuidadora, borrarHoras, borrarValorHora, configurarControl, corregirHoras, guardarCuidadora,
  guardarValorHora, repetirDiaAnterior,
} from "@/services/convenio-gasto";

const SESSION_EXPIRED = { success: false as const, error: "Tu sesión expiró. Volvé a iniciar sesión." };

async function sessionUser() {
  const session = await auth();
  return session?.user?.id ? session.user : null;
}

function refresh(agreementId: string) {
  revalidatePath(`/convenios/${agreementId}`);
  revalidatePath(`/admin/agreements/${agreementId}`);
  revalidatePath("/dashboard");
}

export async function configurarControlAction(agreementId: string, data: Record<string, unknown>) {
  const user = await sessionUser();
  if (!user) return SESSION_EXPIRED;
  const res = await configurarControl(user, agreementId, data);
  if (res.success) refresh(agreementId);
  return res;
}

export async function guardarValorHoraAction(agreementId: string, data: Record<string, unknown>) {
  const user = await sessionUser();
  if (!user) return SESSION_EXPIRED;
  const res = await guardarValorHora(user, agreementId, data);
  if (res.success) refresh(agreementId);
  return res;
}

export async function borrarValorHoraAction(agreementId: string, valorId: string) {
  const user = await sessionUser();
  if (!user) return SESSION_EXPIRED;
  const res = await borrarValorHora(user, valorId);
  if (res.success) refresh(agreementId);
  return res;
}

export async function guardarCuidadoraAction(agreementId: string, id: string | null, data: Record<string, unknown>) {
  const user = await sessionUser();
  if (!user) return SESSION_EXPIRED;
  const res = await guardarCuidadora(user, agreementId, id, data);
  if (res.success) refresh(agreementId);
  return res;
}

export async function activarCuidadoraAction(agreementId: string, id: string, activa: boolean) {
  const user = await sessionUser();
  if (!user) return SESSION_EXPIRED;
  const res = await activarCuidadora(user, agreementId, id, activa);
  if (res.success) refresh(agreementId);
  return res;
}

export async function borrarCuidadoraAction(agreementId: string, id: string) {
  const user = await sessionUser();
  if (!user) return SESSION_EXPIRED;
  const res = await borrarCuidadora(user, agreementId, id);
  if (res.success) refresh(agreementId);
  return res;
}

export async function guardarHorasAction(agreementId: string, filaId: string | null, data: Record<string, unknown>) {
  const user = await sessionUser();
  if (!user) return SESSION_EXPIRED;
  const res = filaId ? await corregirHoras(user, filaId, data) : await agregarHoras(user, agreementId, data);
  if (res.success) refresh(agreementId);
  return res;
}

export async function borrarHorasAction(agreementId: string, filaId: string) {
  const user = await sessionUser();
  if (!user) return SESSION_EXPIRED;
  const res = await borrarHoras(user, filaId);
  if (res.success) refresh(agreementId);
  return res;
}

export async function repetirDiaAnteriorAction(agreementId: string, dia: string) {
  const user = await sessionUser();
  if (!user) return SESSION_EXPIRED;
  const res = await repetirDiaAnterior(user, agreementId, dia);
  if (res.success) refresh(agreementId);
  return res;
}
