import { describe, expect, it } from "vitest";
import {
  ASSISTANT_TOOLS,
  findTool,
  geminiFunctionDeclarations,
  isGreeting,
  matchAreaName,
  matchProgramLabels,
  taskTitleFromQuery,
  routeToToolCall,
  toolPath,
  validateToolArgs,
} from "@/lib/assistant-tools";
import { pickRoute, routingText } from "@/lib/assistant-routing";
import { ASSISTANT_TOPICS } from "@/lib/assistant-suggestions";
import { buildAssistantScope, NO_AREA, programVisible, scopeCanSee, scopedAreaIdWhere, scopedCaseWhere, scopeWithoutArea } from "@/lib/assistant-scope";

const byWords = (q: string) => {
  const text = routingText(q);
  return routeToToolCall(pickRoute(text), text, q);
};

describe("la lista fija de consultas", () => {
  it("cada consulta tiene nombre, descripción y lo que dice mientras busca", () => {
    for (const t of ASSISTANT_TOOLS) {
      expect(t.name).toMatch(/^[a-z_]+$/);
      expect(t.description.length).toBeGreaterThan(20);
      expect(t.status.endsWith("…")).toBe(true);
    }
    expect(new Set(ASSISTANT_TOOLS.map((t) => t.name)).size).toBe(ASSISTANT_TOOLS.length);
  });

  it("se le pasan a Gemini con sus filtros", () => {
    const decl = geminiFunctionDeclarations();
    const cases = decl.find((d) => d.name === "expedientes") as any;
    expect(cases.parameters.properties.prioridad).toMatchObject({ type: "STRING", format: "enum", enum: ["URGENTE", "ALTA", "MEDIA", "BAJA"] });
    expect(cases.parameters.properties.grafico.type).toBe("BOOLEAN");
    expect((decl.find((d) => d.name === "mis_tareas") as any).parameters).toBeUndefined();
  });

  it("de lo que manda Gemini se queda solo con filtros conocidos y válidos", () => {
    expect(validateToolArgs("no_existe", {})).toBeNull();
    expect(
      validateToolArgs("expedientes", {
        prioridad: "urgente",
        estado: "borrados",
        desde: "2026-02-30",
        hasta: "2026-10-31",
        grafico: "true",
        sql: "DROP TABLE",
        area: "  Niñez\n",
      })
    ).toEqual({ prioridad: "URGENTE", hasta: "2026-10-31", grafico: true, area: "Niñez" });
    expect(validateToolArgs("cerca_de", { metros: 99999 })).toEqual({ metros: 5000 });
    expect(validateToolArgs("reservar_vehiculo", { hora_salida: "9:30", hora_vuelta: "25:00" })).toEqual({ hora_salida: "09:30" });
    expect(validateToolArgs("cruce_programas", { programas: ["Tarjeta Alimentar", "Tarjeta Alimentar", 3, "Jardines"] })).toEqual({
      programas: ["Tarjeta Alimentar", "Jardines"],
    });
    expect((validateToolArgs("persona", { nombre_o_dni: "x".repeat(300) })!.nombre_o_dni as string).length).toBe(80);
  });

  it("reconoce los programas y las áreas como los escribe la gente", () => {
    expect(matchProgramLabels(["tarjeta alimentar", "jardines", "envion", "nada que ver"])).toEqual([
      "Tarjeta Alimentar",
      "Jardines Municipales",
      "Espacios de Educación No Formal (UDIs, Apoyos, Becas, Envión)",
    ]);
    const areas = [{ name: "Dirección de Niñez" }, { name: "Coordinación de Violencia de Género" }, { name: "Dirección de Hábitat" }];
    expect(matchAreaName("niñez", areas)?.name).toBe("Dirección de Niñez");
    expect(matchAreaName("Habitat", areas)?.name).toBe("Dirección de Hábitat");
    expect(matchAreaName("Deportes", areas)).toBeNull();
  });
});

describe("saludos", () => {
  it("solo cuenta como saludo cuando el mensaje es solo eso", () => {
    expect(isGreeting("Hola")).toBe(true);
    expect(isGreeting("hola, ¿qué podés hacer?")).toBe(true);
    expect(isGreeting("¡Muchas gracias!")).toBe(true);
    expect(isGreeting("ayuda")).toBe(true);
    expect(isGreeting("¿Cuántas personas reciben ayuda alimentaria?")).toBe(false);
    expect(isGreeting("Hola, ¿cuántos expedientes urgentes hay?")).toBe(false);
    expect(isGreeting("gracias, ¿y en Niñez?")).toBe(false);
  });
});

