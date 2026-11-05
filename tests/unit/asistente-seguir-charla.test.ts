import { describe, expect, it } from "vitest";
import { pickRoute, routingText } from "@/lib/assistant-routing";
import { daysInText, followUpCall, isFollowUp, parsePreviousCall, previousCallText, routeToToolCall, validateToolArgs, type ToolCall } from "@/lib/assistant-tools";
import { movementDaysParam, staleCutoff } from "@/lib/case-summary";
import { consultaDeFiltros } from "@/lib/filtros-guardados";
import { storedAnswerData } from "@/lib/assistant-conversations";

// Sin Gemini: lo que elige la búsqueda por palabras.
function keywordCall(q: string, prev: ToolCall | null = null): ToolCall {
  const text = routingText(q);
  const route = pickRoute(text);
  return followUpCall(prev, route, text, q) ?? routeToToolCall(route, text, q);
}

describe("expedientes con y sin movimiento", () => {
  it("lee los días de la pregunta", () => {
    expect(daysInText("en los últimos 30 días")).toBe(30);
    expect(daysInText("en la última semana")).toBe(7);
    expect(daysInText("en las últimas 2 semanas")).toBe(14);
    expect(daysInText("este mes")).toBe(30);
    expect(daysInText("hoy")).toBe(1);
    expect(daysInText("expedientes abiertos")).toBeNull();
  });

  it("con movimiento, sin movimiento y cuáles son", () => {
    expect(keywordCall("¿Cuáles son los expedientes que tuvieron movimiento en los últimos 30 días?").args).toEqual({ con_movimiento_dias: 30, listar: true });
    expect(keywordCall("¿Cuántos expedientes tuvieron moviiento esta semana?").args).toEqual({ con_movimiento_dias: 7 });
    expect(keywordCall("¿Cuántos expedientes están sin movimiento hace 60 días?").args).toEqual({ sin_movimiento_dias: 60 });
    expect(keywordCall("¿Cuántos expedientes sin movimiento hay?").args).toEqual({ sin_movimiento: true });
    expect(keywordCall("Expedientes que no se movieron en el último mes").args).toEqual({ sin_movimiento: true });
    expect(keywordCall("¿Cuántos expedientes abiertos hay?").args).toEqual({});
    // Agrupar no lista.
    expect(keywordCall("¿Cuáles áreas tienen expedientes urgentes? por área").args).toEqual({ prioridad: "URGENTE", agrupar_por: "area" });
  });

  it("Gemini puede pedir los días y listar; se revisan los valores", () => {
    expect(validateToolArgs("expedientes", { con_movimiento_dias: "15", listar: "true", sin_movimiento_dias: 900 })).toEqual({
      sin_movimiento_dias: 365,
      con_movimiento_dias: 15,
      listar: true,
    });
  });

  it("la lista de Expedientes entiende los días que manda el asistente", () => {
    expect(movementDaysParam("1", "quiet")).toBe(30);
    expect(movementDaysParam("60", "quiet")).toBe(60);
    expect(movementDaysParam("7", "moved")).toBe(7);
    expect(movementDaysParam("0", "moved")).toBeNull();
    expect(movementDaysParam("abc", "quiet")).toBeNull();
    expect(movementDaysParam("1000", "moved")).toBeNull();
    const now = new Date("2026-11-05T15:00:00Z");
    expect(staleCutoff(now, 1).toISOString()).toBe("2026-11-05T03:00:00.000Z");
    expect(staleCutoff(now, 7).toISOString()).toBe("2026-10-30T03:00:00.000Z");
    expect(staleCutoff(now)).toEqual(staleCutoff(now, 30));
    expect(consultaDeFiltros({ moved: "7", quiet: "60", status: "ACTIVOS" })).toBe("status=ACTIVOS&quiet=60&moved=7");
  });
});

describe("seguir la charla", () => {
  const summary: ToolCall = { tool: "expedientes", args: { prioridad: "URGENTE" }, via: "palabras" };

  it("reconoce las preguntas que siguen la anterior", () => {
    expect(isFollowUp("Y cuales son los que tuvieron moviiento en los últimos 30 días?")).toBe(true);
    expect(isFollowUp("¿Y de Niñez?")).toBe(true);
    expect(isFollowUp("¿Cuáles son?")).toBe(true);
    expect(isFollowUp("¿Cuántos expedientes hay?")).toBe(false);
  });

  it("la pregunta de la captura: sigue con expedientes, con movimiento y listando", () => {
    const call = keywordCall("Y cuales son los que tuvieron moviiento en los últimos 30 días?", { tool: "expedientes", args: {}, via: "palabras" });
    expect(call).toEqual({ tool: "expedientes", args: { con_movimiento_dias: 30, listar: true }, via: "palabras" });
  });

  it("suma o cambia filtros sobre los anteriores", () => {
    expect(keywordCall("¿Y cuáles son?", summary).args).toEqual({ prioridad: "URGENTE", listar: true });
    expect(keywordCall("¿Y de Niñez?", summary).args).toEqual({ prioridad: "URGENTE", area: "niñez" });
    expect(keywordCall("¿y los cerrados?", summary).args).toEqual({ prioridad: "URGENTE", estado: "cerrados" });
    const quiet: ToolCall = { tool: "expedientes", args: { sin_movimiento: true }, via: "palabras" };
    expect(keywordCall("¿Y los que se movieron esta semana?", quiet).args).toEqual({ con_movimiento_dias: 7 });
  });

  it("una pregunta nueva no hereda filtros", () => {
    expect(keywordCall("¿Cuántos expedientes cerrados hay?", summary).args).toEqual({ estado: "cerrados" });
    expect(keywordCall("¿Quién está de licencia hoy?", summary).tool).toBe("licencias");
  });

  it("la consulta anterior se revisa y no viaja con nombres ni DNI", () => {
    expect(parsePreviousCall({ tool: "expedientes", args: { prioridad: "urgente", raro: "x" } })).toEqual({ tool: "expedientes", args: { prioridad: "URGENTE" }, via: "palabras" });
    expect(parsePreviousCall({ tool: "persona", args: { nombre_o_dni: "30111222" } })).toBeNull();
    expect(parsePreviousCall("expedientes")).toBeNull();
    expect(previousCallText({ tool: "expedientes", args: { prioridad: "URGENTE", listar: true }, via: "gemini" })).toContain('"expedientes" con estos filtros: prioridad=URGENTE.');
    expect(storedAnswerData({ call: { tool: "expedientes", args: { con_movimiento_dias: 30, listar: true } } })).toEqual({
      call: { tool: "expedientes", args: { con_movimiento_dias: 30, listar: true } },
    });
  });
});
