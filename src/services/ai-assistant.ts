import prisma from "@/lib/prisma";
import { callGeminiAnonymized } from "@/services/gemini-ai";
import {
  Message,
  AIResponse,
  UniversalSearchResult
} from "./assistant/types";
import { ZERO_HALLUCINATION_SYSTEM_PROMPT } from "./assistant/prompts";
import { callOllama, callOllamaStream } from "./assistant/ollama-client";
import { resolveAnaphoraAndContext, expandMunicipalSynonyms } from "./assistant/context-resolver";
import {
  handleChartRequest,
  handleHRQuery,
  handleBudgetQuery,
  handleVehicleQuery,
  handleAgreementQuery,
  handleSocialQuery,
  handleSupplyQuery,
  handleDocumentRAGQuery,
  handleAgentCommandQuery,
  handleFichaSocialAIQuery,
  handleSpatialProximityQuery
} from "./assistant/intent-handlers";
import { lookupPersonByName } from "./assistant/person-name-lookup";
import {
  handleBarriosQuery,
  handleCasesSummary,
  handleCoursesQuery,
  handleLeavesQuery,
  handleMyTasksQuery,
  handleProgramsQuery,
} from "./assistant/module-handlers";
import { needsPersonLookup, pickRoute, routingText, ROUTE_STATUS, WRITING_STATUS } from "@/lib/assistant-routing";

export type { Message, AIResponse, UniversalSearchResult };
export { handleFichaSocialAIQuery };

/** Lo que contesta cuando no encuentra nada. La IA usa la misma frase, así se reconoce. */
export const NO_DATA = "No encontré datos en la app para esa pregunta. Probá con otras palabras o con una de las preguntas de ejemplo.";
const NO_DATA_MARK = "no encontré datos en la app";

const DIRECT_INTENTS = new Set([
  "chart_render",
  "social_count_query",
  "social_letter_filter",
  "social_dni_filter",
  "cases_summary",
  "leaves_query",
  "programs_query",
  "barrios_query",
  "courses_query",
  "tasks_query",
]);

export function isGreetingOrGeneralQuery(queryText: string): boolean {
  const clean = queryText.toLowerCase().trim();
  const greetingsAndGeneral = [
    "hola", "buenas", "que tal", "qué tal", "quien sos", "quién sos", "que podes hacer", "qué podés hacer",
    "que puede hacer", "qué puede hacer", "ayuda", "gracias", "chau", "adios", "adiós", "buen dia", "buen día",
    "buenas tardes", "buenas noches", "saludos", "como estas", "cómo estás", "como andas", "cómo andás"
  ];
  return greetingsAndGeneral.some(g => clean.includes(g));
}

export function handleGreetingQuery(queryText: string): AIResponse {
  const clean = queryText.toLowerCase().trim();
  let answer = "";
  let intent = "greeting";

  if (clean.includes("gracias")) {
    answer = `De nada. Si necesitás algo más, preguntame.`;
    intent = "thanks";
  } else if (clean.includes("chau") || clean.includes("adios") || clean.includes("adiós")) {
    answer = `¡Hasta luego! Acá voy a estar para la próxima.`;
    intent = "goodbye";
  } else {
    answer = [
      "### Asistente de IA",
      "",
      "Te ayudo a consultar los datos de la app. Podés preguntarme por:",
      "",
      "- **Expedientes:** cuántos hay abiertos, urgentes o sin movimiento, por área.",
      "- **Personas, programas y barrios:** cuántas personas hay en cada programa o barrio, o los datos de alguien por DNI o apellido.",
      "- **Recursos Humanos:** quién está de licencia, el personal y los sueldos.",
      "- **Compras y stock:** las órdenes de compra, el presupuesto y los insumos que faltan.",
      "- **Vehículos:** el estado de cada uno, la VTV, el seguro y el combustible.",
      "- **Cursos y tareas:** los cursos abiertos y tus tareas pendientes.",
      "",
      "Por ejemplo: \"¿Qué vehículos tienen la VTV vencida?\".",
    ].join("\n");
  }

  return {
    intent,
    answer,
    dataSummary: {
      hasResults: true,
      sources: [],
      actions: [
        { label: "Ver en Mapa Social", actionType: "NAVIGATE", payload: { path: "/maps" } },
        { label: "Ver Nómina de RRHH", actionType: "NAVIGATE", payload: { path: "/admin/hr" } },
        { label: "Ver agenda", actionType: "NAVIGATE", payload: { path: "/admin/calendar" } },
        { label: "Ver Órdenes de Compra", actionType: "NAVIGATE", payload: { path: "/admin/purchase-orders" } }
      ]
    }
  };
}

