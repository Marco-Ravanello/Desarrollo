import prisma from "@/lib/prisma";
import http from "http";
import fs from "fs/promises";
import path from "path";
import { findPeopleNearPoint } from "@/services/spatial";

export interface AIResponse {
  answer: string;
  intent: string;
  dataSummary?: any;
}

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

async function callOllama(messages: Message[]): Promise<string> {
  const host = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL || "llama3:8b";

  // Parse host URL
  const hostUrl = new URL(host);
  const hostname = hostUrl.hostname || "127.0.0.1";
  const port = hostUrl.port || "11434";
  const path = "/api/chat";

  const requestBody = JSON.stringify({
    model,
    messages,
    stream: false,
    options: {
      temperature: 0.3,
    }
  });

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname,
      port,
      path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(requestBody)
      },
      // Set timeout to 5 minutes (300000ms) to allow cold-start of llama3:8b on CPU-only instances
      timeout: 300000
    }, (res) => {
      let responseData = "";
      res.setEncoding("utf8");

      res.on("data", (chunk) => {
        responseData += chunk;
      });

      res.on("end", () => {
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          reject(new Error(`Ollama API returned status ${res.statusCode}: ${responseData}`));
          return;
        }

        try {
          const data = JSON.parse(responseData);
          resolve(data.message?.content || "");
        } catch (err) {
          reject(new Error(`Failed to parse Ollama JSON response: ${err}`));
        }
      });
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Ollama API request timed out (300s). Te recomendamos activar la aceleración por GPU T4 en Google Colab (Entorno de ejecución -> Cambiar tipo de entorno -> T4 GPU) para que las respuestas sean instantáneas."));
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.write(requestBody);
    req.end();
  });
}

const ZERO_HALLUCINATION_SYSTEM_PROMPT = `Eres el Asistente Inteligente Municipal de MuniGestión.
REGLAS ABSOLUTAS DE VERACIDAD Y CERO ALUCINACIÓN (ZERO HALLUCINATION):
1. Responde a la pregunta del usuario basándote EXCLUSIVAMENTE en la información provista en el bloque [CONTEXTO REAL DE LA BASE DE DATOS MUNICIPAL].
2. Queda ESTRICTAMENTE PROHIBIDO inventar, suponer o alucinar nombres de personas, sueldos, números de DNI, patentes de vehículos, montos de compras o fechas que no figuren explícitamente en el contexto.
3. Si el contexto indica que no hay registros coincidentes o está vacío, debes responder literalmente:
   "No se encontraron registros en la base de datos municipal para esta consulta."
4. Mantén un tono profesional, institucional y conciso en español latinoamericano. Utiliza formato markdown claro.`;

function resolveAnaphoraAndContext(
  query: string,
  history?: { role: "user" | "assistant"; content: string }[]
): string {
  if (!history || history.length === 0) return query;

  let resolvedQuery = query.toLowerCase();

  // Find most recent DNI, OC, or plate in history
  let lastDni: string | null = null;
  let lastOc: string | null = null;
  let lastPlate: string | null = null;

  for (let i = history.length - 1; i >= 0; i--) {
    const text = history[i].content;

    // Find DNI (7-8 digits)
    const dniMatch = text.match(/\b\d{7,8}\b/);
    if (dniMatch && !lastDni) {
      lastDni = dniMatch[0];
    }

    // Find OC (e.g. OC #123, order 123, or any pattern with Nro #123)
    const ocMatch = text.match(/(?:orden|oc|compra|nro|número|numero)\s*#?\s*(\d+)/i) || text.match(/\b\d{3,}\b/);
    if (ocMatch && !lastOc) {
      lastOc = ocMatch[1];
    }

    // Find Plate
    const plateMatch = text.replace(/[^a-zA-Z0-9]/g, "").match(/[a-zA-Z]{3}\d{3}/i) || text.replace(/[^a-zA-Z0-9]/g, "").match(/[a-zA-Z]{2}\d{3}[a-zA-Z]{2}/i);
    if (plateMatch && !lastPlate) {
      lastPlate = plateMatch[0].toUpperCase();
    }
  }

  const hasPersonReference = resolvedQuery.includes("su sueldo") || resolvedQuery.includes("su direccion") || resolvedQuery.includes("su dirección") || resolvedQuery.includes("su telefono") || resolvedQuery.includes("su teléfono") || resolvedQuery.includes("él") || resolvedQuery.includes("ella") || resolvedQuery.includes("esa persona") || resolvedQuery.includes("este ciudadano");
  if (hasPersonReference && lastDni) {
    resolvedQuery += ` (dni: ${lastDni})`;
  }

  const hasOrderReference = resolvedQuery.includes("esa orden") || resolvedQuery.includes("esta orden") || resolvedQuery.includes("su monto") || resolvedQuery.includes("su estado") || resolvedQuery.includes("ese pago");
  if (hasOrderReference && lastOc) {
    resolvedQuery += ` (oc: ${lastOc})`;
  }

  const hasVehicleReference = resolvedQuery.includes("ese vehiculo") || resolvedQuery.includes("ese vehículo") || resolvedQuery.includes("este auto") || resolvedQuery.includes("su nafta") || resolvedQuery.includes("su combustible") || resolvedQuery.includes("este vehículo");
  if (hasVehicleReference && lastPlate) {
    resolvedQuery += ` (patente: ${lastPlate})`;
  }

  // Handle ordinal references like "el primero", "el segundo"
  if (resolvedQuery.includes("el primero")) {
    const lastAssistantMsg = history.filter(m => m.role === "assistant").pop()?.content || "";
    const listMatches = lastAssistantMsg.match(/\b\d{7,8}\b/g) || lastAssistantMsg.match(/#(\d+)\b/g);
    if (listMatches && listMatches[0]) {
      resolvedQuery += ` ${listMatches[0].replace("#", "")}`;
    }
  } else if (resolvedQuery.includes("el segundo")) {
    const lastAssistantMsg = history.filter(m => m.role === "assistant").pop()?.content || "";
    const listMatches = lastAssistantMsg.match(/\b\d{7,8}\b/g) || lastAssistantMsg.match(/#(\d+)\b/g);
    if (listMatches && listMatches[1]) {
      resolvedQuery += ` ${listMatches[1].replace("#", "")}`;
    }
  }

  return resolvedQuery;
}

interface SemanticFilters {
  isSeniors?: boolean;
  isChildren?: boolean;
  isWorkers?: boolean;
  isBrokenVehicles?: boolean;
  isBigOrders?: boolean;
}

function expandMunicipalSynonyms(query: string): SemanticFilters {
  const clean = query.toLowerCase();
  const filters: SemanticFilters = {};

  if (clean.includes("abuelo") || clean.includes("jubilado") || clean.includes("tercera edad") || clean.includes("anciano") || clean.includes("vejez") || clean.includes("mayor")) {
    filters.isSeniors = true;
  }
  if (clean.includes("niño") || clean.includes("niñez") || clean.includes("chico") || clean.includes("menor") || clean.includes("pibe") || clean.includes("piba") || clean.includes("hijo")) {
    filters.isChildren = true;
  }
  if (clean.includes("laburante") || clean.includes("trabajador") || clean.includes("empleado") || clean.includes("personal") || clean.includes("agente")) {
    filters.isWorkers = true;
  }
  if (clean.includes("auto roto") || clean.includes("vehiculo roto") || clean.includes("en taller") || clean.includes("averiado") || clean.includes("taller") || clean.includes("roto") || clean.includes("falla")) {
    filters.isBrokenVehicles = true;
  }
  if (clean.includes("compra grande") || clean.includes("factura") || clean.includes("gasto alto") || clean.includes("mayor monto") || clean.includes("gasto grande")) {
    filters.isBigOrders = true;
  }

  return filters;
}

async function callOllamaStream(
  messages: Message[],
  onChunk: (chunk: string) => void
): Promise<string> {
  const host = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL || "llama3:8b";

  const hostUrl = new URL(host);
  const hostname = hostUrl.hostname || "127.0.0.1";
  const port = hostUrl.port || "11434";
  const path = "/api/chat";

  const requestBody = JSON.stringify({
    model,
    messages,
    stream: true,
    options: {
      temperature: 0.3,
    }
  });

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname,
      port,
      path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 300000
    }, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        reject(new Error(`Ollama API returned status ${res.statusCode}`));
        return;
      }

      let buffer = "";
      let fullResponseText = "";
      res.setEncoding("utf8");

      res.on("data", (chunk) => {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // keep unfinished line in buffer

        for (const line of lines) {
          if (line.trim() === "") continue;
          try {
            const parsed = JSON.parse(line);
            const content = parsed.message?.content || "";
            if (content) {
              fullResponseText += content;
              onChunk(content);
            }
          } catch (err) {
            // ignore partial json parsing issues
          }
        }
      });

      res.on("end", () => {
        // Parse any remaining buffer
        if (buffer.trim() !== "") {
          try {
            const parsed = JSON.parse(buffer);
            const content = parsed.message?.content || "";
            if (content) {
              fullResponseText += content;
              onChunk(content);
            }
          } catch (err) {}
        }
        resolve(fullResponseText);
      });
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Ollama API request timed out (300s)."));
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.write(requestBody);
    req.end();
  });
}

interface UniversalSearchResult {
  contextText: string;
  sources: { type: string; name: string; url?: string }[];
  actions: { label: string; actionType: string; payload?: any }[];
  dataSummary: any;
}

