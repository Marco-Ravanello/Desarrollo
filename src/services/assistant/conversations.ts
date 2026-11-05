import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  MAX_CONVERSATIONS_LISTED,
  MAX_MESSAGES_PER_CONVERSATION,
  clampMessageText,
  conversationCutoff,
  conversationTitle,
  storedAnswerData,
} from "@/lib/assistant-conversations";

// Conversaciones guardadas del asistente. Cada consulta filtra por la persona: nadie ve las de otro, ni la
// conducción. Las de hace más de 10 días se borran cuando alguien usa el asistente (no hace falta una tarea
// programada) y, mientras tanto, no se muestran.

export type ConversationListItem = { id: string; title: string; updatedAt: Date };
export type StoredMessage = { id: string; sender: "user" | "assistant"; text: string; data: Record<string, unknown> | null };

/** Borra las conversaciones de todos que pasaron los 10 días sin preguntas nuevas. */
export async function deleteExpiredConversations(now = new Date()): Promise<number> {
  const res = await prisma.assistantConversation.deleteMany({ where: { updatedAt: { lt: conversationCutoff(now) } } });
  return res.count;
}

export async function listConversations(userId: string, now = new Date()): Promise<ConversationListItem[]> {
  await deleteExpiredConversations(now);
  return prisma.assistantConversation.findMany({
    where: { userId, updatedAt: { gte: conversationCutoff(now) } },
    select: { id: true, title: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: MAX_CONVERSATIONS_LISTED,
  });
}

/** Una conversación de la persona, con sus mensajes; null si no es suya o ya se borró. */
export async function getConversation(userId: string, id: string, now = new Date()) {
  const conv = await prisma.assistantConversation.findFirst({
    where: { id, userId, updatedAt: { gte: conversationCutoff(now) } },
    select: { id: true, title: true, updatedAt: true, messages: { select: { id: true, sender: true, text: true, data: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!conv) return null;
  return {
    id: conv.id,
    title: conv.title,
    updatedAt: conv.updatedAt,
    messages: conv.messages.map((m) => ({
      id: m.id,
      sender: m.sender === "user" ? "user" : "assistant",
      text: m.text,
      data: (m.data as Record<string, unknown> | null) ?? null,
    })) as StoredMessage[],
  };
}

/**
 * Guarda una pregunta y su respuesta. Sin `conversationId` (o si no es de la persona) arranca una nueva.
 * Devuelve la conversación y el id de la respuesta guardada.
 */
export async function saveExchange(
  userId: string,
  input: { conversationId?: string | null; question: string; answer: string; data?: unknown },
  now = new Date()
): Promise<{ conversationId: string; messageId: string }> {
  let conversationId: string | null = null;
  if (input.conversationId) {
    const existing = await prisma.assistantConversation.findFirst({
      where: { id: input.conversationId, userId, updatedAt: { gte: conversationCutoff(now) } },
      select: { id: true, _count: { select: { messages: true } } },
    });
    if (existing && existing._count.messages < MAX_MESSAGES_PER_CONVERSATION) conversationId = existing.id;
  }
  if (!conversationId) {
    const created = await prisma.assistantConversation.create({ data: { userId, title: conversationTitle(input.question) }, select: { id: true } });
    conversationId = created.id;
  }
  const data = storedAnswerData(input.data);
  const [, answer] = await prisma.$transaction([
    prisma.assistantMessage.create({ data: { conversationId, sender: "user", text: clampMessageText(input.question), createdAt: now } }),
    prisma.assistantMessage.create({
      data: {
        conversationId,
        sender: "assistant",
        text: clampMessageText(input.answer),
        data: (data ?? undefined) as Prisma.InputJsonValue | undefined,
        createdAt: new Date(now.getTime() + 1),
      },
      select: { id: true },
    }),
    prisma.assistantConversation.update({ where: { id: conversationId }, data: { updatedAt: now } }),
  ]);
  await deleteExpiredConversations(now);
  return { conversationId, messageId: answer.id };
}

/** Anota en la respuesta guardada que la tarjeta se confirmó o se canceló, así al volver no se ofrece de nuevo. */
export async function markProposalResult(
  userId: string,
  messageId: string,
  result: { step: "done"; message: string; link: string } | { step: "cancelled" }
): Promise<boolean> {
  const msg = await prisma.assistantMessage.findFirst({
    where: { id: messageId, sender: "assistant", conversation: { userId } },
    select: { id: true, data: true },
  });
  if (!msg) return false;
  const data = storedAnswerData({ ...((msg.data as Record<string, unknown> | null) ?? {}), proposalResult: result });
  await prisma.assistantMessage.update({ where: { id: msg.id }, data: { data: (data ?? undefined) as Prisma.InputJsonValue | undefined } });
  return true;
}

export async function deleteConversation(userId: string, id: string): Promise<boolean> {
  const res = await prisma.assistantConversation.deleteMany({ where: { id, userId } });
  return res.count > 0;
}
