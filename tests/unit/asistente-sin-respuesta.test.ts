import { describe, expect, it } from "vitest";
import { canAccessPath } from "@/lib/permissions";
import {
  HIDDEN_NUMBER,
  cleanUnansweredQuestion,
  groupUnanswered,
  maskLongNumbers,
  unansweredCutoff,
  unansweredKey,
  unansweredReason,
} from "@/lib/assistant-unanswered";

const NO_DATA = "No encontré datos en la app para esa pregunta. Probá con otras palabras o con una de las preguntas de ejemplo.";

describe("qué cuenta como pregunta sin respuesta", () => {
  it("anota cuando no la entendió o dio error", () => {
    expect(unansweredReason({ intent: "fallback", answer: NO_DATA })).toBe("NO_ENTENDIO");
    expect(unansweredReason({ intent: "universal_search", answer: NO_DATA })).toBe("NO_ENTENDIO");
    expect(unansweredReason({ intent: "error", answer: "Error de sistema" })).toBe("ERROR");
  });

  it("no anota cuando la entendió, aunque no haya resultados", () => {
    expect(unansweredReason({ intent: "cases_query", answer: "Hay **0** expedientes abiertos." })).toBeNull();
    expect(unansweredReason({ intent: "person_not_found", answer: "No encontré a nadie con ese nombre en el Registro Único." })).toBeNull();
    expect(unansweredReason({ intent: "greeting", answer: "¡Hola!" })).toBeNull();
    expect(unansweredReason(null)).toBeNull();
  });
});

describe("datos personales", () => {
  it("tapa DNI, CUIL y teléfonos, y deja los números cortos", () => {
    expect(maskLongNumbers("ficha del 30123456")).toBe(`ficha del ${HIDDEN_NUMBER}`);
    expect(maskLongNumbers("DNI 30.123.456 y CUIL 20-30123456-7")).toBe(`DNI ${HIDDEN_NUMBER} y CUIL ${HIDDEN_NUMBER}`);
    expect(maskLongNumbers("llamar al 11 4567 8901")).toBe(`llamar al ${HIDDEN_NUMBER}`);
    expect(maskLongNumbers("sin movimiento hace 60 días en 2026")).toBe("sin movimiento hace 60 días en 2026");
  });

  it("guarda la pregunta en un renglón y recortada", () => {
    expect(cleanUnansweredQuestion("  ¿cuántos\n  hay?  ")).toBe("¿cuántos hay?");
    expect(cleanUnansweredQuestion("x".repeat(900))).toHaveLength(500);
    expect(cleanUnansweredQuestion("   ")).toBe("");
  });
});

describe("juntar preguntas iguales", () => {
  it("la clave ignora mayúsculas, tildes, signos y espacios", () => {
    expect(unansweredKey("¿Cuántas BECAS hay?")).toBe(unansweredKey("cuantas  becas hay"));
    expect(unansweredKey("¿Y el DNI 30123456?")).toBe(unansweredKey("y el dni 28.999.111"));
    expect(unansweredKey("¿?!")).toBe("");
  });

  it("ordena por veces y muestra la última forma de escribirla", () => {
    const d = (day: number) => new Date(Date.UTC(2026, 10, day, 12));
    const row = (question: string, day: number, extra: Partial<{ reason: string; role: string; areaName: string; resolvedAt: Date }> = {}) => ({
      question,
      key: unansweredKey(question),
      reason: extra.reason ?? "NO_ENTENDIO",
      role: extra.role ?? null,
      areaName: extra.areaName ?? null,
      createdAt: d(day),
      resolvedAt: extra.resolvedAt ?? null,
    });
    const groups = groupUnanswered([
      row("¿Cuántas becas hay?", 1, { role: "DIRECTOR_AREA", areaName: "Dirección de Niñez" }),
      row("cuantas becas hay", 3, { role: "SUPERADMIN", reason: "ERROR" }),
      row("¿Quién maneja el camión?", 4),
    ]);
    expect(groups.map((g) => g.times)).toEqual([2, 1]);
    expect(groups[0]).toMatchObject({ question: "cuantas becas hay", errors: 1, askers: [{ role: "DIRECTOR_AREA", areaName: "Dirección de Niñez" }, { role: "SUPERADMIN", areaName: null }] });
    expect(groups[0].firstAt).toEqual(d(1));
    expect(groups[0].lastAt).toEqual(d(3));
  });

  it("se borran a los 60 días", () => {
    const now = new Date("2026-11-05T12:00:00Z");
    expect(unansweredCutoff(now).toISOString()).toBe("2026-09-06T12:00:00.000Z");
  });
});

describe("quién la abre", () => {
  it("solo el Superadmin abre la lista; el resto del asistente sigue igual", () => {
    expect(canAccessPath("SUPERADMIN", "/admin/assistant/sin-respuesta")).toBe(true);
    for (const role of ["ADMIN_GENERAL", "DIRECCION_GENERAL", "DIRECTOR_AREA"]) {
      expect(canAccessPath(role, "/admin/assistant/sin-respuesta")).toBe(false);
      expect(canAccessPath(role, "/admin/assistant")).toBe(true);
    }
  });
});
