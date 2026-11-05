import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { deleteConversation, getConversation, listConversations, markProposalResult, saveExchange } from "@/services/assistant/conversations";
import { createUser } from "./helpers";

// Conversaciones inventadas, solo en la base de prueba local que se vacía en cada archivo.

describe("conversaciones guardadas del asistente", () => {
  it("cada persona ve solo las suyas, y se pueden seguir y borrar", async () => {
    const ana = await createUser("DIRECCION_GENERAL");
    const beto = await createUser("SUPERADMIN");
    const first = await saveExchange(ana.id, { question: "¿Cuántos expedientes hay?", answer: "Hay 3.", data: { stats: [{ label: "Abiertos", value: "3" }], people: [{ dni: "1" }] } });
    const second = await saveExchange(ana.id, { conversationId: first.conversationId, question: "¿Y urgentes?", answer: "1." });
    expect(second.conversationId).toBe(first.conversationId);

    const conv = await getConversation(ana.id, first.conversationId);
    expect(conv?.title).toBe("¿Cuántos expedientes hay?");
    expect(conv?.messages.map((m) => [m.sender, m.text])).toEqual([
      ["user", "¿Cuántos expedientes hay?"],
      ["assistant", "Hay 3."],
      ["user", "¿Y urgentes?"],
      ["assistant", "1."],
    ]);
    expect(conv?.messages[1].data).toEqual({ stats: [{ label: "Abiertos", value: "3" }] });

    // Ni el Superadmin ve ni sigue la de otra persona: arranca una nueva a su nombre.
    expect(await getConversation(beto.id, first.conversationId)).toBeNull();
    expect(await listConversations(beto.id)).toEqual([]);
    const other = await saveExchange(beto.id, { conversationId: first.conversationId, question: "Hola", answer: "Hola" });
    expect(other.conversationId).not.toBe(first.conversationId);
    expect(await markProposalResult(beto.id, first.messageId, { step: "cancelled" })).toBe(false);
    expect(await deleteConversation(beto.id, first.conversationId)).toBe(false);

    expect((await listConversations(ana.id)).map((c) => c.id)).toEqual([first.conversationId]);
    expect(await deleteConversation(ana.id, first.conversationId)).toBe(true);
    expect(await prisma.assistantMessage.count({ where: { conversationId: first.conversationId } })).toBe(0);
  });

  it("se borran solas 10 días después de la última pregunta", async () => {
    const user = await createUser("DIRECTOR_AREA");
    const now = new Date("2026-11-15T12:00:00Z");
    const old = await saveExchange(user.id, { question: "Vieja", answer: "x" }, new Date("2026-11-05T11:00:00Z"));
    const recent = await saveExchange(user.id, { question: "Reciente", answer: "x" }, new Date("2026-11-06T11:00:00Z"));
    // Una vieja no se puede seguir: la pregunta arranca una conversación nueva.
    const continued = await saveExchange(user.id, { conversationId: old.conversationId, question: "Sigo", answer: "x" }, now);
    expect(continued.conversationId).not.toBe(old.conversationId);
    expect(await prisma.assistantConversation.findUnique({ where: { id: old.conversationId } })).toBeNull();
    expect((await listConversations(user.id, now)).map((c) => c.title)).toEqual(["Sigo", "Reciente"]);
    expect(await getConversation(user.id, recent.conversationId, new Date("2026-11-16T12:00:00Z"))).toBeNull();
  });

  it("anota si la tarjeta se confirmó, así al volver no se ofrece de nuevo", async () => {
    const user = await createUser("SUPERADMIN");
    const saved = await saveExchange(user.id, {
      question: "Agendame una tarea",
      answer: "### Revisá la tarea",
      data: { proposal: { kind: "tarea", titulo: "Llamar", fecha: null, hora: null } },
    });
    expect(await markProposalResult(user.id, saved.messageId, { step: "done", message: "Listo", link: "/tasks" })).toBe(true);
    const conv = await getConversation(user.id, saved.conversationId);
    expect(conv?.messages[1].data).toEqual({
      proposal: { kind: "tarea", titulo: "Llamar", fecha: null, hora: null },
      proposalResult: { step: "done", message: "Listo", link: "/tasks" },
    });
  });
});
