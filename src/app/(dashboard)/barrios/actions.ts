"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { barrioSlug } from "@/lib/barrios";
import { createLugar, deleteLugar, updateLugar } from "@/services/barrios";

type Result = { success: true } | { success: false; error: string };

const SESSION_EXPIRED: Result = { success: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };

function refresh(barrio: string) {
  revalidatePath("/barrios");
  revalidatePath(`/barrios/${barrioSlug(barrio)}`);
}

export async function saveLugarAction(barrio: string, id: string | null, data: Record<string, unknown>): Promise<Result> {
  const session = await auth();
  if (!session?.user?.id) return SESSION_EXPIRED;
  const res = id ? await updateLugar(session.user, id, data) : await createLugar(session.user, barrio, data);
  if (res.success) refresh(barrio);
  return res;
}

export async function deleteLugarAction(barrio: string, id: string): Promise<Result> {
  const session = await auth();
  if (!session?.user?.id) return SESSION_EXPIRED;
  const res = await deleteLugar(session.user, id);
  if (res.success) refresh(barrio);
  return res;
}