describe("sin Gemini, de las palabras a una consulta", () => {
  it("cada pregunta de ejemplo va a una consulta de la lista", () => {
    for (const q of ASSISTANT_TOPICS.flatMap((t) => t.questions)) {
      const call = byWords(q);
      expect(findTool(call.tool), q).toBeDefined();
      expect(call.tool, q).not.toBe("buscar");
      expect(call.via).toBe("palabras");
    }
  });

  it("lee los filtros de expedientes y los gráficos", () => {
    expect(byWords("Mostrame un gráfico de expedientes urgentes por prioridad")).toMatchObject({
      tool: "expedientes",
      args: { prioridad: "URGENTE", agrupar_por: "prioridad", grafico: true },
    });
    expect(byWords("Mostrame un gráfico de expedientes por área").args).toEqual({ agrupar_por: "area", grafico: true });
    expect(byWords("¿Cuántos expedientes abiertos hay y cuántos son urgentes?")).toMatchObject({ tool: "expedientes", args: {} });
    expect(byWords("¿Cuántos expedientes urgentes hay?")).toMatchObject({ tool: "expedientes", args: { prioridad: "URGENTE" } });
    expect(byWords("¿Cuántas personas reciben ayuda alimentaria?").tool).toBe("programas");
    expect(byWords("¿Cuántos expedientes hay sin movimiento?")).toMatchObject({ tool: "expedientes", args: { sin_movimiento: true } });
    expect(byWords("Gráfico de gasto por proveedor")).toMatchObject({ tool: "grafico", args: { tipo: "gasto_proveedor" } });
    expect(byWords("¿Qué gráficos podés hacer?")).toMatchObject({ tool: "grafico", args: { tipo: "opciones" } });
  });

  it("arma el título de la tarea sin el pedido, el día ni la hora", () => {
    expect(taskTitleFromQuery("Agendame una tarea para mañana a las 10: llamar a la escuela")).toBe("Llamar a la escuela");
    expect(taskTitleFromQuery("Recordame el jueves a las 9 visitar a la familia Gómez")).toBe("Visitar a la familia Gómez");
    expect(taskTitleFromQuery("crear tarea revisar legajos para el 12/11")).toBe("Revisar legajos");
    expect(taskTitleFromQuery("agendá")).toBe("Tarea");
  });

  it("los pedidos van a la consulta que arma la tarjeta para confirmar", () => {
    expect(byWords("Reservame un auto el viernes de 9 a 12").tool).toBe("reservar_vehiculo");
    expect(byWords("Agendame una tarea para mañana a las 10: llamar a la escuela").tool).toBe("crear_tarea");
    expect(byWords("¿Qué vehículos tienen la VTV vencida?")).toMatchObject({ tool: "vehiculos", args: { tema: "vencimientos" } });
    expect(byWords("Orden de compra 1234")).toMatchObject({ tool: "compras", args: { tema: "orden", numero: "1234" } });
  });
});

describe("qué ve cada rol", () => {
  it("el Director de Área queda limitado a su área y sin Recursos Humanos", () => {
    const director = buildAssistantScope({ id: "u1", role: "DIRECTOR_AREA", areaId: "a1" });
    expect(director).toMatchObject({ areaId: "a1", limitedToArea: true, canViewSensitive: false });
    expect(scopeCanSee(director, toolPath({ tool: "licencias", args: {} }))).toBe(false);
    expect(scopeCanSee(director, toolPath({ tool: "personal", args: {} }))).toBe(false);
    expect(scopeCanSee(director, toolPath({ tool: "grafico", args: { tipo: "personal_contrato" } }))).toBe(false);
    expect(scopeCanSee(director, toolPath({ tool: "grafico", args: { tipo: "gasto_area" } }))).toBe(true);
    expect(scopeCanSee(director, toolPath({ tool: "expedientes", args: {} }))).toBe(true);
    expect(scopedCaseWhere(director)).toEqual({ areaId: "a1", NOT: { area: { name: { contains: "violencia", mode: "insensitive" } } } });
    expect(scopedAreaIdWhere(director)).toEqual({ areaId: "a1" });
    expect(scopedAreaIdWhere(director, true)).toEqual({ OR: [{ areaId: "a1" }, { areaId: null }] });
    expect(programVisible(director, "a1")).toBe(true);
    expect(programVisible(director, null)).toBe(true);
    expect(programVisible(director, "a2")).toBe(false);
  });

  it("un Director sin área no ve datos de ninguna", () => {
    const scope = buildAssistantScope({ id: "u1", role: "DIRECTOR_AREA", areaId: null });
    expect(scope.areaId).toBe(NO_AREA);
    expect(scopeWithoutArea(scope)).toBe(true);
  });

  it("la conducción ve todo, también Violencia de Género", () => {
    for (const role of ["SUPERADMIN", "DIRECCION_GENERAL", "ADMIN_GENERAL"]) {
      const scope = buildAssistantScope({ id: "u1", role, areaId: "a1" });
      expect(scope).toMatchObject({ areaId: null, limitedToArea: false, canViewSensitive: true });
      expect(scopedCaseWhere(scope)).toEqual({});
      expect(scopeCanSee(scope, "/admin/hr")).toBe(true);
    }
  });
});