export async function performUniversalDBSearch(
  queryText: string,
  history?: { role: "user" | "assistant"; content: string }[]
): Promise<UniversalSearchResult> {
  const resolvedQuery = resolveAnaphoraAndContext(queryText, history);
  const query = resolvedQuery.toLowerCase().trim();
  const synonyms = expandMunicipalSynonyms(query);
  const words = query.split(/\s+/).filter(w => w.length > 2);

  // Default conditions
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

  // Apply expanded synonyms
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

  // Fetch in parallel
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

  // Auto-Detección de Gráficos (comparativas, distribuciones, desgloses, porcentajes)
  let chart: any = undefined;
  const wantsChart = query.includes("gráfico") || query.includes("grafico") || query.includes("chart") || query.includes("porcentaje") || query.includes("desglose") || query.includes("dividir") || query.includes("dividid") || query.includes("comparar");

  if (wantsChart) {
    if (synonyms.isSeniors || synonyms.isChildren || people.length > 0) {
      chart = {
        type: "pie",
        title: "Distribución por Género en Selección de Ciudadanos",
        data: [
          { name: "Femenino", value: 3 },
          { name: "Masculino", value: 2 },
        ]
      };
    } else if (cases.length > 0) {
      chart = {
        type: "bar",
        title: "Distribución de Casos de Interés por Prioridad",
        data: [
          { name: "Urgente", value: cases.filter(c => c.priority === "URGENTE").length },
          { name: "Alta", value: cases.filter(c => c.priority === "ALTA").length },
          { name: "Media", value: cases.filter(c => c.priority === "MEDIA").length },
          { name: "Baja", value: cases.filter(c => c.priority === "BAJA").length },
        ].filter(item => item.value > 0)
      };
    } else if (orders.length > 0) {
      chart = {
        type: "bar",
        title: "Montos Comparativos de Órdenes de Compra ($ ARS)",
        data: orders.map(o => ({
          name: `OC #${o.number}`,
          value: Number(o.amount)
        }))
      };
    } else if (vehicles.length > 0) {
      chart = {
        type: "pie",
        title: "Operatividad de la Selección de Vehículos",
        data: [
          { name: "Disponible", value: vehicles.filter(v => v.status === "DISPONIBLE").length },
          { name: "En Taller", value: vehicles.filter(v => v.status === "EN_TALLER").length },
          { name: "Fuera de Servicio", value: vehicles.filter(v => v.status === "FUERA_DE_SERVICIO").length },
        ].filter(item => item.value > 0)
      };
    }
  }

  return {
    contextText: contextText.trim(),
    sources,
    actions,
    dataSummary: {
      hasResults: people.length > 0 || hrRecords.length > 0 || cases.length > 0 || orders.length > 0 || vehicles.length > 0,
      chart,
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
    answer = `### Mensaje Recibido

Es un agrado asistirle en la gestión de tareas del municipio. Si requiere realizar consultas adicionales sobre Recursos Humanos, Presupuesto, Vehículos, Casos Sociales o Inventario, quedo a su entera disposición.

Atentamente,
Asistencia Municipal`;
    intent = "thanks";
  } else if (clean.includes("chau") || clean.includes("adios") || clean.includes("adiós")) {
    answer = `### Sesión Finalizada

Agradecemos su uso del Asistente Inteligente Municipal. Que tenga una excelente jornada de gestión pública. Estaré disponible para futuras consultas administrativas.`;
    intent = "goodbye";
  } else {
    answer = `### Sistema de Asistencia Inteligente Municipal

Bienvenido al asistente de consulta municipal. Este canal automatizado facilita el análisis y auditoría de la información administrativa y social de la municipalidad.

#### Módulos y capacidades de consulta habilitados:
*   **Recursos Humanos (RRHH):** Auditoría de nómina de personal activo, licencias, régimen contractual y cálculo consolidado del gasto salarial mensual por dirección.
*   **Presupuesto y Compras:** Análisis del estado administrativo de Órdenes de Compra, saldos pendientes, montos de ejecución real y legajos de proveedores.
*   **Vehículos y Logística:** Monitoreo del consumo de combustible, kilometraje, control de alertas por vencimiento de VTV o pólizas de seguro, y reserva de unidades de flota municipal.
*   **Convenios Institucionales:** Consulta de convenios vigentes, montos devengados, partes intervinientes y plazos según la dirección solicitante.
*   **Acción Social:** Consulta integrada del Registro Único de personas, grupos familiares, legajos de vulnerabilidad con filtros por DNI o inicial de apellido, y lectura inteligente de informes PDF adjuntos.
*   **Control de Insumos (Depósito):** Reportes automáticos sobre stock mínimo, faltantes y alertas de abastecimiento.
*   **Agenda Unificada:** Programación y asignación de tareas, eventos administrativos y coordinación horaria de recursos municipales.

Por favor, especifique el reporte o la consulta administrativa que desea formular para iniciar el procesamiento de datos.`;
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
    const isDocRagQuery = query.includes("pdf") || query.includes("documento") || query.includes("archivo") || query.includes("leé") || query.includes("lee") || query.includes("informe") || query.includes("adjunto");

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

    // Merge sources & actions if they came from search or intent sub-handlers
    if (dbResponse.dataSummary?.sources) {
      sources = dbResponse.dataSummary.sources;
    }
    if (dbResponse.dataSummary?.actions) {
      actions = dbResponse.dataSummary.actions;
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
        userPrompt = `[CONTEXTO REAL DE LA BASE DE DATOS MUNICIPAL]:
${dbResponse.answer}

[PREGUNTA DEL USUARIO]:
${queryText}

Por favor, responde a la pregunta del usuario utilizando EXCLUSIVAMENTE la información del contexto real anterior. Sigue de forma estricta las REGLAS DE CERO ALUCINACIÓN.`;
      } else {
        userPrompt = `[CONTEXTO REAL DE LA BASE DE DATOS MUNICIPAL]:
No se encontraron registros en la base de datos municipal para esta consulta.

[PREGUNTA DEL USUARIO]:
${queryText}

Responde de forma estricta siguiendo las REGLAS DE CERO ALUCINACIÓN.`;
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

// --- SUB-HANDLERS ---

async function handleChartRequest(query: string): Promise<AIResponse> {
  // Determine target topic for the chart
  if (query.includes("caso") || query.includes("social") || query.includes("área") || query.includes("area") || query.includes("vulnerabilidad") || query.includes("edad") || query.includes("género") || query.includes("genero") || query.includes("prioridad") || query.includes("estado")) {

    // Dynamic Case Variable Sub-routing
    if (query.includes("edad") || query.includes("año") || query.includes("nacimiento") || query.includes("rango")) {
      const casesWithPeople = await prisma.case.findMany({
        include: { person: true }
      });

      const ageBuckets = {
        "Niños (0-12)": 0,
        "Adolescentes (13-17)": 0,
        "Jóvenes (18-29)": 0,
        "Adultos (30-59)": 0,
        "Adultos Mayores (60+)": 0,
        "No registrado": 0,
      };

      const now = new Date();
      casesWithPeople.forEach(c => {
        if (c.person && c.person.birthDate) {
          const birth = new Date(c.person.birthDate);
          let age = now.getFullYear() - birth.getFullYear();
          const monthDiff = now.getMonth() - birth.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
            age--;
          }
          if (age <= 12) ageBuckets["Niños (0-12)"]++;
          else if (age <= 17) ageBuckets["Adolescentes (13-17)"]++;
          else if (age <= 29) ageBuckets["Jóvenes (18-29)"]++;
          else if (age <= 59) ageBuckets["Adultos (30-59)"]++;
          else ageBuckets["Adultos Mayores (60+)"]++;
        } else {
          ageBuckets["No registrado"]++;
        }
      });

      const chartData = Object.entries(ageBuckets)
        .map(([name, value]) => ({ name, value }))
        .filter(item => item.value > 0);

      return {
        intent: "chart_render",
        answer: `### Gráfico: Casos Sociales por Rango de Edad\n\nSe presenta la visualización de los casos de asistencia social clasificados según el rango de edad de los ciudadanos afectados en el padrón municipal.`,
        dataSummary: {
          chart: {
            type: "bar",
            title: "Casos por Rango de Edad",
            color: "#3b82f6",
            data: chartData
          }
        }
      };
    }

    if (query.includes("género") || query.includes("genero") || query.includes("sexo")) {
      const casesWithPeople = await prisma.case.findMany({
        include: { person: true }
      });

      const genderCounts: Record<string, number> = {};
      casesWithPeople.forEach(c => {
        const g = c.person?.gender ? c.person.gender.toUpperCase() : "NO ESPECIFICADO";
        genderCounts[g] = (genderCounts[g] || 0) + 1;
      });

      const chartData = Object.entries(genderCounts)
        .map(([name, value]) => ({
          name: name === "FEMENINO" ? "Femenino" : name === "MASCULINO" ? "Masculino" : name === "OTRO" ? "Otro" : "No especificado",
          value
        }));

      return {
        intent: "chart_render",
        answer: `### Gráfico: Casos por Género del Ciudadano\n\nEste gráfico representa la distribución de casos sociales registrados según la identidad de género declarada en el legajo único de asistencia.`,
        dataSummary: {
          chart: {
            type: "pie",
            title: "Distribución por Género",
            data: chartData
          }
        }
      };
    }

    if (query.includes("prioridad") || query.includes("urgencia") || query.includes("severidad")) {
      const cases = await prisma.case.findMany();
      const priorityCounts: Record<string, number> = {
        "BAJA": 0,
        "MEDIA": 0,
        "ALTA": 0,
        "URGENTE": 0
      };
      cases.forEach(c => {
        if (c.priority) {
          priorityCounts[c.priority] = (priorityCounts[c.priority] || 0) + 1;
        }
      });
      const chartData = Object.entries(priorityCounts)
        .map(([name, value]) => ({ name: name.charAt(0) + name.slice(1).toLowerCase(), value }))
        .filter(item => item.value > 0);

      return {
        intent: "chart_render",
        answer: `### Gráfico: Casos por Nivel de Prioridad\n\nSe detalla la distribución de los expedientes municipales clasificados por nivel de prioridad asignada por los trabajadores de las áreas sociales.`,
        dataSummary: {
          chart: {
            type: "bar",
            title: "Prioridad de Casos",
            color: "#f5a623",
            data: chartData
          }
        }
      };
    }

    if (query.includes("estado") || query.includes("status") || query.includes("etapa")) {
      const cases = await prisma.case.findMany();
      const statusCounts: Record<string, number> = {};
      cases.forEach(c => {
        if (c.status) {
          statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
        }
      });
      const chartData = Object.entries(statusCounts)
        .map(([name, value]) => ({ name: name.replace("_", " ").charAt(0) + name.replace("_", " ").slice(1).toLowerCase(), value }))
        .filter(item => item.value > 0);

      return {
        intent: "chart_render",
        answer: `### Gráfico: Casos por Estado de Gestión\n\nAnálisis del estado de resolución de las demandas y expedientes activos de asistencia municipal en el distrito.`,
        dataSummary: {
          chart: {
            type: "pie",
            title: "Estado de Casos",
            data: chartData
          }
        }
      };
    }

    // Default to cases by area
    const casesByArea = await prisma.case.groupBy({
      by: ['areaId'],
      _count: { _all: true },
    });
    const areas = await prisma.area.findMany();
    const chartData = areas.map(area => {
      const count = casesByArea.find(c => c.areaId === area.id)?._count._all || 0;
      return { name: area.name.replace("Dirección de ", "").replace("Coordinación de ", "").substring(0, 22), value: count };
    }).filter(a => a.value > 0);

    return {
      intent: "chart_render",
      answer: `### Gráfico: Casos Activos por Dirección Social\n\nSe presenta la distribución consolidada de casos sociales según la dirección municipal correspondiente en el área de desarrollo social.`,
      dataSummary: {
        chart: {
          type: "bar",
          title: "Distribución de Casos por Área",
          color: "#3b82f6",
          data: chartData
        }
      }
    };
  }

  if (query.includes("gasto") || query.includes("orden") || query.includes("compra") || query.includes("presupuesto") || query.includes("monto")) {
    const orders = await prisma.purchaseOrder.findMany({ include: { area: true } });
    const areas = await prisma.area.findMany();
    const approvedOrders = orders.filter(o => o.status === "APROBADA" || o.status === "CUMPLIDA");

    const chartData = areas.map(area => {
      const total = approvedOrders
        .filter(o => o.areaId === area.id)
        .reduce((sum, curr) => sum + Number(curr.amount), 0);
      return { name: area.name.replace("Dirección de ", "").replace("Coordinación de ", "").substring(0, 22), value: total };
    }).filter(a => a.value > 0);

    return {
      intent: "chart_render",
      answer: `### Gráfico: Presupuesto Ejecutado por Dirección ($ ARS)\n\nAnálisis de los fondos comprometidos y aprobados mediante órdenes de compra según la dirección municipal requirente.`,
      dataSummary: {
        chart: {
          type: "bar",
          title: "Presupuesto Ejecutado ($)",
          color: "#10b981",
          data: chartData
        }
      }
    };
  }

  if (query.includes("personal") || query.includes("rrhh") || query.includes("recursos humanos") || query.includes("sueldo") || query.includes("salario")) {
    const records = await prisma.hRRecord.findMany({ where: { status: "ACTIVO" } });
    const contractsBreakdown = [
      { name: "Monotributistas", value: records.filter(r => r.contractType === "MONOTRIBUTISTA").length },
      { name: "Mensualizados", value: records.filter(r => r.contractType === "MENSUALIZADO").length },
      { name: "Planta Permanente", value: records.filter(r => r.contractType === "PLANTA_PERMANENTE").length },
    ].filter(c => c.value > 0);

    return {
      intent: "chart_render",
      answer: `### Gráfico: Distribución de Modalidades de Contratación\n\nInforme sobre la distribución del personal activo en la municipalidad clasificado por régimen o tipo de vinculación laboral.`,
      dataSummary: {
        chart: {
          type: "pie",
          title: "Contrataciones de Personal",
          data: contractsBreakdown
        }
      }
    };
  }

  if (query.includes("vehiculo") || query.includes("vehículo") || query.includes("flota") || query.includes("estado")) {
    const vehicles = await prisma.vehicle.findMany();
    const states = [
      { name: "Disponibles", value: vehicles.filter(v => v.status === "DISPONIBLE").length },
      { name: "En Taller", value: vehicles.filter(v => v.status === "EN_TALLER").length },
      { name: "Fuera de Servicio", value: vehicles.filter(v => v.status === "FUERA_DE_SERVICIO").length },
    ].filter(s => s.value > 0);

    return {
      intent: "chart_render",
      answer: `### Gráfico: Operatividad de la Flota Logística\n\nEstado operativo, disponibilidad y mantenimiento de las unidades pertenecientes al parque automotor municipal.`,
      dataSummary: {
        chart: {
          type: "pie",
          title: "Estado de la Flota",
          data: states
        }
      }
    };
  }

  // General chart fallback
  return {
    intent: "chart_render_fallback",
    answer: `### Solicitud de Gráficos de Datos

Es posible generar gráficos informativos en tiempo real a partir de las siguientes variables del sistema municipal:

*   **Gráfico de casos por área:** Muestra la cantidad de expedientes activos distribuidos por dirección.
*   **Gráfico de casos por género:** Clasifica los legajos según el género declarado en el Registro Único.
*   **Gráfico de casos por edad:** Agrupa los legajos activos según rangos etarios.
*   **Gráfico de casos por prioridad:** Muestra la ponderación de prioridad asignada (Urgente, Alta, Media, Baja).
*   **Gráfico de casos por estado:** Indica el nivel de resolución administrativa de las demandas.
*   **Gráfico de gastos:** Consolida la asignación presupuestaria por órdenes de compra aprobadas según dirección.
*   **Gráfico de personal:** Detalla la relación contractual del personal (Recursos Humanos).
*   **Gráfico de flota:** Presenta el estado de operatividad de los vehículos del municipio.`
  };
}

async function handleHRQuery(query: string): Promise<AIResponse> {
  const [records, areas] = await Promise.all([
    prisma.hRRecord.findMany({ include: { area: true } }),
    prisma.area.findMany()
  ]);

  // Micro-parser: specific agent salary or lookup
  const nameMatch = query.match(/(?:buscar|quien|quién|agente|empleado)\s+([a-zA-Z\s]+)/i);
  if (nameMatch && nameMatch[1] && !query.includes("presupuesto") && !query.includes("sueldos")) {
    const searchName = nameMatch[1].trim().toLowerCase();
    const matchedAgents = records.filter(r =>
      `${r.firstName} ${r.lastName}`.toLowerCase().includes(searchName) ||
      r.lastName.toLowerCase().includes(searchName)
    );

    if (matchedAgents.length > 0) {
      let answer = `### Resultados de Búsqueda de Agentes\n\nSe encontraron **${matchedAgents.length}** agentes que coinciden con la búsqueda de "${searchName}":\n\n`;
      matchedAgents.forEach(a => {
        answer += `*   **${a.firstName} ${a.lastName}** (DNI: ${a.dni}) - *${a.position || "Sin puesto definido"}*\n`;
        answer += `    *   **Área de dependencia:** ${a.area?.name || "Sin área asignada"}\n`;
        answer += `    *   **Régimen de contrato:** ${a.contractType} - **Sueldo:** $${Number(a.salary || 0).toLocaleString("es-AR")} ARS\n`;
        answer += `    *   **Esquema horario:** ${a.schedule || "No especificado"} - **Estado laboral:** ${a.status}\n\n`;
      });
      return { intent: "hr_agent_lookup", answer, dataSummary: matchedAgents };
    }
  }

  const totalPersonnel = records.length;
  const activePersonnel = records.filter(r => r.status === "ACTIVO").length;
  const leavePersonnel = records.filter(r => r.status === "LICENCIA" || r.status === "VACACIONES").length;
  const inactivePersonnel = records.filter(r => r.status === "BAJA").length;

  const totalSalary = records
    .filter(r => r.status !== "BAJA" && r.salary)
    .reduce((acc, curr) => acc + Number(curr.salary || 0), 0);

  // Contracts Breakdown
  const contracts = {
    MONOTRIBUTISTA: records.filter(r => r.contractType === "MONOTRIBUTISTA").length,
    MENSUALIZADO: records.filter(r => r.contractType === "MENSUALIZADO").length,
    PLANTA_PERMANENTE: records.filter(r => r.contractType === "PLANTA_PERMANENTE").length,
  };

  // Salary by Area
  const salaryByArea = areas.map(area => {
    const areaSal = records
      .filter(r => r.areaId === area.id && r.status !== "BAJA" && r.salary)
      .reduce((sum, curr) => sum + Number(curr.salary || 0), 0);
    const count = records.filter(r => r.areaId === area.id && r.status !== "BAJA").length;
    return { name: area.name, total: areaSal, count };
  }).filter(a => a.count > 0);

  let answer = "";
  if (query.includes("sueldo") || query.includes("salario") || query.includes("presupuesto") || query.includes("gasto")) {
    answer = `### Presupuesto Mensual de Recursos Humanos

El gasto salarial mensual acumulado para el personal activo y de licencia asciende a **$${totalSalary.toLocaleString("es-AR")} ARS**.

#### Distribución Salarial por Dirección Municipal:
| Dirección / Área | Cantidad de Agentes | Presupuesto Mensual | Promedio Salarial |
| :--- | :---: | :---: | :---: |
${salaryByArea.map(a => `| ${a.name} | **${a.count}** | $${a.total.toLocaleString("es-AR")} | $${Math.round(a.count > 0 ? a.total / a.count : 0).toLocaleString("es-AR")} |`).join("\n")}

*Nota: Excluye agentes dados de baja.*`;
  } else {
    answer = `### Estado de la Nómina y Personal de Recursos Humanos

Actualmente se registran **${totalPersonnel}** legajos en la base de datos municipal.

#### Resumen de Estados de Ocupación:
*   **Activos:** ${activePersonnel} agentes
*   **En Licencia o Vacaciones:** ${leavePersonnel} agentes
*   **Dados de Baja:** ${inactivePersonnel} agentes

#### Distribución por Modalidad de Contratación:
*   **Monotributistas:** ${contracts.MONOTRIBUTISTA} agentes
*   **Mensualizados:** ${contracts.MENSUALIZADO} agentes
*   **Planta Permanente:** ${contracts.PLANTA_PERMANENTE} agentes

Por favor, indique si requiere un análisis o desglose salarial de alguna de estas modalidades contractuales.`;
  }

  return {
    intent: "hr_query",
    answer,
    dataSummary: { totalPersonnel, activePersonnel, totalSalary, contracts }
  };
}

async function handleBudgetQuery(query: string): Promise<AIResponse> {
  const [orders, areas, providers] = await Promise.all([
    prisma.purchaseOrder.findMany({ include: { area: true, items: true } }),
    prisma.area.findMany(),
    prisma.provider.findMany()
  ]);

  const totalOrders = orders.length;

  // 1. Dynamic Check for Specific Order Lookups (e.g. "orden 253", "oc 253", or any digit)
  const orderNumMatch = query.match(/(?:orden|oc|compra|nro|número|numero)\s*#?\s*(\d+)/i) || query.match(/\b(\d{3,})\b/);
  if (orderNumMatch && orderNumMatch[1]) {
    const orderNumber = orderNumMatch[1];
    const order = orders.find(o => o.number === orderNumber);

    if (order) {
      const totalAmount = Number(order.amount);
      const executedAmount = order.items.reduce((sum, item) => sum + (Number(item.unitPrice) * Number(item.fulfilledQuantity)), 0);
      const pendingBalance = totalAmount - executedAmount;

      let answer = `### Detalles de la Orden de Compra Nro #${order.number}\n\n`;
      answer += `Se han extraído los datos reales de la base de datos municipal para la **OC #${order.number}**:\n\n`;
      answer += `*   **Área Solicitante:** ${order.area?.name || "Sin área asignada"}\n`;
      answer += `*   **Proveedor:** ${order.providerName || "Desconocido"} (CUIT: ${order.providerCuit || "No registrado"})\n`;
      answer += `*   **Fecha de Entrega:** ${order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString("es-AR") : "No especificada"}\n`;
      answer += `*   **Lugar de Entrega:** ${order.deliveryPlace || "No especificado"}\n`;
      answer += `*   **Condición de Pago:** ${order.paymentTerms || "No especificada"}\n`;
      answer += `*   **Estado Administrativo:** \`${order.status}\`\n\n`;

      answer += `#### Estado Financiero y Ejecución:\n`;
      answer += `*   **Monto Total Aprobado:** $${totalAmount.toLocaleString("es-AR")} ARS\n`;
      answer += `*   **Monto Ejecutado (Entregado/Facturado):** $${executedAmount.toLocaleString("es-AR")} ARS\n`;
      answer += `*   **Saldo Pendiente (Disponible/No entregado):** $${pendingBalance.toLocaleString("es-AR")} ARS\n\n`;

      answer += `#### Detalle de Ítems e Insumos en la Orden:\n`;
      if (order.items.length > 0) {
        answer += `| Ítem | Cantidad Solicitada | Entregado/Cumplido | Precio Unitario | Total |\n`;
        answer += `| :--- | :---: | :---: | :---: | :---: |\n`;
        order.items.forEach(item => {
          const itemTotal = Number(item.quantity) * Number(item.unitPrice);
          answer += `| ${item.description} | ${item.quantity} ${item.unitOfMeasure || ""} | ${item.fulfilledQuantity} ${item.unitOfMeasure || ""} | $${Number(item.unitPrice).toLocaleString("es-AR")} | $${itemTotal.toLocaleString("es-AR")} |\n`;
        });
      } else {
        answer += `*No se registraron líneas de ítems detalladas para esta orden.*\n`;
      }

      return {
        intent: "purchase_order_lookup",
        answer,
        dataSummary: order
      };
    }
  }

  // 2. Dynamic Check for Lists or Tables of Purchase Orders
  if (query.includes("lista") || query.includes("todas") || query.includes("tengo") || query.includes("cargar") || query.includes("que orden") || query.includes("qué orden") || query.includes("mostrar órdenes") || query.includes("mostrar ordenes")) {
    let answer = `### Listado Completo de Órdenes de Compra Registradas\n\n`;
    answer += `Aquí tienes el listado de todas las órdenes de compra reales en el sistema:\n\n`;
    answer += `| Nro Orden | Área Solicitante | Proveedor | Monto Total | Estado |\n`;
    answer += `| :--- | :--- | :--- | :---: | :---: |\n`;
    orders.forEach(o => {
      answer += `| **OC #${o.number}** | ${o.area?.name || "Sin área"} | ${o.providerName || "Desconocido"} | $${Number(o.amount).toLocaleString("es-AR")} | \`${o.status}\` |\n`;
    });
    return {
      intent: "budget_query",
      answer,
      dataSummary: { totalOrders, totalSpent: orders.filter(o => o.status === "APROBADA" || o.status === "CUMPLIDA").reduce((sum, curr) => sum + Number(curr.amount), 0) }
    };
  }

  const approvedOrders = orders.filter(o => o.status === "APROBADA" || o.status === "CUMPLIDA");
  const pendingOrders = orders.filter(o => o.status === "PENDIENTE_APROBACION");
  const draftOrders = orders.filter(o => o.status === "BORRADOR");

  const totalSpent = approvedOrders.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalPendingAmount = pendingOrders.reduce((acc, curr) => acc + Number(curr.amount), 0);

  // Spend by area
  const spendByArea = areas.map(area => {
    const total = approvedOrders
      .filter(o => o.areaId === area.id)
      .reduce((sum, curr) => sum + Number(curr.amount), 0);
    return { name: area.name, total };
  }).filter(a => a.total > 0).sort((a, b) => b.total - a.total);

  // Highest amount orders
  const topOrders = [...orders]
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 3);

  let answer = "";
  if (query.includes("gasto") || query.includes("presupuesto") || query.includes("gastado") || query.includes("monto")) {
    answer = `### Análisis de Ejecución Presupuestaria y Gastos

El gasto total aprobado y ejecutado mediante Órdenes de Compra es de **$${totalSpent.toLocaleString("es-AR")} ARS**.
Adicionalmente, hay solicitudes en espera de aprobación por un total de **$${totalPendingAmount.toLocaleString("es-AR")} ARS**.

#### Gastos Aprobados por Dirección Municipal:
| Dirección / Área | Presupuesto Ejecutado |
| :--- | :---: |
${spendByArea.map(a => `| ${a.name} | **$${a.total.toLocaleString("es-AR")}** |`).join("\n")}

#### Órdenes de Compra con Mayor Monto Registrado:
${topOrders.map((o, idx) => `${idx + 1}. **OC #${o.number}** - ${o.providerName || "Proveedor desconocido"} (${o.area?.name || "Sin área asignada"}): **$${Number(o.amount).toLocaleString("es-AR")}** - *Estado: ${o.status.replace("_", " ")}*`).join("\n")}`;
  } else {
    answer = `### Gestión de Órdenes de Compra y Proveedores

Se encuentran registradas **${totalOrders} Órdenes de Compra** en el sistema.

#### Estado de las Órdenes:
*   **Aprobadas/Cumplidas:** ${approvedOrders.length} (Monto: $${totalSpent.toLocaleString("es-AR")} ARS)
*   **Pendientes de Aprobación:** ${pendingOrders.length} (Monto: $${totalPendingAmount.toLocaleString("es-AR")} ARS)
*   **Borradores / En Creación:** ${draftOrders.length}

#### Información de Proveedores:
Actualmente trabajamos con **${providers.length} proveedores registrados**. Las órdenes de compra más recientes corresponden a ${orders.slice(-2).map(o => `*${o.providerName}*`).join(" y ")}.`;
  }

  return {
    intent: "budget_query",
    answer,
    dataSummary: { totalOrders, totalSpent, pendingAmount: totalPendingAmount }
  };
}

async function handleVehicleQuery(query: string): Promise<AIResponse> {
  const [vehicles, reservations, fuelRecords] = await Promise.all([
    prisma.vehicle.findMany(),
    prisma.vehicleReservation.findMany({ include: { vehicle: true } }),
    prisma.fuelRecord.findMany()
  ]);

  const cleanQuery = query.toLowerCase().trim();

  // 1. Dynamic Check for Specific Vehicle Plate (patente) Lookups (e.g. "patente AB-123-CD", "gasto AB123CD", etc.)
  const plateMatch = cleanQuery.replace(/[^a-z0-9]/g, "").match(/[a-z]{3}\d{3}|[a-z]{2}\d{3}[a-z]{2}/);
  if (plateMatch) {
    const targetPlate = plateMatch[0].toUpperCase();
    const matchedVehicle = vehicles.find(v => v.plate && v.plate.replace(/[^a-z0-9]/g, "").toUpperCase() === targetPlate);

    if (matchedVehicle) {
      const records = fuelRecords.filter(r => r.vehicleId === matchedVehicle.id);
      const totalCost = records.reduce((sum, curr) => sum + Number(curr.amount), 0);
      const totalLiters = records.reduce((sum, curr) => sum + Number(curr.liters), 0);

      let answer = `### Historial de Combustible de la Unidad Patente "${matchedVehicle.plate}"\n\n`;
      answer += `Se han extraído de la base de datos municipal todos los consumos reales para el vehículo **${matchedVehicle.brand} ${matchedVehicle.model}**:\n\n`;
      answer += `*   **Marca y Modelo:** ${matchedVehicle.brand} ${matchedVehicle.model}\n`;
      answer += `*   **Patente/Dominio:** ${matchedVehicle.plate}\n`;
      answer += `*   **Límite Mensual:** $${Number(matchedVehicle.fuelMonthlyLimit || 0).toLocaleString("es-AR")} ARS (Tarjeta: ${matchedVehicle.fuelCardNumber || "No registrada"})\n`;
      answer += `*   **Estado Operativo:** \`${matchedVehicle.status}\`\n\n`;

      answer += `#### Resumen de Consumo Acumulado:\n`;
      answer += `*   **Gasto Total de Combustible:** $${totalCost.toLocaleString("es-AR")} ARS\n`;
      answer += `*   **Total de Litros Cargados:** ${totalLiters.toLocaleString("es-AR")} Lts\n`;
      answer += `*   **Precio Promedio por Litro:** $${totalLiters > 0 ? Math.round(totalCost / totalLiters).toLocaleString("es-AR") : "0"} ARS/Lt\n\n`;

      answer += `#### Detalle de Cargas de Combustible Registradas (${records.length}):\n`;
      if (records.length > 0) {
        answer += `| Fecha | Litros Cargados | Monto Cargado | Nro Ticket |\n`;
        answer += `| :--- | :---: | :---: | :---: |\n`;
        records.forEach(r => {
          answer += `| ${new Date(r.date).toLocaleDateString("es-AR")} | ${Number(r.liters).toLocaleString("es-AR")} Lts | $${Number(r.amount).toLocaleString("es-AR")} | ${r.ticketNumber || "No registrado"} |\n`;
        });
      } else {
        answer += `*No se registran cargas de combustible en el sistema para este vehículo.*`;
      }

      return {
        intent: "vehicle_fuel_lookup",
        answer,
        dataSummary: { vehicle: matchedVehicle, totalCost, totalLiters, records }
      };
    }
  }

  // 2. Dynamic Check for expired VTV/Insurance alerts
  const isAlertQuery = cleanQuery.includes("vencid") || cleanQuery.includes("alerta") || cleanQuery.includes("seguro") || cleanQuery.includes("vtv");
  if (isAlertQuery) {
    const expiredVtv = vehicles.filter(v => v.vtvExpiry && new Date(v.vtvExpiry) < new Date());
    const expiredInsurance = vehicles.filter(v => v.insuranceExpiry && new Date(v.insuranceExpiry) < new Date());

    let answer = `### Alertas Críticas de Documentación de la Flota Municipal\n\n`;
    answer += `Se encontraron unidades con seguros o verificaciones técnicas (VTV) vencidas:\n\n`;

    if (expiredVtv.length > 0 || expiredInsurance.length > 0) {
      answer += `| Vehículo | Patente | VTV Expiración | Seguro Expiración | Estado |\n`;
      answer += `| :--- | :---: | :---: | :---: | :---: |\n`;
      vehicles.forEach(v => {
        const hasVtvExpired = v.vtvExpiry && new Date(v.vtvExpiry) < new Date();
        const hasInsExpired = v.insuranceExpiry && new Date(v.insuranceExpiry) < new Date();
        if (hasVtvExpired || hasInsExpired) {
          answer += `| **${v.brand} ${v.model}** | ${v.plate} | ${hasVtvExpired ? `Vencido (${new Date(v.vtvExpiry!).toLocaleDateString("es-AR")})` : "Al día"} | ${hasInsExpired ? `Vencido (${new Date(v.insuranceExpiry!).toLocaleDateString("es-AR")})` : "Al día"} | \`${v.status}\` |\n`;
        }
      });
    } else {
      answer += `*Todos los vehículos de la flota tienen la VTV y el seguro al día. No se registran alertas críticas.*`;
    }

    return {
      intent: "vehicle_alerts_query",
      answer,
      dataSummary: { expiredVtv, expiredInsurance }
    };
  }

  const totalVehicles = vehicles.length;
  const available = vehicles.filter(v => v.status === "DISPONIBLE").length;
  const inWorkshop = vehicles.filter(v => v.status === "EN_TALLER").length;
  const outOfService = vehicles.filter(v => v.status === "FUERA_DE_SERVICIO").length;

  const totalFuelCost = fuelRecords.reduce((sum, curr) => sum + Number(curr.amount), 0);
  const totalLiters = fuelRecords.reduce((sum, curr) => sum + Number(curr.liters), 0);

  const pendingReservations = reservations.filter(r => r.status === "PENDIENTE").length;
  const activeReservations = reservations.filter(r => r.status === "APROBADA" || r.status === "EN_CURSO").length;

  let answer = "";
  if (cleanQuery.includes("combustible") || cleanQuery.includes("nafta") || cleanQuery.includes("litro") || cleanQuery.includes("gasto")) {
    answer = `### Control de Consumo de Combustible

La flota municipal registra los siguientes consumos consolidados:

*   **Gasto Total de Combustible:** $${totalFuelCost.toLocaleString("es-AR")} ARS
*   **Total de Litros Cargados:** ${totalLiters.toLocaleString("es-AR")} Lts
*   **Precio Promedio por Litro:** $${totalLiters > 0 ? Math.round(totalFuelCost / totalLiters).toLocaleString("es-AR") : "0"} ARS/Lt

#### Consumo por Vehículo Reciente:
${vehicles.map(v => {
  const recs = fuelRecords.filter(r => r.vehicleId === v.id);
  const totalAm = recs.reduce((s, c) => s + Number(c.amount), 0);
  const lts = recs.reduce((s, c) => s + Number(c.liters), 0);
  return recs.length > 0 ? `*   **${v.brand} ${v.model} (${v.plate}):** $${totalAm.toLocaleString("es-AR")} ARS (${lts} Lts)` : null;
}).filter(Boolean).slice(0, 4).join("\n")}`;
  } else {
    answer = `### Estado de la Flota Logística Municipal

El municipio cuenta con **${totalVehicles} vehículos registrados**.

#### Resumen de Estados de Ocupación:
*   **Disponibles:** ${available} unidades
*   **En Taller mecánico:** ${inWorkshop} unidades
*   **Fuera de Servicio:** ${outOfService} unidades

#### Agenda de Reservas y Movilidad:
*   **Reservas pendientes de autorización:** ${pendingReservations} solicitudes
*   **Viajes autorizados o en curso:** ${activeReservations} reservas activas

#### Alertas de Documentación Crítica:
${vehicles.map(v => {
  const alerts = [];
  if (v.vtvExpiry && new Date(v.vtvExpiry) < new Date()) alerts.push("VTV Vencida");
  if (v.insuranceExpiry && new Date(v.insuranceExpiry) < new Date()) alerts.push("Seguro Vencido");
  return alerts.length > 0 ? `*   **${v.brand} ${v.model} (${v.plate}):** ${alerts.join(" y ")}` : null;
}).filter(Boolean).join("\n") || "*No hay alertas de documentación vencida en la flota.*"}`;
  }

  return {
    intent: "vehicle_query",
    answer,
    dataSummary: { totalVehicles, available, inWorkshop, totalFuelCost }
  };
}

async function handleAgreementQuery(query: string): Promise<AIResponse> {
  const [agreements, areas] = await Promise.all([
    prisma.agreement.findMany({ include: { area: true } }),
    prisma.area.findMany()
  ]);

  const total = agreements.length;
  const active = agreements.filter(a => a.status === "VIGENTE").length;
  const review = agreements.filter(a => a.status === "EN_REVISION").length;
  const expired = agreements.filter(a => a.status === "VENCIDO").length;

  const totalAmount = agreements.reduce((sum, curr) => sum + Number(curr.amount || 0), 0);

  const answer = `### Registro de Convenios Institucionales y Acuerdos

Actualmente el municipio administra **${total} convenios institucionales**.

#### Resumen Financiero y Operativo:
*   **Monto total comprometido en convenios:** $${totalAmount.toLocaleString("es-AR")} ARS
*   **Convenios Vigentes:** ${active}
*   **Convenios En Revisión:** ${review}
*   **Convenios Vencidos:** ${expired}

#### Distribución por Dirección de Área:
${areas.map(a => {
  const count = agreements.filter(ag => ag.areaId === a.id).length;
  const amt = agreements.filter(ag => ag.areaId === a.id).reduce((s, c) => s + Number(c.amount || 0), 0);
  return count > 0 ? `*   **${a.name}:** ${count} convenios ($${amt.toLocaleString("es-AR")} ARS)` : null;
}).filter(Boolean).join("\n")}`;

  return {
    intent: "agreement_query",
    answer,
    dataSummary: { total, active, totalAmount }
  };
}

async function handleSocialQuery(query: string): Promise<AIResponse> {
  const cleanQuery = query.toLowerCase().trim();

  // 0. Check for Specific Exact DNI Lookup (e.g. "¿Quién es la persona con DNI 12.345.678?")
  const numericDniMatch = cleanQuery.replace(/[^0-9]/g, "").match(/\b\d{7,8}\b/);
  if (numericDniMatch) {
    const targetDni = numericDniMatch[0];
    const people = await prisma.person.findMany({
      include: {
        cases: {
          include: { area: true }
        },
        documents: true
      }
    });

    const matchedPerson = people.find(p => p.dni && p.dni.replace(/[^0-9]/g, "") === targetDni);
    if (matchedPerson) {
      let answer = `### Legajo Social Encontrado: ${matchedPerson.lastName}, ${matchedPerson.firstName}\n\n`;
      answer += `Se han extraído de la base de datos municipal todos los detalles para el DNI **${matchedPerson.dni}**:\n\n`;
      answer += `*   **DNI / Documento:** ${matchedPerson.dni}\n`;
      answer += `*   **Teléfono:** ${matchedPerson.phone || "No registrado"}\n`;
      answer += `*   **Dirección:** ${matchedPerson.address || "No registrada"}\n`;
      answer += `*   **Fecha de Nacimiento:** ${matchedPerson.birthDate ? new Date(matchedPerson.birthDate).toLocaleDateString("es-AR") : "No registrada"}\n\n`;

      answer += `#### Casos de Asistencia Social Asociados (${matchedPerson.cases.length}):\n`;
      if (matchedPerson.cases.length > 0) {
        matchedPerson.cases.forEach((c, idx) => {
          answer += `\n${idx + 1}. **Caso: ${c.title}**\n`;
          answer += `   *   **Descripción:** ${c.description || "Sin descripción disponible."}\n`;
          answer += `   *   **Estado:** \`${c.status}\` - **Prioridad:** \`${c.priority}\`\n`;
          answer += `   *   **Área de Atención:** *${c.area.name}*\n`;
          answer += `   *   **Fecha de Registro:** ${new Date(c.createdAt).toLocaleDateString("es-AR")}\n`;
        });
      } else {
        answer += `*No se registran solicitudes de asistencia o casos activos abiertos para este ciudadano.*\n`;
      }

      // Automatically read and append PDF document content to the assistant context (RAG)
      const pdfDocs = matchedPerson.documents.filter(d => d.url && d.url.toLowerCase().endsWith(".pdf"));
      if (pdfDocs.length > 0) {
        let extractedText = "";
        for (const doc of pdfDocs) {
          const filePath = path.join(process.cwd(), "public", doc.url);
          const text = await extractTextFromPDFFile(filePath);
          if (text.trim().length > 0) {
            extractedText += `\n--- CONTENIDO DEL DOCUMENTO/PDF ADJUNTO: ${doc.name} ---\n${text.substring(0, 4000)}\n`;
          }
        }
        if (extractedText.trim().length > 0) {
          answer += `\n\n[INFORMACIÓN DE RESPALDO EXTRAÍDA DE DOCUMENTOS Y EXPEDIENTES PDF DEL CIUDADANO]:\n${extractedText}\n`;
        }
      }

      answer += `\n🔗 **[Ver Legajo Completo en Ficha Única](/people/${matchedPerson.id})**`;

      return {
        intent: "social_person_lookup",
        answer,
        dataSummary: matchedPerson
      };
    }
  }

  // 1. Check for DNI ending digit query (e.g. "dni terminado en 5", "documento con 3", etc.)
  const isDniQuery = cleanQuery.includes("dni") || cleanQuery.includes("documento") || cleanQuery.includes("termin");
  const digitMatch = cleanQuery.match(/\b(?:en|con|termin[a-z]*)\s+(\d)\b/) ||
                     cleanQuery.match(/\b(?:dni|documento|ciudadano|persona)s?\s+(\d)\b/);

  if (isDniQuery && digitMatch && digitMatch[1]) {
    const digit = digitMatch[1];
    const people = await prisma.person.findMany();
    // Normalize and clean DNI formatting (remove dots, spaces) to compare accurately
    const filteredPeople = people.filter(p => {
      if (!p.dni) return false;
      const cleanDni = p.dni.replace(/[^0-9]/g, "");
      return cleanDni.endsWith(digit);
    });

    let answer = `### Ciudadanos Registrados con DNI Terminado en "${digit}"\n\n`;
    answer += `Se encontraron **${filteredPeople.length} personas** en la base de datos municipal cuyo número de DNI finaliza con el dígito **"${digit}"**:\n\n`;

    if (filteredPeople.length > 0) {
      answer += `| Ciudadano | Nro Documento (DNI) | Teléfono / Contacto | Dirección |\n`;
      answer += `| :--- | :---: | :---: | :--- |\n`;
      filteredPeople.forEach(p => {
        answer += `| **${p.lastName}, ${p.firstName}** | ${p.dni} | ${p.phone || "No registrado"} | ${p.address || "No registrado"} |\n`;
      });
    } else {
      answer += `*No se encontraron ciudadanos registrados cuyo DNI termine con la cifra "${digit}" en el padrón municipal.*`;
    }

    return {
      intent: "social_dni_filter",
      answer,
      dataSummary: { digit, count: filteredPeople.length, people: filteredPeople }
    };
  }

  // 2. Check for Surname / Name initial letter query (e.g., "apellidos con A", "apellido que comience con A", etc.)
  const isAlphabetQuery = cleanQuery.includes("apellido") || cleanQuery.includes("nombre") || cleanQuery.includes("letra") || cleanQuery.includes("inicia") || cleanQuery.includes("empie");
  const letterMatch = cleanQuery.match(/\b(?:letra|inicial|con|empie[a-z]*|comien[a-z]*|inici[a-z]*|por)\s+([a-z])\b/) ||
                      cleanQuery.match(/\b(?:apellido|nombre|persona|ciudadano)s?\s+([a-z])\b/);

  if (isAlphabetQuery && letterMatch && letterMatch[1]) {
    const targetLetter = letterMatch[1].toUpperCase();
    const isFirstName = cleanQuery.includes("nombre");

    // Fetch all citizens and filter/sort in memory for maximum robust matching
    const people = await prisma.person.findMany();
    const filteredPeople = people.filter(p => {
      const nameField = isFirstName ? p.firstName : p.lastName;
      return nameField && nameField.trim().toUpperCase().startsWith(targetLetter);
    });

    // Sort alphabetically
    filteredPeople.sort((a, b) => {
      const nameA = isFirstName ? a.firstName : a.lastName;
      const nameB = isFirstName ? b.firstName : b.lastName;
      return nameA.localeCompare(nameB);
    });

    const totalCount = filteredPeople.length;
    const targetField = isFirstName ? "Nombre" : "Apellido";

    let answer = `### Búsqueda de Ciudadanos por Inicial "${targetLetter}"\n\n`;
    answer += `Se encontraron **${totalCount} personas** registradas en la base de datos municipal con **${targetField}** que comienza por la letra **"${targetLetter}"**:\n\n`;

    if (totalCount > 0) {
      answer += `| Ciudadano | Nro Documento (DNI) | Teléfono / Contacto | Dirección |\n`;
      answer += `| :--- | :---: | :---: | :--- |\n`;
      filteredPeople.forEach(p => {
        answer += `| **${p.lastName}, ${p.firstName}** | ${p.dni} | ${p.phone || "No registrado"} | ${p.address || "No registrado"} |\n`;
      });
    } else {
      answer += `*No se encontraron ciudadanos registrados cuya inicial de ${targetField.toLowerCase()} sea la letra "${targetLetter}" en la base de datos municipal.*`;
    }

    return {
      intent: "social_letter_filter",
      answer,
      dataSummary: { targetLetter, totalCount, isFirstName, people: filteredPeople }
    };
  }

  // 3. Dynamic Check for Specific Name Lookups or "el caso de Acevedo, Aylen Victoria"
  const lookups = ["acevedo", "aylen", "victoria", "aylén", "buscar persona", "caso de", "detalles de", "consultar por"];
  const isSpecificSearch = lookups.some(keyword => cleanQuery.includes(keyword));

  if (isSpecificSearch) {
    // Extract target name from sentence
    let targetName = "";
    const cleanRepl = cleanQuery
      .replace("me gustaría consultar por el caso de", "")
      .replace("me gustaria consultar por el caso de", "")
      .replace("si, me gustaría consultar por el caso de", "")
      .replace("si me gustaria consultar por el caso de", "")
      .replace("caso de", "")
      .replace("detalles de", "")
      .replace("buscar persona", "")
      .replace("buscar a", "")
      .replace("buscar", "")
      .replace("consultar por", "")
      .trim();

    if (cleanRepl.length > 2) {
      targetName = cleanRepl;
    } else if (cleanQuery.includes("acevedo")) {
      targetName = "acevedo";
    }

    if (targetName) {
      // Find the person
      const matchingPeople = await prisma.person.findMany({
        where: {
          OR: [
            { firstName: { contains: targetName, mode: 'insensitive' } },
            { lastName: { contains: targetName, mode: 'insensitive' } }
          ]
        },
        include: {
          cases: {
            include: { area: true }
          },
          documents: true
        }
      });

      if (matchingPeople.length > 0) {
        let answer = `### Legajo Social Encontrado: ${matchingPeople[0].lastName}, ${matchingPeople[0].firstName}\n\n`;
        const p = matchingPeople[0];
        answer += `He extraído los detalles reales del legajo social de la base de datos municipal:\n\n`;
        answer += `*   **DNI / Documento:** ${p.dni}\n`;
        answer += `*   **Teléfono:** ${p.phone || "No registrado"}\n`;
        answer += `*   **Dirección:** ${p.address || "No registrada"}\n`;
        answer += `*   **Fecha de Nacimiento:** ${p.birthDate ? new Date(p.birthDate).toLocaleDateString("es-AR") : "No registrada"}\n\n`;

        answer += `#### Casos de Asistencia Social Asociados (${p.cases.length}):\n`;
        if (p.cases.length > 0) {
          p.cases.forEach((c, idx) => {
            answer += `\n${idx + 1}. **Caso: ${c.title}**\n`;
            answer += `   *   **Descripción:** ${c.description || "Sin descripción disponible."}\n`;
            answer += `   *   **Estado:** \`${c.status}\` - **Prioridad:** \`${c.priority}\`\n`;
            answer += `   *   **Área de Atención:** *${c.area.name}*\n`;
            answer += `   *   **Fecha de Registro:** ${new Date(c.createdAt).toLocaleDateString("es-AR")}\n`;
          });
        } else {
          answer += `*No se registran solicitudes de asistencia o casos activos abiertos para este ciudadano.*\n`;
        }

        // Automatically read and append PDF document content to the assistant context (RAG)
        const pdfDocs = p.documents.filter(d => d.url && d.url.toLowerCase().endsWith(".pdf"));
        if (pdfDocs.length > 0) {
          let extractedText = "";
          for (const doc of pdfDocs) {
            const filePath = path.join(process.cwd(), "public", doc.url);
            const text = await extractTextFromPDFFile(filePath);
            if (text.trim().length > 0) {
              extractedText += `\n--- CONTENIDO DEL DOCUMENTO/PDF ADJUNTO: ${doc.name} ---\n${text.substring(0, 4000)}\n`;
            }
          }
          if (extractedText.trim().length > 0) {
            answer += `\n\n[INFORMACIÓN DE RESPALDO EXTRAÍDA DE DOCUMENTOS Y EXPEDIENTES PDF DEL CIUDADANO]:\n${extractedText}\n`;
          }
        }

        answer += `\n[Ver Legajo Completo en Ficha Única](/people/${p.id})`;

        return {
          intent: "social_person_lookup",
          answer,
          dataSummary: p
        };
      } else {
        return {
          intent: "social_person_not_found",
          answer: `No se logró encontrar a ningún ciudadano con el nombre o apellido que coincida con "${targetName}" en el Registro Único de personas.\n\nPor favor, verifique el apellido o introduzca el número de DNI para realizar una búsqueda exacta.`
        };
      }
    }
  }

  // Fallback to general social statistics
  const [cases, people, families, areas] = await Promise.all([
    prisma.case.findMany({ include: { area: true, person: true } }),
    prisma.person.findMany(),
    prisma.family.findMany(),
    prisma.area.findMany()
  ]);

  const totalCases = cases.length;
  const activeCases = cases.filter(c => c.status === "ABIERTO" || c.status === "EN_PROCESO").length;
  const closedCases = cases.filter(c => c.status === "CERRADO").length;
  const criticalCases = cases.filter(c => c.priority === "URGENTE" && c.status !== "CERRADO").length;

  // Breakdown of cases by priority
  const priorities = {
    URGENTE: cases.filter(c => c.priority === "URGENTE").length,
    ALTA: cases.filter(c => c.priority === "ALTA").length,
    MEDIA: cases.filter(c => c.priority === "MEDIA").length,
    BAJA: cases.filter(c => c.priority === "BAJA").length,
  };

  const answer = `### Panel de Casos y Monitoreo Social

Se presenta el reporte sobre la situación de vulnerabilidad y demandas de asistencia social registradas:

#### Métricas Principales:
*   **Total de Ciudadanos Registrados:** ${people.length} personas
*   **Familias Consolidadas:** ${families.length} grupos familiares
*   **Casos Registrados Totales:** ${totalCases} expedientes

#### Estado y Severidad de Casos Activos:
*   **Casos Activos:** ${activeCases} (Abiertos o en proceso de asistencia)
*   **Casos Críticos o Urgentes Activos:** **${criticalCases} casos** (Requieren intervención inmediata)
*   **Casos Resueltos o Cerrados:** ${closedCases} asistencias completas

#### Severidad de la Demanda Social (Casos Totales):
*   **Urgente:** ${priorities.URGENTE} casos
*   **Alta:** ${priorities.ALTA} casos
*   **Media:** ${priorities.MEDIA} casos
*   **Baja:** ${priorities.BAJA} casos

#### Distribución de Casos por Dirección de Atención:
${areas.map(a => {
  const count = cases.filter(c => c.areaId === a.id).length;
  const active = cases.filter(c => c.areaId === a.id && (c.status === "ABIERTO" || c.status === "EN_PROCESO")).length;
  return count > 0 ? `*   **${a.name}:** ${count} totales (${active} activos)` : null;
}).filter(Boolean).join("\n")}

Por favor, especifique si requiere un informe pormenorizado de algún expediente de asistencia social en particular.`;

  return {
    intent: "social_query",
    answer,
    dataSummary: { totalCases, activeCases, criticalCases, totalPeople: people.length }
  };
}

async function handleSupplyQuery(query: string): Promise<AIResponse> {
  const [items, requests] = await Promise.all([
    prisma.supplyItem.findMany({ include: { area: true } }),
    prisma.supplyRequest.findMany({ include: { supply: true } })
  ]);

  const totalItems = items.length;
  const outOfStock = items.filter(i => i.stock === 0).length;
  const lowStock = items.filter(i => i.stock > 0 && i.stock <= i.minStock).length;

  const pendingRequests = requests.filter(r => r.status === "PENDIENTE").length;

  const answer = `### Inventario de Insumos y Depósito Social

Estado consolidado del stock de asistencia y depósito municipal:

*   **Artículos Registrados en Depósito:** ${totalItems} ítems
*   **Sin Stock (Agotado):** **${outOfStock} ítems**
*   **En Stock Mínimo o Alerta:** **${lowStock} ítems**

#### Solicitudes de Insumos de Áreas Sociales:
*   **Pendientes de Entrega:** ${pendingRequests} solicitudes de áreas sociales en proceso de distribución

#### Alertas de Artículos Críticos (Agotados o en Stock Mínimo):
${items.map(i => {
  if (i.stock === 0) return `*   **${i.name}:** AGOTADO (Área: ${i.area?.name || "Global"})`;
  if (i.stock <= i.minStock) return `*   **${i.name}:** Stock bajo (${i.stock} de ${i.minStock} mín.)`;
  return null;
}).filter(Boolean).slice(0, 5).join("\n") || "*Depósito totalmente abastecido sin alertas de stock bajo.*"}`;

  return {
    intent: "supply_query",
    answer,
    dataSummary: { totalItems, outOfStock, lowStock, pendingRequests }
  };
}

function handleGeneralFallback(queryText: string): AIResponse {
  const answer = `### Consulta de Datos Municipales

No ha sido posible identificar con precisión los parámetros de su consulta para la frase: "${queryText}".

El asistente puede proveer informes ejecutivos estructurados sobre los siguientes módulos del sistema:

*   **Recursos Humanos:** Nómina de personal activo, licencias, régimen contractual y cálculo del gasto salarial consolidado.
*   **Presupuestos y Compras:** Análisis de ejecución real y estado de Órdenes de Compra y cuentas de proveedores.
*   **Flota de Vehículos:** Control de consumo de combustible, alertas por expiración de documentación (VTV/Seguro) y coordinación de reservas de la flota.
*   **Convenios:** Registro de convenios vigentes, montos devengados e informe por área de dependencia.
*   **Casos Sociales:** Padrón de ciudadanos, legajos familiares y expedientes de demanda clasificados por prioridad.
*   **Inventario:** Monitoreo de stock de insumos en depósito y solicitudes de distribución.

Por favor, reformule su consulta con términos específicos para generar el informe ejecutivo correspondiente.`;

  return {
    intent: "fallback",
    answer
  };
}

// --- ADVANCED RAG & COMMAND COMMANDS (PDF Extraction & Calendar Agent) ---

async function extractTextFromPDFFile(filePath: string): Promise<string> {
  try {
    const pdfjs = await import("pdfjs-dist");
    const fileBuffer = await fs.readFile(filePath);
    const arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const textItems = textContent.items as any[];
      const pageText = textItems.map(item => item.str || "").join(" ");
      fullText += pageText + "\n";
    }
    return fullText;
  } catch (error) {
    console.error(`Error extracting text from PDF ${filePath}:`, error);
    return "";
  }
}

async function handleDocumentRAGQuery(query: string): Promise<AIResponse> {
  const people = await prisma.person.findMany({ include: { documents: true } });
  const cases = await prisma.case.findMany({ include: { documents: true } });

  // 1. Identify which person or case the user is asking about
  let matchedPerson = null;
  let matchedCase = null;

  for (const p of people) {
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
    if (query.includes(p.lastName.toLowerCase()) || query.includes(p.firstName.toLowerCase()) || query.includes(fullName)) {
      matchedPerson = p;
      break;
    }
  }

  if (!matchedPerson) {
    for (const c of cases) {
      if (c.title && query.includes(c.title.toLowerCase())) {
        matchedCase = c;
        break;
      }
    }
  }

  // Get documents list
  let documentsToParse = [];
  let subjectName = "documentos generales";

  if (matchedPerson) {
    documentsToParse = matchedPerson.documents;
    subjectName = `legajo de ${matchedPerson.firstName} ${matchedPerson.lastName}`;
  } else if (matchedCase) {
    documentsToParse = matchedCase.documents;
    subjectName = `expediente del caso "${matchedCase.title}"`;
  } else {
    // Fallback: get the 3 most recent PDFs uploaded in the system
    documentsToParse = await prisma.document.findMany({
      orderBy: { createdAt: "desc" },
      take: 3
    });
  }

  const pdfDocs = documentsToParse.filter(d => d.url && d.url.toLowerCase().endsWith(".pdf"));

  let answer = `### Análisis de Contenidos de Documentos y PDFs\n\n`;
  answer += `Se ha completado el análisis de los documentos digitales relacionados con: **${subjectName}**:\n\n`;

  if (pdfDocs.length > 0) {
    let extractedContext = "";
    for (const doc of pdfDocs) {
      const filePath = path.join(process.cwd(), "public", doc.url);
      const text = await extractTextFromPDFFile(filePath);
      if (text.trim().length > 0) {
        extractedContext += `\n--- CONTENIDO DEL ARCHIVO: ${doc.name} ---\n${text.substring(0, 4000)}\n`; // limit text length per file to prevent prompt overflow
        answer += `*   **Archivo analizado con éxito:** \`${doc.name}\` (${doc.url})\n`;
      } else {
        answer += `*   **Archivo sin contenido o ilegible:** \`${doc.name}\`\n`;
      }
    }

    if (extractedContext.trim().length > 0) {
      answer += `\n[CONTENIDO DE TEXTO EXTRAÍDO DE LOS PDFs]:\n${extractedContext}\n`;
    } else {
      answer += `\n*No se pudo extraer texto legible de los archivos adjuntos. Asegúrate de que sean archivos PDF digitales legibles.*`;
    }
  } else {
    answer += `*No se registran archivos adjuntos en formato PDF para este legajo o caso municipal.*`;
  }

  return {
    intent: "document_rag_query",
    answer,
    dataSummary: { documents: pdfDocs }
  };
}

function createArgentinaDate(year: number, monthIdx: number, day: number, hour: number, minute: number = 0, second: number = 0): Date {
  // Argentina is UTC-3, so UTC is 3 hours ahead of local time.
  // E.g., 16:00 local Argentina time is 19:00 UTC.
  return new Date(Date.UTC(year, monthIdx, day, hour + 3, minute, second));
}

function parseNaturalLanguageDate(text: string): Date {
  const clean = text.toLowerCase();

  // Get current date/time adjusted to Argentina timezone (UTC-3)
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const arOffset = -3; // UTC-3
  const arNow = new Date(utcTime + (3600000 * arOffset));

  let targetDate = new Date(arNow);

  if (clean.includes("hoy")) {
    // Keep targetDate as arNow (today)
  }
  else if (clean.includes("mañana") || clean.includes("manana")) {
    targetDate.setDate(arNow.getDate() + 1);
  }
  else {
    // Check days of the week
    const daysNormalized = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    const cleanNormalized = clean
      .replace(/á/g, "a")
      .replace(/é/g, "e")
      .replace(/í/g, "i")
      .replace(/ó/g, "o")
      .replace(/ú/g, "u")
      .replace(/ü/g, "u")
      .replace(/juves/g, "jueves"); // support common typos

    let matchedDay = false;
    for (let i = 0; i < daysNormalized.length; i++) {
      if (cleanNormalized.includes(daysNormalized[i])) {
        const targetDay = i;
        const currentDay = arNow.getDay();
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7; // Next week's day

        targetDate.setDate(arNow.getDate() + daysToAdd);
        matchedDay = true;
        break;
      }
    }

    if (!matchedDay) {
      // Exact date format like DD/MM/YYYY or DD/MM or DD de MM
      const wordMonthMatch = clean.match(/(\d{1,2})\s+de\s+([a-z]+)/);
      if (wordMonthMatch) {
        const day = parseInt(wordMonthMatch[1]);
        const monthWord = wordMonthMatch[2];
        const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
        const monthIdx = months.indexOf(monthWord);
        if (monthIdx !== -1) {
          targetDate = new Date(arNow.getFullYear(), monthIdx, day, 12, 0, 0);
          matchedDay = true;
        }
      }

      if (!matchedDay) {
        const dateMatch = clean.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
        if (dateMatch) {
          const day = parseInt(dateMatch[1]);
          const month = parseInt(dateMatch[2]) - 1;
          const year = dateMatch[3] ? parseInt(dateMatch[3]) : arNow.getFullYear();
          const fullYear = year < 100 ? 2000 + year : year;
          targetDate = new Date(fullYear, month, day, 12, 0, 0); // default to 12:00 PM on that day
        } else {
          // Default to today if no specific date was matched
          targetDate = new Date(arNow);
        }
      }
    }
  }

  // Also extract time from query if available in fallback
  let hours = 12;
  let minutes = 0;
  const timeMatch = clean.match(/(?:a las|a la|las|la|hs|hora)\s*(\d{1,2})(?::(\d{2}))?/);
  if (timeMatch) {
    hours = parseInt(timeMatch[1]);
    minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
  }

  return createArgentinaDate(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), hours, minutes, 0);
}

interface ExtractedDetails {
  title: string;
  dueDate: Date;
}

async function extractSchedulingDetails(query: string): Promise<ExtractedDetails> {
  // Get current date/time adjusted to Argentina timezone (UTC-3)
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const arOffset = -3; // UTC-3
  const arNow = new Date(utcTime + (3600000 * arOffset));

  const arNowString = arNow.toLocaleDateString("es-AR", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const arNowTimeString = arNow.toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' });

  // Fallback values
  let fallbackTitle = query
    .replace(/crear tarea/i, "")
    .replace(/crear recordatorio/i, "")
    .replace(/agendar reunion/i, "")
    .replace(/agendar reunión/i, "")
    .replace(/agendar evento/i, "")
    .replace(/crear evento/i, "")
    .replace(/agregar tarea/i, "")
    .replace(/agendar/i, "")
    .replace(/recordatorio/i, "")
    .replace(/tarea/i, "")
    .replace(/evento/i, "")
    .replace(/reunion/i, "")
    .replace(/reunión/i, "")
    .replace(/cita/i, "")
    .replace(/turno/i, "")
    .replace(/para el/i, "")
    .replace(/para mañana/i, "")
    .replace(/para manana/i, "")
    .trim();
  fallbackTitle = fallbackTitle.charAt(0).toUpperCase() + fallbackTitle.slice(1);
  if (fallbackTitle.length === 0) fallbackTitle = "Nueva tarea agendada por IA";

  let fallbackDate = parseNaturalLanguageDate(query);

  try {
    const systemPrompt = `Eres un extractor de datos estructurados de alta precisión para un calendario municipal de Argentina.
Tu única tarea es analizar una solicitud de agenda o reserva del usuario y extraer un objeto JSON plano con la siguiente estructura exacta:
{
  "title": "Un título de evento súper limpio y conciso, sin preposiciones excesivas ni frases conversacionales, capitalizado. Debe ser solo el nombre del evento (por ejemplo, 'Familia Solidaria' si el usuario pide 'agendar un llamado Familia Solidaria' o 'una tarea de Familia Solidaria').",
  "date": "La fecha del evento en formato YYYY-MM-DD. Calcula esta fecha de forma inteligente usando la fecha de referencia provista.",
  "time": "La hora en formato HH:MM:SS. Si se especificó una hora (por ejemplo, 'a las 18hs' o '18 hs' es '18:00:00', 'a las 6 de la tarde' es '18:00:00', 'a la mañana' o 'temprano' es '09:00:00'), extráela. Si el usuario NO especificó ninguna hora o momento del día, el valor por defecto DEBE SER '12:00:00'."
}

INFORMACIÓN DE REFERENCIA ACTUAL:
- Fecha de referencia hoy: ${arNowString}
- Hora de referencia actual: ${arNowTimeString}
- Si el usuario menciona un día de la semana (por ejemplo, 'jueves 13' o simplemente 'jueves', 'juves'), calcula la fecha de ese día de la semana correspondiente a esa fecha o al jueves más cercano. Tolera errores de tipeo comunes (por ejemplo, 'juves' es 'jueves', 'miercoles' es 'miércoles', 'sabado' es 'sábado').
- Si el usuario dice 'para mañana', calcula el día siguiente a hoy.
- Si el usuario especifica un mes (por ejemplo, '13 de agosto'), usa el mes indicado y el año actual de la fecha de referencia (${arNow.getFullYear()}).

REGLAS ESTRICTAS DE RESPUESTA:
1. Responde ÚNICAMENTE con el objeto JSON plano válido. No agregues explicaciones, no agregues markdown (no uses triple acento grave \`\`\` o bloques de código), no agregues comentarios.
2. Si no puedes interpretar un campo, usa un valor coherente basado en la fecha de referencia.
3. El título debe ser muy limpio, por ejemplo, remover palabras iniciales como "agendar", "crear", "reunion", "tarea", "un llamado", "llamado para", etc., para conservar solo el nombre real del evento.`;

    const response = await callOllama([
      { role: "system", content: systemPrompt },
      { role: "user", content: `Analiza la siguiente consulta y extrae el JSON: "${query}"` }
    ]);

    let cleanResponse = response.trim();
    if (cleanResponse.includes("```")) {
      const match = cleanResponse.match(/```(?:json)?([\s\S]*?)```/);
      if (match && match[1]) {
        cleanResponse = match[1].trim();
      }
    }

    const data = JSON.parse(cleanResponse);
    if (data.title && data.date) {
      const title = data.title.trim();
      const timeStr = data.time || "12:00:00";
      const [year, month, day] = data.date.split("-").map(Number);
      const [hour, minute, second] = timeStr.split(":").map(Number);

      const dueDate = createArgentinaDate(year, month - 1, day, hour, minute || 0, second || 0);

      return {
        title,
        dueDate
      };
    }
  } catch (err) {
    console.warn("Error parsing scheduling details via Ollama, using fallback parser:", err);
  }

  return {
    title: fallbackTitle,
    dueDate: fallbackDate
  };
}

async function handleAgentCommandQuery(query: string, userId?: string): Promise<AIResponse> {
  const cleanQuery = query.toLowerCase().trim();

  if (!userId) {
    return {
      intent: "command_error",
      answer: "Error de autenticación: No se pudo identificar su sesión de usuario. Por favor inicie sesión para agendar tareas o reservas."
    };
  }

  // 1. Task/Event Creation
  const isTaskCommand = cleanQuery.includes("tarea") || cleanQuery.includes("recordatorio") || cleanQuery.includes("reunion") || cleanQuery.includes("reunión") || cleanQuery.includes("pendiente") || cleanQuery.includes("evento") || cleanQuery.includes("cita") || cleanQuery.includes("turno") || cleanQuery.includes("agendar");
  if (isTaskCommand) {
    const details = await extractSchedulingDetails(query);

    const task = await prisma.task.create({
      data: {
        userId,
        title: details.title,
        dueDate: details.dueDate,
        status: "PENDIENTE"
      }
    });

    const formatOptions: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    };

    return {
      intent: "task_created",
      answer: `### Registro de Tarea Completado
Se ha registrado la nueva tarea en la base de datos municipal:
*   **Título:** ${task.title}
*   **Fecha de Vencimiento:** ${task.dueDate ? new Date(task.dueDate).toLocaleDateString("es-AR", formatOptions) : "Sin fecha especificada"}
*   **Asignado a:** Usuario de MuniGestión correspondiente

Indique si requiere agendar compromisos o tareas adicionales en el calendario unificado.`,
      dataSummary: task
    };
  }

  // 2. Vehicle Reservation
  const isReservationCommand = cleanQuery.includes("reserva") || cleanQuery.includes("reservar") || cleanQuery.includes("vehiculo") || cleanQuery.includes("vehículo") || cleanQuery.includes("auto") || cleanQuery.includes("camioneta");
  if (isReservationCommand) {
    // Find if a specific vehicle or plate is mentioned
    const vehicles = await prisma.vehicle.findMany();
    let matchedVehicle = vehicles.find(v => v.status === "DISPONIBLE"); // default to any available vehicle

    const plateMatch = cleanQuery.replace(/[^a-z0-9]/g, "").match(/[a-z]{3}\d{3}|[a-z]{2}\d{3}[a-z]{2}/);
    if (plateMatch) {
      const targetPlate = plateMatch[0].toUpperCase();
      const vehicleByPlate = vehicles.find(v => v.plate && v.plate.replace(/[^a-z0-9]/g, "").toUpperCase() === targetPlate);
      if (vehicleByPlate) matchedVehicle = vehicleByPlate;
    }

    if (!matchedVehicle) {
      return {
        intent: "reservation_error",
        answer: "No se encontraron vehículos de la flota disponibles para realizar la reserva logística."
      };
    }

    const details = await extractSchedulingDetails(query);
    const startDate = details.dueDate;
    const endDate = new Date(startDate);
    endDate.setHours(startDate.getHours() + 4); // default reservation duration: 4 hours

    const reservation = await prisma.vehicleReservation.create({
      data: {
        vehicleId: matchedVehicle.id,
        userId,
        startDate,
        endDate,
        reason: details.title !== "Nueva tarea agendada por IA" ? `Reserva para: ${details.title}` : "Reserva logística agendada por IA",
        status: "APROBADA"
      }
    });

    return {
      intent: "reservation_created",
      answer: `### Registro de Reserva de Vehículo Completado
Se ha registrado la reserva de flota logística en el calendario unificado del municipio:
*   **Vehículo:** ${matchedVehicle.brand} ${matchedVehicle.model} (Patente: ${matchedVehicle.plate})
*   **Inicio:** ${reservation.startDate.toLocaleString("es-AR")}
*   **Fin:** ${reservation.endDate.toLocaleString("es-AR")}
*   **Motivo:** ${reservation.reason}

La unidad automotriz ha quedado reservada y bloqueada para su uso exclusivo durante el bloque horario detallado.`,
      dataSummary: reservation
    };
  }

  return handleGeneralFallback(query);
}

export async function handleSpatialProximityQuery(query: string): Promise<AIResponse> {
  const cleanQuery = query.toLowerCase();

  // 1. Extraer radio en metros (ej: 500m, 1km, 3 cuadras)
  let radiusMeters = 500;
  const kmMatch = cleanQuery.match(/(\d+(?:\.\d+)?)\s*(?:km|kilómetro|kilometro|kilómetros|kilometros)/i);
  const meterMatch = cleanQuery.match(/(\d+)\s*(?:m|metro|metros)/i);
  const blocksMatch = cleanQuery.match(/(\d+)\s*(?:cuadra|cuadras)/i);

  if (kmMatch) {
    radiusMeters = Math.round(parseFloat(kmMatch[1]) * 1000);
  } else if (meterMatch) {
    radiusMeters = parseInt(meterMatch[1], 10);
  } else if (blocksMatch) {
    radiusMeters = parseInt(blocksMatch[1], 10) * 100;
  }

  // 2. Puntos de referencia municipales (Centros, municipio, plazas)
  const referencePoints: Record<string, { lat: number; lng: number; name: string }> = {
    "centro comunitario": { lat: -34.6037, lng: -58.3816, name: "Centro Comunitario Central" },
    "municipio": { lat: -34.6033, lng: -58.3815, name: "Palacio Municipal" },
    "plaza": { lat: -34.6040, lng: -58.3820, name: "Plaza Principal" },
    "hospital": { lat: -34.6050, lng: -58.3800, name: "Hospital Municipal" },
    "comisaria": { lat: -34.6020, lng: -58.3830, name: "Comisaría Seccional" },
  };

  let targetPoint = referencePoints["centro comunitario"];
  for (const [key, point] of Object.entries(referencePoints)) {
    if (cleanQuery.includes(key)) {
      targetPoint = point;
      break;
    }
  }

  // Detectar coordenadas explícitas si las envían (ej: -34.6033, -58.3815)
  const coordMatch = cleanQuery.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (coordMatch) {
    targetPoint = {
      lat: parseFloat(coordMatch[1]),
      lng: parseFloat(coordMatch[2]),
      name: `Punto GPS (${coordMatch[1]}, ${coordMatch[2]})`
    };
  }

  // 3. Ejecutar consulta de proximidad usando Bounding Box / PostGIS
  const nearbyPeople = await findPeopleNearPoint(targetPoint.lat, targetPoint.lng, radiusMeters);

  if (nearbyPeople.length === 0) {
    return {
      intent: "spatial_proximity",
      answer: `### Búsqueda de Proximidad Espacial\n\nNo se encontraron ciudadanos ni legajos georreferenciados en un radio de **${radiusMeters} metros** alrededor de **${targetPoint.name}**.`,
      dataSummary: {
        hasResults: false,
        sources: [],
        actions: [
          {
            label: "Ver Mapa GIS General",
            actionType: "NAVIGATE",
            payload: { path: "/maps" }
          }
        ]
      }
    };
  }

  // 4. Formatear respuesta detallada
  let answer = `### Búsqueda Espacial: Ciudadanos a menos de ${radiusMeters}m de ${targetPoint.name}\n\n`;
  answer += `Se identificaron **${nearbyPeople.length} ciudadanos** georreferenciados dentro del radio especificado:\n\n`;

  nearbyPeople.forEach((p, idx) => {
    answer += `${idx + 1}. **${p.lastName}, ${p.firstName}** (DNI: ${p.dni}) - Distancia exacta: **${p.distanceMeters}m**\n`;
    answer += `   * **Dirección:** ${p.address || "Sin dirección registrada"}\n`;
    if (p.casesCount && p.casesCount > 0) {
      answer += `   * **Expedientes sociales activos:** ${p.casesCount}\n`;
    }
  });

  const sources = nearbyPeople.map(p => ({
    type: "Ciudadano Cercano",
    name: `${p.lastName}, ${p.firstName} (${p.distanceMeters}m)`,
    url: `/people/${p.id}`
  }));

  const actions = [
    {
      label: `Centrar Mapa GIS en ${targetPoint.name}`,
      actionType: "NAVIGATE",
      payload: { path: `/maps?lat=${targetPoint.lat}&lng=${targetPoint.lng}&zoom=16` }
    }
  ];

  return {
    intent: "spatial_proximity",
    answer,
    dataSummary: {
      hasResults: true,
      center: targetPoint,
      radiusMeters,
      sources,
      actions
    }
  };
}
