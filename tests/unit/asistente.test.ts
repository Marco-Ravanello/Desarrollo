import { describe, expect, it } from "vitest";
import { parseAnswer, parseInline, plainAnswer } from "@/lib/assistant-text";
import { isCreationRequest, needsPersonLookup, pickRoute, routingText, ROUTE_STATUS } from "@/lib/assistant-routing";
import { ASSISTANT_TOPICS } from "@/lib/assistant-suggestions";

const route = (q: string) => pickRoute(routingText(q));

describe("texto de las respuestas", () => {
  it("arma títulos, párrafos, listas y tablas", () => {
    const blocks = parseAnswer(
      "### Expedientes abiertos\n\nHay **12** abiertos.\n\n#### Por área:\n*   **Niñez:** 3\n*   Hábitat: 2\n\n1. Primero\n2. Segundo\n\n| Área | Abiertos |\n| :--- | ---: |\n| Niñez | 3 |\n| Hábitat | **2** |"
    );
    expect(blocks.map((b) => b.type)).toEqual(["title", "paragraph", "title", "list", "list", "table"]);
    expect(blocks[0]).toEqual({ type: "title", level: 3, text: "Expedientes abiertos" });
    expect(blocks[2]).toEqual({ type: "title", level: 4, text: "Por área" });
    expect(blocks[1]).toEqual({ type: "paragraph", inline: [{ kind: "text", text: "Hay " }, { kind: "bold", text: "12" }, { kind: "text", text: " abiertos." }] });
    expect(blocks[3]).toMatchObject({ type: "list", ordered: false, items: [[{ kind: "bold", text: "Niñez:" }, { kind: "text", text: " 3" }], [{ kind: "text", text: "Hábitat: 2" }]] });
    expect(blocks[4]).toMatchObject({ type: "list", ordered: true });
    const table = blocks[5];
    expect(table.type === "table" && table.header).toEqual(["Área", "Abiertos"]);
    expect(table.type === "table" && table.rows.length).toBe(2);
    expect(table.type === "table" && table.rows[1][1]).toEqual([{ kind: "bold", text: "2" }]);
  });

  it("lo que parece código de página queda como texto", () => {
    const blocks = parseAnswer('Caso: <img src=x onerror="alert(1)"> y **<b>negrita</b>**');
    expect(blocks).toEqual([
      {
        type: "paragraph",
        inline: [
          { kind: "text", text: 'Caso: <img src=x onerror="alert(1)"> y ' },
          { kind: "bold", text: "<b>negrita</b>" },
        ],
      },
    ]);
  });

  it("itálica y código", () => {
    expect(parseInline("*nota* y `EN_TALLER`, pero 2 * 3 no")).toEqual([
      { kind: "italic", text: "nota" },
      { kind: "text", text: " y " },
      { kind: "code", text: "EN_TALLER" },
      { kind: "text", text: ", pero 2 * 3 no" },
    ]);
  });

  it("el texto para copiar o escuchar sale sin marcas", () => {
    expect(plainAnswer("### Título\n\nHay **3** `abiertos`.\n*   Uno\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n[Ver](/cases)")).toBe(
      "Título\n\nHay 3 abiertos.\n• Uno\n\nA · B\n1 · 2\nVer"
    );
  });
});

describe("dónde busca cada pregunta", () => {
  it("cada pregunta de ejemplo va a una parte de la app, no a la búsqueda general", () => {
    const routes = ASSISTANT_TOPICS.flatMap((t) => t.questions.map((q) => [q, route(q)]));
    expect(Object.fromEntries(routes)).toEqual({
      "¿Cuántos expedientes abiertos hay y cuántos son urgentes?": "cases",
      "Mostrame un gráfico de expedientes por área": "chart",
      "Mostrame un gráfico de expedientes por prioridad": "chart",
      "¿Cuántas personas hay en cada programa?": "programs",
      "¿Cuántas personas y expedientes abiertos hay en cada barrio?": "barrios",
      "¿Quién está de licencia o de vacaciones hoy?": "leaves",
      "¿Cuánto se gasta en sueldos del personal activo?": "hr",
      "¿Cómo viene la ejecución del presupuesto?": "budget",
      "¿Qué insumos tienen poco stock?": "supplies",
      "¿Cuántos convenios hay vigentes?": "agreements",
      "¿Cómo está la flota de vehículos?": "vehicles",
      "¿Qué vehículos tienen la VTV o el seguro vencido?": "vehicles",
      "¿Qué cursos y talleres están abiertos?": "courses",
      "¿Qué tareas tengo pendientes?": "tasks",
    });
  });

  it("resuelve las palabras que se confunden", () => {
    expect(route("¿Qué vehículos están en el taller?")).toBe("vehicles");
    expect(route("¿Quién tiene la licencia de conducir vencida?")).not.toBe("leaves");
    expect(route("Agendame una tarea para mañana a las 10")).toBe("command");
    expect(route("Mostrame el cruce de programas sociales")).toBe("crossing");
    expect(route("Órdenes de compra pendientes")).toBe("budget");
    expect(pickRoute(routingText("¿Qué expedientes tiene Juan Pérez?"), true)).toBe("person");
    expect(route("Hola, ¿qué tal el día?")).toBe("search");
  });

  it("solo busca a la persona por nombre cuando hace falta", () => {
    expect(needsPersonLookup(routingText("¿Qué expedientes tiene Juan Pérez?"))).toBe(true);
    expect(needsPersonLookup(routingText("Gráfico de expedientes por área"))).toBe(false);
    expect(isCreationRequest(routingText("Agendar una reunión el jueves"))).toBe(true);
    expect(isCreationRequest(routingText("¿Qué tareas tengo pendientes?"))).toBe(false);
  });

  it("cada lugar dice qué está buscando", () => {
    expect(ROUTE_STATUS.cases).toBe("Buscando en Expedientes…");
    expect(Object.values(ROUTE_STATUS).every((s) => s.endsWith("…"))).toBe(true);
  });
});
