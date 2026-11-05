"use server";

import { auth } from "@/auth";
import { canUseAiAssistant } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { queryAIAssistant, AIResponse } from "@/services/ai-assistant";
import { confirmReservationProposal, confirmTaskProposal } from "@/services/assistant/proposals";

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
export async function confirmAssistantProposalAction(proposal: unknown): Promise<{ ok: true; message: string; link: string } | { ok: false; error: string }> {
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
