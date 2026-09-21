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

export type { Message, AIResponse, UniversalSearchResult };
export { handleFichaSocialAIQuery };

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
    answer = `### Mensaje Recibido\n\nEs un agrado asistirle en la gestión de tareas del municipio. Si requiere realizar consultas adicionales sobre Recursos Humanos, Presupuesto, Vehículos, Casos Sociales o Inventario, quedo a su entera disposición.\n\nAtentamente,\nAsistencia Municipal`;
    intent = "thanks";
  } else if (clean.includes("chau") || clean.includes("adios") || clean.includes("adiós")) {
    answer = `### Sesión Finalizada\n\nAgradecemos su uso del Asistente Inteligente Municipal. Que tenga una excelente jornada de gestión pública. Estaré disponible para futuras consultas administrativas.`;
    intent = "goodbye";
  } else {
    answer = `### Sistema de Asistencia Inteligente Municipal\n\nBienvenido al asistente de consulta municipal. Este canal automatizado facilita el análisis y auditoría de la información administrativa y social de la municipalidad.\n\n#### Módulos y capacidades de consulta habilitados:\n*   **Recursos Humanos (RRHH):** Auditoría de nómina de personal activo, licencias, régimen contractual y cálculo consolidado del gasto salarial mensual por dirección.\n*   **Presupuesto y Compras:** Análisis del estado administrativo de Órdenes de Compra, saldos pendientes, montos de ejecución real y legajos de proveedores.\n*   **Vehículos y Logística:** Monitoreo del consumo de combustible, kilometraje, control de alertas por vencimiento de VTV o pólizas de seguro, y reserva de unidades de flota municipal.\n*   **Convenios Institucionales:** Consulta de convenios vigentes, montos devengados, partes intervinientes y plazos según la dirección solicitante.\n*   **Acción Social:** Consulta integrada del Registro Único de personas, grupos familiares, legajos de vulnerabilidad con filtros por DNI o inicial de apellido, y lectura inteligente de informes PDF adjuntos.\n*   **Control de Insumos (Depósito):** Reportes automáticos sobre stock mínimo, faltantes y alertas de abastecimiento.\n*   **Agenda Unificada:** Programación y asignación de tareas, eventos administrativos y coordinación horaria de recursos municipales.\n\nPor favor, especifique el reporte o la consulta administrativa que desea formular para iniciar el procesamiento de datos.`;
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
        { label: "Ver Agenda Unificada", actionType: "NAVIGATE", payload: { path: "/admin/calendar" } },
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
    actions.push({ label: "Asignar Tarea", actionType: "OPEN_DIALOG", payload: { type: "TASK_ASSIGN" } });
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
  onChunk?: (chunk: string) => void
): Promise<AIResponse> {
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

    const isCommand = query.includes("tarea") || query.includes("recordatorio") || query.includes("agendar") || query.includes("reservar") || query.includes("reserva") || query.includes("evento") || query.includes("reunion") || query.includes("reunión") || query.includes("cita") || query.includes("turno");
    const isCreationCommand = isCommand && (query.includes("crear") || query.includes("agend") || query.includes("program") || query.includes("añadir") || query.includes("agregar") || query.includes("hacer") || query.includes("reserv") || query.includes("pon"));
    const wantsChart = query.includes("gráfico") || query.includes("grafico") || query.includes("chart") || query.includes("dibujar") || query.includes("mostrar gráfico");
    const isDocRagQuery = query.includes("pdf") || query.includes("documento") || query.includes("archivo") || query.includes("leé") || query.includes("lee") || query.includes("informe") || query.includes("adjunto") || query.includes("ordenanza") || query.includes("decreto") || query.includes("pliego") || query.includes("resolución") || query.includes("resolucion");

    let sources: any[] = [];
    let actions: any[] = [];

    if (wantsChart) {
      dbResponse = await handleChartRequest(query);
    } else if (isCreationCommand) {
      dbResponse = await handleAgentCommandQuery(queryText, userId);
    } else if (isDocRagQuery) {
      dbResponse = await handleDocumentRAGQuery(queryText);
    } else if (
      query.includes("sueldo") || query.includes("salario") || query.includes("rrhh") || query.includes("recursos humanos") ||
      query.includes("personal") || query.includes("empleado") || query.includes("agente") || query.includes("contrato") ||
      query.includes("nómina") || query.includes("nomina")
    ) {
      dbResponse = await handleHRQuery(query);
    } else if (
      query.includes("orden") || query.includes("compras") || query.includes("gasto") || query.includes("presupuesto") ||
      query.includes("comprar") || query.includes("monto") || query.includes("factura")
    ) {
      dbResponse = await handleBudgetQuery(query);
    } else if (
      query.includes("vehiculo") || query.includes("vehículo") || query.includes("auto") || query.includes("camioneta") ||
      query.includes("flota") || query.includes("taller") || query.includes("reserva") || query.includes("combustible") ||
      query.includes("nafta") || query.includes("litro")
    ) {
      dbResponse = await handleVehicleQuery(query);
    } else if (
      query.includes("convenio") || query.includes("acuerdo") || query.includes("parties") || query.includes("institucional")
    ) {
      dbResponse = await handleAgreementQuery(query);
    } else if (
      query.includes("caso") || query.includes("urgente") || query.includes("critico") || query.includes("crítico") ||
      query.includes("social") || query.includes("familia") || query.includes("persona") || query.includes("ciudadano") ||
      query.includes("deriva") || query.includes("abierto") || query.includes("registro") || query.includes("apellido") ||
      query.includes("nombre") || query.includes("letra") || query.includes("buscar") || query.includes("consultar") ||
      query.includes("acevedo") || query.includes("aylen") || query.includes("victoria")
    ) {
      dbResponse = await handleSocialQuery(query);
    } else if (
      query.includes("ficha social") || query.includes("ficha 360") || query.includes("cruce de datos") ||
      query.includes("cruce de programas") || query.includes("programas sociales") || query.includes("matriz de cruce")
    ) {
      dbResponse = await handleFichaSocialAIQuery(queryText);
    } else if (
      query.includes("insumo") || query.includes("stock") || query.includes("inventario") ||
      query.includes("deposito") || query.includes("depósito")
    ) {
      dbResponse = await handleSupplyQuery(query);
    } else if (
      query.includes("metro") || query.includes("metros") || query.includes("cerca") ||
      query.includes("radio") || query.includes("proximidad") || query.includes("cuadra") ||
      query.includes("cuadras") || query.includes("distancia")
    ) {
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
          answer: "No se encontraron registros en la base de datos municipal para esta consulta.",
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

    if (
      dbResponse.intent === "chart_render" ||
      dbResponse.intent === "social_count_query" ||
      dbResponse.intent === "social_letter_filter" ||
      dbResponse.intent === "social_dni_filter"
    ) {
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
            geminiResult.answer.toLowerCase().includes("no se encontraron registros") &&
            dbResponse.answer &&
            !dbResponse.answer.toLowerCase().includes("no se encontraron registros")
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
        userPrompt = `[CONTEXTO REAL DE LA BASE DE DATOS MUNICIPAL]:\nNo se encontraron registros en la base de datos municipal para esta consulta.\n\n[PREGUNTA DEL USUARIO]:\n${queryText}\n\nResponde de forma estricta siguiendo las REGLAS DE CERO ALUCINACIÓN.`;
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
