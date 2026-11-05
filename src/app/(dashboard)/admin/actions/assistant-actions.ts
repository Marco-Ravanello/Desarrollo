"use server";

import { auth } from "@/auth";
import { canUseAiAssistant } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { queryAIAssistant, AIResponse } from "@/services/ai-assistant";
import { confirmReservationProposal, confirmTaskProposal } from "@/services/assistant/proposals";
import { deleteConversation, getConversation, listConversations, markProposalResult } from "@/services/assistant/conversations";
import { countPendingUnanswered, deleteUnanswered, reopenUnanswered, resolveUnanswered } from "@/services/assistant/unanswered";

export async function queryAssistantAction(
  queryText: string,
  history?: { role: "user" | "assistant"; content: string }[]
): Promise<AIResponse> {
  const session = await auth();

  if (!session || !session.user) {
    throw new Error("Tu sesión expiró. Volvé a iniciar sesión.");
  }
  if (!canUseAiAssistant(session.user.role)) {
    return { intent: "error", answer: "Tu rol no tiene acceso al Asistente de IA." };
  }

  try {
    return await queryAIAssistant(queryText, history, { id: session.user.id, role: session.user.role, areaId: session.user.areaId });
  } catch (error: any) {
    console.error("Error running queryAssistantAction:", error);
    return {
      intent: "error",
      answer: `⚠️ Error del servidor al procesar la consulta: ${error.message || error}`
    };
  }
}

/**
 * "Confirmar" en la tarjeta de una tarea o un pedido de vehículo que armó el asistente. Hasta acá no se guardó
 * nada; se revisa todo de nuevo, con las mismas reglas que las pantallas de tareas y de reservas.
 */
export async function confirmAssistantProposalAction(
  proposal: unknown,
  messageId?: string | null
): Promise<{ ok: true; message: string; link: string } | { ok: false; error: string }> {
  const res = await confirmProposal(proposal);
  if (res.ok && typeof messageId === "string") {
    const session = await auth();
    if (session?.user?.id) {
      await markProposalResult(session.user.id, messageId, { step: "done", message: res.message, link: res.link }).catch((err) =>
        console.error("No se pudo anotar la confirmación en la conversación:", err)
      );
    }
  }
  return res;
}

/** "Cancelar" en la tarjeta: no se guarda nada, solo se anota en la conversación para no ofrecerla de nuevo. */
export async function cancelAssistantProposalAction(messageId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id || typeof messageId !== "string") return;
  await markProposalResult(session.user.id, messageId, { step: "cancelled" }).catch(() => undefined);
}

async function confirmProposal(proposal: unknown): Promise<{ ok: true; message: string; link: string } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  if (!canUseAiAssistant(session.user.role)) return { ok: false, error: "Tu rol no tiene acceso al Asistente de IA." };
  const kind = proposal && typeof proposal === "object" ? (proposal as { kind?: unknown }).kind : null;
  try {
    if (kind === "tarea") {
      const res = await confirmTaskProposal({ id: session.user.id }, proposal);
      if (res.ok) revalidatePath("/tasks");
      return res;
    }
    if (kind === "reserva") {
      const res = await confirmReservationProposal({ id: session.user.id, name: session.user.name, areaId: session.user.areaId }, proposal);
      if (res.ok) {
        revalidatePath("/admin/vehicles");
        revalidatePath("/admin/vehicles/requests");
      }
      return res;
    }
    return { ok: false, error: "No entendí qué había que guardar. Pedímelo de nuevo." };
  } catch (error) {
    console.error("Error confirmando lo que armó el asistente:", error);
    return { ok: false, error: "No se pudo guardar. Probá de nuevo." };
  }
}

// Conversaciones guardadas: cada persona ve y borra solo las suyas.

async function assistantUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || !canUseAiAssistant(session.user.role)) return null;
  return session.user.id;
}

export async function listAssistantConversationsAction() {
  const userId = await assistantUserId();
  if (!userId) return [];
  return listConversations(userId);
}

export async function getAssistantConversationAction(id: string) {
  const userId = await assistantUserId();
  if (!userId || typeof id !== "string") return null;
  return getConversation(userId, id);
}

export async function deleteAssistantConversationAction(id: string): Promise<{ ok: boolean }> {
  const userId = await assistantUserId();
  if (!userId || typeof id !== "string") return { ok: false };
  return { ok: await deleteConversation(userId, id) };
}

// Preguntas sin respuesta: solo el Superadmin.
async function isSuperadmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.role === "SUPERADMIN";
}

/** Cuántas preguntas distintas esperan, para el botón de la página del asistente. 0 si no es Superadmin. */
export async function countUnansweredAction(): Promise<number> {
  if (!(await isSuperadmin())) return 0;
  return countPendingUnanswered().catch(() => 0);
}

export async function changeUnansweredAction(key: string, change: "resolver" | "reabrir" | "borrar"): Promise<{ ok: boolean; error?: string }> {
  if (!(await isSuperadmin())) return { ok: false, error: "Solo el Superadmin puede cambiar esta lista." };
  if (typeof key !== "string" || !key) return { ok: false, error: "No se encontró la pregunta." };
  if (change === "resolver") await resolveUnanswered(key);
  else if (change === "reabrir") await reopenUnanswered(key);
  else if (change === "borrar") await deleteUnanswered(key);
  else return { ok: false, error: "No se entendió el cambio." };
  revalidatePath("/admin/assistant/sin-respuesta");
  return { ok: true };
}