export async function performUniversalDBSearch(
  queryText: string,
  history?: { role: "user" | "assistant"; content: string }[]
): Promise<UniversalSearchResult> {
  const resolvedQuery = resolveAnaphoraAndContext(queryText, history);
  const query = resolvedQuery.toLowerCase().trim();
  const synonyms = expandMunicipalSynonyms(query);
  const words = query.split(/\s+/).filter(w => w.length > 2);

  let personWhere: any = words.length > 0 ? {
    AND: words.map(w => ({
      OR: [
        { firstName: { contains: w, mode: 'insensitive' as const } },
        { lastName: { contains: w, mode: 'insensitive' as const } },
        { dni: { contains: w } }
      ]
    }))
  } : undefined;

  let hrWhere: any = words.length > 0 ? {
    AND: words.map(w => ({
      OR: [
        { firstName: { contains: w, mode: 'insensitive' as const } },
        { lastName: { contains: w, mode: 'insensitive' as const } },
        { position: { contains: w, mode: 'insensitive' as const } }
      ]
    }))
  } : undefined;

  let caseWhere: any = words.length > 0 ? {
    AND: words.map(w => ({
      OR: [
        { title: { contains: w, mode: 'insensitive' as const } },
        { description: { contains: w, mode: 'insensitive' as const } }
      ]
    }))
  } : undefined;

  let orderWhere: any = words.length > 0 ? {
    AND: words.map(w => ({
      OR: [
        { number: { contains: w } },
        { providerName: { contains: w, mode: 'insensitive' as const } },
        { description: { contains: w, mode: 'insensitive' as const } }
      ]
    }))
  } : undefined;

  let vehicleWhere: any = words.length > 0 ? {
    AND: words.map(w => ({
      OR: [
        { plate: { contains: w, mode: 'insensitive' as const } },
        { brand: { contains: w, mode: 'insensitive' as const } },
        { model: { contains: w, mode: 'insensitive' as const } }
      ]
    }))
  } : undefined;

  if (synonyms.isSeniors) {
    const lteDate = new Date(new Date().getFullYear() - 60, 0, 1);
    personWhere = { birthDate: { lte: lteDate, not: null } };
  } else if (synonyms.isChildren) {
    const gteDate = new Date(new Date().getFullYear() - 18, 0, 1);
    personWhere = { birthDate: { gte: gteDate, not: null } };
  }

  if (synonyms.isWorkers) {
    hrWhere = { status: "ACTIVO" };
  }

  if (synonyms.isBrokenVehicles) {
    vehicleWhere = { status: { in: ["EN_TALLER", "FUERA_DE_SERVICIO"] } };
  }

  let orderOrderBy: any = undefined;
  if (synonyms.isBigOrders) {
    orderWhere = {};
    orderOrderBy = { amount: "desc" as const };
  }

  const [people, hrRecords, cases, orders, vehicles] = await Promise.all([
    prisma.person.findMany({
      where: personWhere || (synonyms.isSeniors || synonyms.isChildren ? undefined : { id: "none" }),
      take: 5
    }),
    prisma.hRRecord.findMany({
      where: hrWhere || (synonyms.isWorkers ? undefined : { id: "none" }),
      take: 5
    }),
    prisma.case.findMany({
      where: caseWhere || { id: "none" },
      include: { area: true },
      take: 5
    }),
    prisma.purchaseOrder.findMany({
      where: orderWhere || (synonyms.isBigOrders ? undefined : { id: "none" }),
      orderBy: orderOrderBy,
      take: 5
    }),
    prisma.vehicle.findMany({
      where: vehicleWhere || (synonyms.isBrokenVehicles ? undefined : { id: "none" }),
      take: 5
    })
  ]);

  let contextText = "";
  const sources: { type: string; name: string; url?: string }[] = [];
  const actions: { label: string; actionType: string; payload?: any }[] = [];

  if (people.length > 0) {
    contextText += `### REGISTRO DE CIUDADANOS\n`;
    people.forEach(p => {
      contextText += `*   Ciudadano: ${p.lastName}, ${p.firstName} (DNI: ${p.dni}) - Dirección: ${p.address || "N/R"} - Teléfono: ${p.phone || "N/R"}\n`;
      sources.push({ type: "Ciudadano", name: `${p.lastName}, ${p.firstName}`, url: `/people/${p.id}` });
    });
    actions.push({ label: "Ver en Mapa Social", actionType: "NAVIGATE", payload: { path: "/maps" } });
  }

  if (hrRecords.length > 0) {
    contextText += `\n### NÓMINA DE RECURSOS HUMANOS\n`;
    hrRecords.forEach(h => {
      contextText += `*   Agente: ${h.lastName}, ${h.firstName} (DNI: ${h.dni}) - Puesto: ${h.position || "N/R"} - Sueldo: $${Number(h.salary || 0).toLocaleString("es-AR")} ARS - Estado: ${h.status}\n`;
      sources.push({ type: "Recursos Humanos", name: `Agente: ${h.lastName}, ${h.firstName}` });
    });
    actions.push({ label: "Ver Nómina de RRHH", actionType: "NAVIGATE", payload: { path: "/admin/hr" } });
  }

  if (cases.length > 0) {
    contextText += `\n### EXPEDIENTES DE CASOS SOCIALES\n`;
    cases.forEach(c => {
      contextText += `*   Caso: ${c.title} - Estado: ${c.status} - Prioridad: ${c.priority} - Dirección Área: ${c.area.name}\n`;
      sources.push({ type: "Caso Social", name: `Caso: ${c.title}`, url: `/cases/${c.id}` });
    });
    actions.push({ label: "Asignar tarea", actionType: "OPEN_DIALOG", payload: { type: "TASK_ASSIGN" } });
  }

  if (orders.length > 0) {
    contextText += `\n### REGISTRO DE ÓRDENES DE COMPRA\n`;
    orders.forEach(o => {
      contextText += `*   Orden: OC #${o.number} - Proveedor: ${o.providerName || "Desconocido"} - Monto: $${Number(o.amount).toLocaleString("es-AR")} ARS - Estado: ${o.status}\n`;
      sources.push({ type: "Orden de Compra", name: `OC #${o.number}`, url: `/admin/purchase-orders/${o.id}` });
    });
    actions.push({ label: "Ver Órdenes de Compras", actionType: "NAVIGATE", payload: { path: "/admin/purchase-orders" } });
  }

  if (vehicles.length > 0) {
    contextText += `\n### FLOTA DE VEHÍCULOS MUNICIPALES\n`;
    vehicles.forEach(v => {
      contextText += `*   Vehículo: ${v.brand} ${v.model} (Patente: ${v.plate}) - Estado: ${v.status} - Tarjeta Nafta: ${v.fuelCardNumber || "N/R"}\n`;
      sources.push({ type: "Vehículo", name: `${v.brand} ${v.model} (${v.plate})`, url: `/admin/vehicles/${v.id}` });
    });
    actions.push({ label: "Ver Logística", actionType: "NAVIGATE", payload: { path: "/admin/vehicles" } });
  }

  return {
    contextText: contextText.trim(),
    sources,
    actions,
    dataSummary: {
      hasResults: people.length > 0 || hrRecords.length > 0 || cases.length > 0 || orders.length > 0 || vehicles.length > 0,
      counts: {
        people: people.length,
        hrRecords: hrRecords.length,
        cases: cases.length,
        orders: orders.length,
        vehicles: vehicles.length
      }
    }
  };
}

