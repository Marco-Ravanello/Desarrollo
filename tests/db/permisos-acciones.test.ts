import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Role } from "@prisma/client";
import prisma from "@/lib/prisma";
import { createUserAction, updateUserAction } from "@/app/(dashboard)/admin/actions/user-actions";
import { queryAssistantAction } from "@/app/(dashboard)/admin/actions/assistant-actions";
import { toggleEmergencyStatusAction } from "@/app/(dashboard)/admin/actions/emergency-actions";
import { POST as assistantStream } from "@/app/api/assistant/stream/route";
import { queryAIAssistant, queryAIAssistantStream } from "@/services/ai-assistant";
import { getAllCases } from "@/services/cases";
import { createArea, createUser, loginAs } from "./helpers";

// Las pruebas no llaman a Gemini: solo se revisa si la consulta llegaría.
vi.mock("@/services/ai-assistant", () => ({
  queryAIAssistant: vi.fn(async () => ({ intent: "prueba", answer: "respuesta de prueba" })),
  queryAIAssistantStream: vi.fn(async () => ({ intent: "prueba", answer: "respuesta de prueba" })),
}));

const ROLES: Role[] = ["SUPERADMIN", "DIRECCION_GENERAL", "ADMIN_GENERAL", "DIRECTOR_AREA", "OPERATIVO", "AUDITOR", "VIOLENCIA_GENERO", "RELEVADOR_EMERGENCIA"];
const ASSISTANT_ROLES: Role[] = ["SUPERADMIN", "DIRECCION_GENERAL", "ADMIN_GENERAL", "DIRECTOR_AREA"];

describe("Asistente de IA por rol", () => {
  for (const role of ROLES) {
    const allowed = ASSISTANT_ROLES.includes(role);
    it(`${role} ${allowed ? "puede" : "no puede"} consultar al asistente`, async () => {
      vi.mocked(queryAIAssistant).mockClear();
      vi.mocked(queryAIAssistantStream).mockClear();
      loginAs(await createUser(role));

      const res = await queryAssistantAction("¿Cuántos casos abiertos hay?");
      const stream = await assistantStream(
        new Request("http://localhost/api/assistant/stream", { method: "POST", body: JSON.stringify({ query: "¿Cuántos casos abiertos hay?" }) }) as any
      );

      if (allowed) {
        expect(res.answer).toBe("respuesta de prueba");
        expect(stream.status).toBe(200);
        await stream.text();
        expect(queryAIAssistantStream).toHaveBeenCalledTimes(1);
      } else {
        expect(res.intent).toBe("error");
        expect(stream.status).toBe(403);
        expect(queryAIAssistant).not.toHaveBeenCalled();
        expect(queryAIAssistantStream).not.toHaveBeenCalled();
      }
    });
  }

  it("sin sesión no responde", async () => {
    loginAs(null);
    const stream = await assistantStream(new Request("http://localhost/api/assistant/stream", { method: "POST", body: "{}" }) as any);
    expect(stream.status).toBe(401);
  });
});

describe("usuarios", () => {
  const form = (data: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(data)) fd.set(k, v);
    return fd;
  };

  it("un operativo no puede crear usuarios", async () => {
    loginAs(await createUser("OPERATIVO"));
    const res = await createUserAction(form({ name: "X", username: `nuevo1`, email: "nuevo1@prueba.test", password: "clave-prueba", role: "OPERATIVO" }));
    expect(res.success).toBe(false);
    expect(await prisma.user.count({ where: { email: "nuevo1@prueba.test" } })).toBe(0);
  });

  it("solo un Superadmin puede dar el rol Superadmin", async () => {
    loginAs(await createUser("ADMIN_GENERAL"));
    const res = await createUserAction(form({ name: "X", username: `nuevo2`, email: "nuevo2@prueba.test", password: "clave-prueba", role: "SUPERADMIN" }));
    expect(res.success).toBe(false);

    const operativo = await createUser("OPERATIVO");
    const up = await updateUserAction({ id: operativo.id, name: "X", email: operativo.email!, role: "SUPERADMIN" });
    expect(up.success).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: operativo.id } })).role).toBe("OPERATIVO");
  });

  it("un Admin General no puede modificar a un Superadmin", async () => {
    const superadmin = await createUser("SUPERADMIN");
    loginAs(await createUser("ADMIN_GENERAL"));
    const res = await updateUserAction({ id: superadmin.id, name: "X", email: superadmin.email!, role: "OPERATIVO" });
    expect(res.success).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: superadmin.id } })).role).toBe("SUPERADMIN");
  });
});

describe("casos de Violencia de Género", () => {
  beforeAll(async () => {
    // Datos inventados, solo en la base de prueba local.
    const vg = await createArea("Violencia de Género (prueba)");
    const otra = await createArea("Niñez (prueba)");
    const person = await prisma.person.create({ data: { firstName: "Persona", lastName: "Prueba", dni: "92000001" } });
    await prisma.case.create({ data: { personId: person.id, areaId: vg.id, title: "Caso sensible de prueba" } });
    await prisma.case.create({ data: { personId: person.id, areaId: otra.id, title: "Caso común de prueba" } });
  });

  it("no aparecen en el listado de casos para quien no tiene permiso", async () => {
    const { cases } = await getAllCases({ canViewSensitive: false });
    expect(cases.map((c) => c.title)).toEqual(["Caso común de prueba"]);
  });

  it("sí aparecen para quien tiene permiso", async () => {
    const { cases } = await getAllCases({ canViewSensitive: true });
    expect(cases.map((c) => c.title).sort()).toEqual(["Caso común de prueba", "Caso sensible de prueba"]);
  });
});

describe("modo emergencia", () => {
  it("solo la conducción lo activa", async () => {
    loginAs(await createUser("OPERATIVO"));
    expect((await toggleEmergencyStatusAction(true)).success).toBe(false);
    loginAs(await createUser("DIRECCION_GENERAL"));
    expect((await toggleEmergencyStatusAction(true)).success).toBe(true);
  });
});
