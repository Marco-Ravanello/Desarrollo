import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { HIDDEN_NUMBER } from "@/lib/assistant-unanswered";
import {
  countPendingUnanswered,
  deleteUnanswered,
  listUnanswered,
  recordUnanswered,
  reopenUnanswered,
  resolveUnanswered,
} from "@/services/assistant/unanswered";
import { createArea } from "./helpers";

// Preguntas inventadas, solo en la base de prueba local que se vacía en cada archivo.

const DAY = 86400000;

describe("preguntas sin respuesta", () => {
  it("guarda la pregunta tapada, con rol y área, y sin la respuesta", async () => {
    const area = await createArea("Dirección de Niñez");
    await recordUnanswered({ question: "¿Qué becas tiene el 30123456?", reason: "NO_ENTENDIO", role: "DIRECTOR_AREA", areaId: area.id });
    const row = await prisma.assistantUnansweredQuestion.findFirstOrThrow();
    expect(row.question).toBe(`¿Qué becas tiene el ${HIDDEN_NUMBER}?`);
    expect(row.question).not.toContain("30123456");
    expect(row).toMatchObject({ reason: "NO_ENTENDIO", role: "DIRECTOR_AREA", areaName: "Dirección de Niñez", resolvedAt: null });
    expect(Object.keys(row)).not.toContain("answer");
    expect(await recordUnanswered({ question: "   ", reason: "ERROR" })).toBe(false);
  });

  it("junta las iguales, marca, reabre, borra y borra solas las de más de 60 días", async () => {
    await prisma.assistantUnansweredQuestion.deleteMany();
    const now = new Date();
    await recordUnanswered({ question: "¿Cuántas becas hay?", reason: "NO_ENTENDIO", role: "SUPERADMIN" }, now);
    await recordUnanswered({ question: "cuantas becas hay", reason: "ERROR", role: "DIRECCION_GENERAL" }, now);
    await recordUnanswered({ question: "¿Quién maneja el camión?", reason: "NO_ENTENDIO" }, now);

    let list = await listUnanswered("pendientes", now);
    expect(list.pending).toBe(2);
    expect(list.groups[0]).toMatchObject({ times: 2, errors: 1 });
    expect(await countPendingUnanswered(now)).toBe(2);

    const becas = list.groups[0].key;
    await resolveUnanswered(becas, now);
    list = await listUnanswered("pendientes", now);
    expect(list.groups.map((g) => g.question)).toEqual(["¿Quién maneja el camión?"]);
    const done = await listUnanswered("resueltas", now);
    expect(done.groups).toHaveLength(1);
    expect(done.groups[0].resolvedAt).not.toBeNull();

    // Si la vuelven a hacer y no la responde, vuelve a pendientes.
    await recordUnanswered({ question: "¿cuántas becas hay?", reason: "NO_ENTENDIO" }, now);
    list = await listUnanswered("pendientes", now);
    expect(list.groups.find((g) => g.key === becas)?.times).toBe(1);
    expect((await listUnanswered("resueltas", now)).resolved).toBe(0);

    await resolveUnanswered(becas, now);
    await reopenUnanswered(becas);
    expect((await listUnanswered("pendientes", now)).groups.find((g) => g.key === becas)?.times).toBe(3);

    await deleteUnanswered(becas);
    expect(await prisma.assistantUnansweredQuestion.count({ where: { key: becas } })).toBe(0);

    // Una de hace 61 días se borra al anotar o abrir la lista.
    await prisma.assistantUnansweredQuestion.create({ data: { question: "vieja", key: "vieja", reason: "NO_ENTENDIO", createdAt: new Date(now.getTime() - 61 * DAY) } });
    list = await listUnanswered("pendientes", now);
    expect(list.groups.map((g) => g.key)).not.toContain("vieja");
    expect(await prisma.assistantUnansweredQuestion.count({ where: { key: "vieja" } })).toBe(0);
  });
});
