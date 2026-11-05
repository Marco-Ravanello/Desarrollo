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
import { handleFichaSocialAIQuery } from "./assistant/intent-handlers";
import { lookupPersonByName } from "./assistant/person-name-lookup";
import { helpAnswer, runTool, toolStatus, visibleAreaNames } from "./assistant/tools";
import { planWithGemini } from "./assistant/planner";
import { needsPersonLookup, pickRoute, routingText, WRITING_STATUS } from "@/lib/assistant-routing";
import { followUpCall, isFollowUp, isGreeting, parsePreviousCall, routeToToolCall, type ToolCall } from "@/lib/assistant-tools";
import { buildAssistantScope, scopeCanSee, scopedAreaIdWhere, scopedCaseWhere, type AssistantScope } from "@/lib/assistant-scope";

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
  "cases_query",
  "crossing_query",
  "crossing_question",
  "task_proposal",
  "reservation_proposal",
  "reservation_question",
  "reservation_error",
  "command_error",
  "access_denied",
  "person_not_found",
  "greeting",
  "thanks",
  "goodbye",
]);

/**
 * Busca las palabras de la pregunta en toda la app. Con los permisos de quien pregunta: el personal solo para
 * la conducción, y los expedientes y las órdenes de su área si es Director de Área.
 */
export async function performUniversalDBSearch(
  queryText: string,
  history: { role: "user" | "assistant"; content: string }[] | undefined,
  scope: AssistantScope
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

  const none = { id: "none" };
  if (!scopeCanSee(scope, "/admin/hr")) hrWhere = none;
  caseWhere = { AND: [scopedCaseWhere(scope), caseWhere || none] };
  if (!scopeCanSee(scope, "/admin/purchase-orders")) orderWhere = none;
  else if (scope.areaId) orderWhere = { AND: [scopedAreaIdWhere(scope), orderWhere || (synonyms.isBigOrders ? {} : none)] };

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
      where: caseWhere,
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
  options: { role?: string | null; areaId?: string | null; onStatus?: (status: string) => void; previousCall?: unknown } = {}
): Promise<AIResponse> {
  const onStatus = options.onStatus;
  const scope = buildAssistantScope({ id: userId, role: options.role, areaId: options.areaId });
  if (isGreeting(queryText)) {
    const greetingResponse = helpAnswer(queryText, scope);
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
    let dbResponse: AIResponse | null = null;
    let sources: any[] = [];
    let actions: any[] = [];

    // 1. Gemini elige una de las consultas fijas (lib/assistant-tools.ts). 2. Si no hay Gemini o no responde,
    // se elige buscando palabras en la pregunta.
    // La consulta de la respuesta anterior, para seguir la charla ("¿y cuáles?", "¿y de Niñez?").
    const previousCall = parsePreviousCall(options.previousCall);
    let call: ToolCall | null = null;
    if (process.env.GEMINI_API_KEY) {
      onStatus?.("Entendiendo la pregunta…");
      call = await planWithGemini(queryText, history, { areaNames: await visibleAreaNames(scope), previousCall }).catch(() => null);
    }
    if (!call) {
      const routing = routingText(query);
      // Si la consulta nombra a una persona del padrón, se responde con su ficha antes que con la búsqueda social genérica.
      const followsUp = Boolean(previousCall) && isFollowUp(queryText);
      const personByName = !followsUp && needsPersonLookup(routing) && scopeCanSee(scope, "/people") ? await lookupPersonByName(queryText, scope) : null;
      const route = pickRoute(routing, Boolean(personByName));
      call = (!personByName && followUpCall(previousCall, route, routing, queryText)) || routeToToolCall(route, routing, queryText);
      if (route === "person" && personByName) dbResponse = personByName;
    }
    onStatus?.(toolStatus(call));

    if (!dbResponse) {
      dbResponse = await runTool(call, {
        scope,
        query,
        rawQuery: queryText,
        history,
        universalSearch: async (text) => {
          const search = await performUniversalDBSearch(text, history, scope);
          return search.contextText !== ""
            ? { intent: "universal_search", answer: search.contextText, dataSummary: { ...search.dataSummary, sources: search.sources, actions: search.actions } }
            : { intent: "fallback", answer: NO_DATA, dataSummary: { hasResults: false, sources: search.sources, actions: search.actions } };
        },
      });
    }
    dbResponse = { ...dbResponse, dataSummary: { ...dbResponse.dataSummary, via: call.via, call: { tool: call.tool, args: call.args } } };

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
  user: { id?: string; role?: string | null; areaId?: string | null } = {}
): Promise<AIResponse> {
  return await queryAIAssistantStream(queryText, history, user.id, undefined, { role: user.role, areaId: user.areaId });
}
