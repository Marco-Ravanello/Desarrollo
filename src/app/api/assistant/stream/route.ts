import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canUseAiAssistant } from "@/lib/permissions";
import { queryAIAssistantStream } from "@/services/ai-assistant";
import { saveExchange } from "@/services/assistant/conversations";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Tu sesión expiró. Volvé a iniciar sesión." }, { status: 401 });
  }
  if (!canUseAiAssistant(session.user.role)) {
    return NextResponse.json({ error: "Tu rol no tiene acceso al Asistente de IA." }, { status: 403 });
  }

  try {
    const { query, history, conversationId } = await req.json();
    if (!query || typeof query !== "string" || query.trim() === "") {
      return NextResponse.json({ error: "La consulta no puede estar vacía." }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Si la persona frena la respuesta, el navegador corta la conexión: se deja de mandar sin romper nada.
        const send = (event: string | null, payload: unknown) => {
          if (req.signal.aborted) return;
          try {
            controller.enqueue(encoder.encode(`${event ? `event: ${event}\n` : ""}data: ${JSON.stringify(payload)}\n\n`));
          } catch {
            // La conexión ya se cerró.
          }
        };
        try {
          const result = await queryAIAssistantStream(query, history, session.user.id, (chunk: string) => send(null, { chunk }), {
            role: session.user.role,
            areaId: session.user.areaId,
            onStatus: (status) => send(null, { status }),
          });
          // Se guarda la pregunta con su respuesta, salvo que la persona la haya frenado.
          let saved: { conversationId: string; messageId: string } | null = null;
          if (!req.signal.aborted && result.answer) {
            saved = await saveExchange(session.user.id!, {
              conversationId: typeof conversationId === "string" ? conversationId : null,
              question: query,
              answer: result.answer,
              data: result.dataSummary,
            }).catch((err) => {
              console.error("No se pudo guardar la conversación del asistente:", err);
              return null;
            });
          }
          send("metadata", { done: true, intent: result.intent, dataSummary: result.dataSummary, ...(saved ?? {}) });
        } catch (err: any) {
          console.error("Streaming error in /api/assistant/stream:", err);
          send("error", { error: "No se pudo responder la consulta. Probá de nuevo." });
        } finally {
          try {
            controller.close();
          } catch {
            // Ya estaba cerrada.
          }
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Error in assistant stream route:", error);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