export async function queryAIAssistantStream(
  queryText: string,
  history?: { role: "user" | "assistant"; content: string }[],
  userId?: string,
  onChunk?: (chunk: string) => void,
  options: { role?: string | null; onStatus?: (status: string) => void } = {}
): Promise<AIResponse> {
  const onStatus = options.onStatus;
  if (isGreetingOrGeneralQuery(queryText)) {
    const greetingResponse = handleGreetingQuery(queryText);
    if (onChunk) {
      const words = greetingResponse.answer.split(" ");
      for (let i = 0; i < words.length; i++) {
        onChunk(words[i] + (i === words.length - 1 ? "" : " "));
        await new Promise(resolve => setTimeout(resolve, 15));
      }
    }
    return greetingResponse;
  }

  const resolvedQuery = resolveAnaphoraAndContext(queryText, history);
  const query = resolvedQuery.toLowerCase().trim();

  try {
    let dbResponse: AIResponse;

    const routing = routingText(query);
    let sources: any[] = [];
    let actions: any[] = [];

    // Si la consulta nombra a una persona del padrón, se responde con su ficha antes que con la búsqueda social genérica.
    const personByName = needsPersonLookup(routing) ? await lookupPersonByName(queryText) : null;
    const route = pickRoute(routing, Boolean(personByName));
    onStatus?.(ROUTE_STATUS[route]);
    const user = { id: userId, role: options.role };

    if (route === "chart") {
      dbResponse = await handleChartRequest(query);
    } else if (route === "command") {
      dbResponse = await handleAgentCommandQuery(queryText, userId);
    } else if (route === "documents") {
      dbResponse = await handleDocumentRAGQuery(queryText);
    } else if (route === "leaves") {
      dbResponse = await handleLeavesQuery();
    } else if (route === "tasks") {
      dbResponse = await handleMyTasksQuery(user);
    } else if (route === "courses") {
      dbResponse = await handleCoursesQuery();
    } else if (route === "programs") {
      dbResponse = await handleProgramsQuery();
    } else if (route === "barrios") {
      dbResponse = await handleBarriosQuery(user);
    } else if (route === "hr") {
      dbResponse = await handleHRQuery(query);
    } else if (route === "budget") {
      dbResponse = await handleBudgetQuery(query);
    } else if (route === "vehicles") {
      dbResponse = await handleVehicleQuery(query);
    } else if (route === "agreements") {
      dbResponse = await handleAgreementQuery(query);
    } else if (route === "person" && personByName) {
      dbResponse = personByName;
    } else if (route === "cases") {
      dbResponse = await handleCasesSummary(user);
    } else if (route === "social") {
      dbResponse = await handleSocialQuery(query);
    } else if (route === "crossing") {
      dbResponse = await handleFichaSocialAIQuery(queryText);
    } else if (route === "supplies") {
      dbResponse = await handleSupplyQuery(query);
    } else if (route === "nearby") {
      dbResponse = await handleSpatialProximityQuery(query);
    } else {
      const search = await performUniversalDBSearch(queryText, history);
      sources = search.sources;
      actions = search.actions;

      if (search.contextText !== "") {
        dbResponse = {
          intent: "universal_search",
          answer: search.contextText,
          dataSummary: { ...search.dataSummary, sources, actions }
        };
      } else {
        dbResponse = {
          intent: "fallback",
          answer: NO_DATA,
          dataSummary: { hasResults: false, sources, actions }
        };
      }
    }

    if (dbResponse.dataSummary?.sources) {
      sources = dbResponse.dataSummary.sources;
    }
    if (dbResponse.dataSummary?.actions) {
      actions = dbResponse.dataSummary.actions;
    }

    // Estas respuestas ya salen armadas con los números de la app: van tal cual, sin pasar por la IA.
    if (DIRECT_INTENTS.has(dbResponse.intent)) {
      if (onChunk) {
        onChunk(dbResponse.answer);
      }
      return {
        intent: dbResponse.intent,
        answer: dbResponse.answer,
        dataSummary: { ...dbResponse.dataSummary, sources, actions }
      };
    }

    if (process.env.GEMINI_API_KEY) {
      onStatus?.(WRITING_STATUS);
      try {
        const namesToSanitize: string[] = [];
        const addressesToSanitize: string[] = [];
        if (dbResponse.dataSummary?.sources) {
          dbResponse.dataSummary.sources.forEach((s: any) => {
            if (s.name) namesToSanitize.push(s.name);
          });
        }
        const geminiResult = await callGeminiAnonymized(
          queryText,
          dbResponse.answer,
          { names: namesToSanitize, addresses: addressesToSanitize },
          history
        );
        if (geminiResult.answer) {
          if (
            geminiResult.answer.toLowerCase().includes(NO_DATA_MARK) &&
            dbResponse.answer &&
            !dbResponse.answer.toLowerCase().includes(NO_DATA_MARK)
          ) {
            if (onChunk) onChunk(dbResponse.answer);
            return {
              intent: dbResponse.intent,
              answer: dbResponse.answer,
              dataSummary: { ...dbResponse.dataSummary, sources, actions }
            };
          }
          if (onChunk) {
            onChunk(geminiResult.answer);
          }
          return {
            intent: dbResponse.intent,
            answer: geminiResult.answer,
            dataSummary: { ...dbResponse.dataSummary, sources, actions }
          };
        }
      } catch (geminiErr) {
        console.warn("Gemini API error, fallback local:", geminiErr);
      }
    }

    try {
      const ollamaMessages: Message[] = [
        { role: "system", content: ZERO_HALLUCINATION_SYSTEM_PROMPT }
      ];

      if (history && history.length > 0) {
        history.forEach(msg => {
          ollamaMessages.push({
            role: msg.role === "user" ? "user" : "assistant",
            content: msg.content
          });
        });
      }

      let userPrompt = "";
      if (dbResponse.intent !== "fallback") {
        userPrompt = `[CONTEXTO REAL DE LA BASE DE DATOS MUNICIPAL]:\n${dbResponse.answer}\n\n[PREGUNTA DEL USUARIO]:\n${queryText}\n\nPor favor, responde a la pregunta del usuario utilizando EXCLUSIVAMENTE la información del contexto real anterior. Sigue de forma estricta las REGLAS DE CERO ALUCINACIÓN.`;
      } else {
        userPrompt = `[CONTEXTO REAL DE LA BASE DE DATOS MUNICIPAL]:\nNo hay datos para esta consulta.\n\n[PREGUNTA DEL USUARIO]:\n${queryText}\n\nResponde de forma estricta siguiendo las REGLAS DE CERO ALUCINACIÓN.`;
      }

      ollamaMessages.push({ role: "user", content: userPrompt });

      let ollamaAnswer = "";
      if (onChunk) {
        ollamaAnswer = await callOllamaStream(ollamaMessages, onChunk);
      } else {
        ollamaAnswer = await callOllama(ollamaMessages);
      }

      if (ollamaAnswer && ollamaAnswer.trim() !== "") {
        return {
          intent: dbResponse.intent,
          answer: ollamaAnswer,
          dataSummary: { ...dbResponse.dataSummary, sources, actions }
        };
      }
    } catch (ollamaError) {
      console.warn("Ollama is not available, falling back to static answer:", ollamaError);
      if (onChunk && dbResponse.answer) {
        onChunk(dbResponse.answer);
      }
    }

    return {
      ...dbResponse,
      dataSummary: { ...dbResponse.dataSummary, sources, actions }
    };

  } catch (error: any) {
    console.error("AI Assistant streaming query processing error:", error);
    return {
      intent: "error",
      answer: `Error de sistema: Ocurrió un error al consultar la base de datos municipal: ${error.message || error}.`
    };
  }
}

export async function queryAIAssistant(
  queryText: string,
  history?: { role: "user" | "assistant"; content: string }[],
  userId?: string
): Promise<AIResponse> {
  return await queryAIAssistantStream(queryText, history, userId);
}
