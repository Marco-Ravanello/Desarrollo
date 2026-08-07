import prisma from "@/lib/prisma";
import http from "http";
import fs from "fs/promises";
import path from "path";

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

export async function queryAIAssistant(
  queryText: string,
  history?: { role: "user" | "assistant"; content: string }[],
  userId?: string
): Promise<AIResponse> {
  const query = queryText.toLowerCase().trim();

  try {
    // Check if the user is explicitly requesting a chart or visualization
    const wantsChart = query.includes("gráfico") || query.includes("grafico") || query.includes("chart") || query.includes("dibujar") || query.includes("mostrar gráfico");

    if (wantsChart) {
      return await handleChartRequest(query);
    }

    let dbResponse: AIResponse;

    // 0. AGENT PRODUCTIVITY & COMMANDS (Tasks & Reservations)
    const isCommand = query.includes("tarea") || query.includes("recordatorio") || query.includes("agendar") || query.includes("reservar") || query.includes("reserva");
    // Ensure we don't accidentally intercept mere checks of reservations/tasks unless they contain creation keywords
    const isCreationCommand = isCommand && (query.includes("crear") || query.includes("agend") || query.includes("program") || query.includes("añadir") || query.includes("agregar") || query.includes("hacer"));

    // 0.1 Check for PDF RAG Query
    const isDocRagQuery = query.includes("pdf") || query.includes("documento") || query.includes("archivo") || query.includes("leé") || query.includes("lee") || query.includes("informe") || query.includes("adjunto");

    if (isCreationCommand) {
      dbResponse = await handleAgentCommandQuery(queryText, userId);
    }
    else if (isDocRagQuery) {
      dbResponse = await handleDocumentRAGQuery(queryText);
    }
    // 1. HR & SALARY INTENTS
    else if (
      query.includes("sueldo") ||
      query.includes("salario") ||
      query.includes("rrhh") ||
      query.includes("recursos humanos") ||
      query.includes("personal") ||
      query.includes("empleado") ||
      query.includes("agente") ||
      query.includes("contrato") ||
      query.includes("nómina") ||
      query.includes("nomina")
    ) {
      dbResponse = await handleHRQuery(query);
    }
    // 2. PURCHASE ORDERS & BUDGET INTENTS
    else if (
      query.includes("orden") ||
      query.includes("compras") ||
      query.includes("gasto") ||
      query.includes("presupuesto") ||
      query.includes("comprar") ||
      query.includes("monto") ||
      query.includes("factura")
    ) {
      dbResponse = await handleBudgetQuery(query);
    }
    // 3. VEHICLES & FUEL INTENTS
    else if (
      query.includes("vehiculo") ||
      query.includes("vehículo") ||
      query.includes("auto") ||
      query.includes("camioneta") ||
      query.includes("flota") ||
      query.includes("taller") ||
      query.includes("reserva") ||
      query.includes("combustible") ||
      query.includes("nafta") ||
      query.includes("litro")
    ) {
      dbResponse = await handleVehicleQuery(query);
    }
    // 4. AGREEMENTS (CONVENIOS) INTENTS
    else if (
      query.includes("convenio") ||
      query.includes("acuerdo") ||
      query.includes("parties") ||
      query.includes("institucional")
    ) {
      dbResponse = await handleAgreementQuery(query);
    }
    // 5. CASES & SOCIAL MONITORING INTENTS
    else if (
      query.includes("caso") ||
      query.includes("urgente") ||
      query.includes("critico") ||
      query.includes("crítico") ||
      query.includes("social") ||
      query.includes("familia") ||
      query.includes("persona") ||
      query.includes("ciudadano") ||
      query.includes("deriva") ||
      query.includes("abierto") ||
      query.includes("registro") ||
      query.includes("apellido") ||
      query.includes("nombre") ||
      query.includes("letra") ||
      query.includes("buscar") ||
      query.includes("consultar") ||
      query.includes("acevedo") || // handle user direct name query explicitly
      query.includes("aylen") ||
      query.includes("victoria")
    ) {
      dbResponse = await handleSocialQuery(query);
    }
    // 6. SUPPLY & INVENTORY INTENTS
    else if (
      query.includes("insumo") ||
      query.includes("stock") ||
      query.includes("inventario") ||
      query.includes("deposito") ||
      query.includes("depósito")
    ) {
      dbResponse = await handleSupplyQuery(query);
    }
    // 7. DEFAULT FALLBACK
    else {
      dbResponse = handleGeneralFallback(queryText);
    }

    // Ensure we don't pass massive extracted PDF contexts to Ollama's chat history directly as a system prompt to keep context tight
    // Try to synthesize the response using Ollama
    try {
      const systemPrompt = `Eres el Asistente Inteligente Municipal de la plataforma MuniGestión.
Tu objetivo es ayudar a los funcionarios y directores municipales a consultar información de la base de datos municipal.
Sé profesional, conciso y preciso. Siempre responde en español de Argentina/latinoamericano.
Utiliza un tono administrativo pero servicial. Usa markdown para dar formato a tus respuestas (tablas, listas, negritas) cuando sea apropiado.`;

      const ollamaMessages: Message[] = [
        { role: "system", content: systemPrompt }
      ];

      // Add conversation history if provided
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
        userPrompt = `[CONTEXTO DE LA BASE DE DATOS MUNICIPAL]:
${dbResponse.answer}

[PREGUNTA DEL USUARIO]:
${queryText}

Por favor, responde a la pregunta del usuario utilizando EXCLUSIVAMENTE la información del contexto de la base de datos municipal anterior.
No inventes ni asumas ningún dato, número, nombre, saldo o detalle que no esté presente en el contexto anterior.
Si los datos del contexto indican cero (0) resultados para la búsqueda (por ejemplo, "Se encontraron 0 personas" o "No se encontraron ciudadanos"), debes responder claramente que no hay registros coincidentes en la base de datos municipal para esa consulta. No digas que la información no se registra o no existe en la base de datos, simplemente explica que el padrón actual no tiene coincidencias con el filtro especificado.
Preserva el formato de tablas o listas si ayuda a presentar los datos con claridad y precisión de forma profesional.`;
      } else {
        userPrompt = `[PREGUNTA DEL USUARIO]:
${queryText}

Por favor, responde de forma inteligente y útil. Si la pregunta es sobre el municipio o la aplicación, menciónale qué tipo de consultas sobre Recursos Humanos, Presupuesto, Vehículos, Convenios o Stock puedes responder en tiempo real en MuniGestión.`;
      }

      ollamaMessages.push({ role: "user", content: userPrompt });

      const ollamaAnswer = await callOllama(ollamaMessages);

      if (ollamaAnswer && ollamaAnswer.trim() !== "") {
        return {
          intent: dbResponse.intent,
          answer: ollamaAnswer,
          dataSummary: dbResponse.dataSummary
        };
      }
    } catch (ollamaError) {
      console.warn("Ollama is not available or timed out. Falling back to structured response.", ollamaError);
    }

    return dbResponse;

  } catch (error: any) {
    console.error("AI Assistant query processing error:", error);
    return {
      intent: "error",
      answer: `⚠️ Ocurrió un error al consultar la base de datos municipal: **${error.message || error}**. Por favor, intenta reformular tu pregunta.`
    };
  }
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
        answer: `### 📊 Gráfico: Casos Sociales por Rango de Edad\n\nAquí tienes la visualización de los casos de asistencia social clasificados según el rango de edad de los ciudadanos afectados.`,
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
        answer: `### 📊 Gráfico: Casos por Género del Ciudadano\n\nEste gráfico circular representa la distribución de casos sociales registrados según la identidad de género declarada en el legajo único.`,
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
        answer: `### 📊 Gráfico: Casos por Nivel de Prioridad\n\nAquí tienes la distribución de los expedientes municipales clasificados por nivel de severidad y prioridad asignada.`,
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
        answer: `### 📊 Gráfico: Casos por Estado de Gestión\n\nVisualización interactiva sobre el estado administrativo de resolución de los casos de asistencia municipal.`,
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
      answer: `### 📊 Gráfico: Casos Activos por Dirección Social\n\nAquí tienes la visualización interactiva de la distribución de casos por área municipal. He consolidado los expedientes registrados actualmente en cada departamento.`,
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
      answer: `### 📊 Gráfico: Presupuesto Ejecutado por Dirección ($ ARS)\n\nAquí tienes la representación visual de los fondos ejecutados y aprobados mediante Órdenes de Compra por departamento municipal.`,
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
      answer: `### 📊 Gráfico: Distribución de Modalidades de Contratación\n\nEste gráfico representa la distribución actual del personal activo según su régimen o tipo de contratación laboral.`,
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
      answer: `### 📊 Gráfico: Operatividad de la Flota Logística\n\nRepresentación visual del estado actual de mantenimiento y disponibilidad de todas las unidades de la flota municipal.`,
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
    answer: `### 📊 Solicitud de Gráficos

Puedo dibujarte gráficos interactivos en tiempo real con diferentes variables. Por favor indícame qué tipo de gráfico deseas ver:

*   📊 **"Gráfico de casos por área"** - Muestra la cantidad de expedientes activos por departamento.
*   📊 **"Gráfico de casos por género"** - Muestra los casos según la identidad de género declarada.
*   📊 **"Gráfico de casos por edad"** - Clasifica los casos según el rango de edad.
*   📊 **"Gráfico de casos por prioridad"** - Clasifica por nivel de urgencia o severidad.
*   📊 **"Gráfico de casos por estado"** - Muestra el estado administrativo de resolución.
*   📊 **"Gráfico de gastos"** - Muestra las órdenes de compra ejecutadas por dirección.
*   📊 **"Gráfico de personal"** - Muestra las modalidades de contratación de recursos humanos.
*   📊 **"Gráfico de flota"** - Muestra el estado operativo de los vehículos.`
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
      let answer = `### 👥 Resultados de Búsqueda de Agentes\n\nSe encontraron **${matchedAgents.length}** agentes que coinciden con "*${searchName}*":\n\n`;
      matchedAgents.forEach(a => {
        answer += `*   **${a.firstName} ${a.lastName}** (${a.dni}) - *${a.position || "Sin puesto definido"}*\n`;
        answer += `    *   **Área:** ${a.area?.name || "Sin área"}\n`;
        answer += `    *   **Contrato:** ${a.contractType} - **Sueldo:** $${Number(a.salary || 0).toLocaleString("es-AR")} ARS\n`;
        answer += `    *   **Horario:** ${a.schedule || "No especificado"} - **Estado:** ${a.status}\n\n`;
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
    answer = `### 📊 Presupuesto Mensual de Recursos Humanos

El gasto salarial mensual acumulado para el personal activo y de licencia asciende a **$${totalSalary.toLocaleString("es-AR")} ARS**.

#### 🏢 Distribución Salarial por Dirección Municipal:
| Dirección / Área | Cantidad de Agentes | Presupuesto Mensual | Promedio Salarial |
| :--- | :---: | :---: | :---: |
${salaryByArea.map(a => `| ${a.name} | **${a.count}** | $${a.total.toLocaleString("es-AR")} | $${Math.round(a.count > 0 ? a.total / a.count : 0).toLocaleString("es-AR")} |`).join("\n")}

*Nota: Excluye agentes dados de baja.*`;
  } else {
    answer = `### 👥 Estado de la Nómina y Personal de Recursos Humanos

Actualmente se registran **${totalPersonnel}** legajos en la base de datos municipal.

#### 📊 Estado de Ocupación:
*   🟢 **Activos:** ${activePersonnel} agentes
*   🟡 **En Licencia/Vacaciones:** ${leavePersonnel} agentes
*   🔴 **Dados de Baja:** ${inactivePersonnel} agentes

#### 📄 Modalidades de Contratación (Agentes Totales):
*   💼 **Monotributistas:** ${contracts.MONOTRIBUTISTA}
*   📅 **Mensualizados:** ${contracts.MENSUALIZADO}
*   🏛️ **Planta Permanente:** ${contracts.PLANTA_PERMANENTE}

¿Te gustaría saber los detalles salariales específicos de alguna de estas modalidades?`;
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

      let answer = `### 🛍️ Detalles de la Orden de Compra Nro #${order.number}\n\n`;
      answer += `Se han extraído los datos reales de la base de datos municipal para la **OC #${order.number}**:\n\n`;
      answer += `*   🏢 **Área Solicitante:** ${order.area?.name || "Sin área asignada"}\n`;
      answer += `*   👥 **Proveedor:** ${order.providerName || "Desconocido"} (CUIT: ${order.providerCuit || "No registrado"})\n`;
      answer += `*   📅 **Fecha de Entrega:** ${order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString("es-AR") : "No especificada"}\n`;
      answer += `*   📍 **Lugar de Entrega:** ${order.deliveryPlace || "No especificado"}\n`;
      answer += `*   💳 **Condición de Pago:** ${order.paymentTerms || "No especificada"}\n`;
      answer += `*   📊 **Estado Administrativo:** \`${order.status}\`\n\n`;

      answer += `#### 💰 Estado Financiero y Ejecución:\n`;
      answer += `*   💵 **Monto Total Aprobado:** $${totalAmount.toLocaleString("es-AR")} ARS\n`;
      answer += `*   🟢 **Monto Ejecutado (Entregado/Facturado):** $${executedAmount.toLocaleString("es-AR")} ARS\n`;
      answer += `*   🔵 **Saldo Pendiente (Disponible/No entregado):** $${pendingBalance.toLocaleString("es-AR")} ARS\n\n`;

      answer += `#### 📋 Detalle de Ítems e Insumos en la Orden:\n`;
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
    let answer = `### 📋 Listado Completo de Órdenes de Compra Registradas\n\n`;
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
    answer = `### 💰 Análisis de Ejecución Presupuestaria y Gastos

El gasto total aprobado y ejecutado mediante Órdenes de Compra es de **$${totalSpent.toLocaleString("es-AR")} ARS**.
Adicionalmente, hay solicitudes en espera de aprobación por un total de **$${totalPendingAmount.toLocaleString("es-AR")} ARS**.

#### 🏢 Gastos Aprobados por Dirección Municipal:
| Dirección / Área | Presupuesto Ejecutado |
| :--- | :---: |
${spendByArea.map(a => `| ${a.name} | **$${a.total.toLocaleString("es-AR")}** |`).join("\n")}

#### 🔝 Órdenes de Compra con Mayor Monto Registrado:
${topOrders.map((o, idx) => `${idx + 1}. **OC #${o.number}** - ${o.providerName || "Proveedor desconocido"} (${o.area?.name || "Sin área asignada"}): **$${Number(o.amount).toLocaleString("es-AR")}** - *Estado: ${o.status.replace("_", " ")}*`).join("\n")}`;
  } else {
    answer = `### 🛍️ Gestión de Órdenes de Compra y Proveedores

Se encuentran registradas **${totalOrders} Órdenes de Compra** en el sistema.

#### 📊 Estado de las Órdenes:
*   🟢 **Aprobadas/Cumplidas:** ${approvedOrders.length} (Monto: $${totalSpent.toLocaleString("es-AR")} ARS)
*   🟡 **Pendientes de Aprobación:** ${pendingOrders.length} (Monto: $${totalPendingAmount.toLocaleString("es-AR")} ARS)
*   📝 **Borradores / En Creación:** ${draftOrders.length}

#### 👥 Información de Proveedores:
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

      let answer = `### 🚗 Historial de Combustible de la Unidad Patente "${matchedVehicle.plate}"\n\n`;
      answer += `Se han extraído de la base de datos municipal todos los consumos reales para el vehículo **${matchedVehicle.brand} ${matchedVehicle.model}**:\n\n`;
      answer += `*   🏷️ **Marca y Modelo:** ${matchedVehicle.brand} ${matchedVehicle.model}\n`;
      answer += `*   🪪 **Patente/Dominio:** ${matchedVehicle.plate}\n`;
      answer += `*   ⛽ **Límite Mensual:** $${Number(matchedVehicle.fuelMonthlyLimit || 0).toLocaleString("es-AR")} ARS (Tarjeta: ${matchedVehicle.fuelCardNumber || "No registrada"})\n`;
      answer += `*   📊 **Estado Operativo:** \`${matchedVehicle.status}\`\n\n`;

      answer += `#### 💰 Resumen de Consumo Acumulado:\n`;
      answer += `*   💵 **Gasto Total de Combustible:** $${totalCost.toLocaleString("es-AR")} ARS\n`;
      answer += `*   ⛽ **Total de Litros Cargados:** ${totalLiters.toLocaleString("es-AR")} Lts\n`;
      answer += `*   💳 **Precio Promedio por Litro:** $${totalLiters > 0 ? Math.round(totalCost / totalLiters).toLocaleString("es-AR") : "0"} ARS/Lt\n\n`;

      answer += `#### 📋 Detalle de Cargas de Combustible Registradas (${records.length}):\n`;
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

    let answer = `### ⚠️ Alertas Críticas de Documentación de la Flota Municipal\n\n`;
    answer += `Se encontraron unidades con seguros o verificaciones técnicas (VTV) vencidas:\n\n`;

    if (expiredVtv.length > 0 || expiredInsurance.length > 0) {
      answer += `| Vehículo | Patente | VTV Expiración | Seguro Expiración | Estado |\n`;
      answer += `| :--- | :---: | :---: | :---: | :---: |\n`;
      vehicles.forEach(v => {
        const hasVtvExpired = v.vtvExpiry && new Date(v.vtvExpiry) < new Date();
        const hasInsExpired = v.insuranceExpiry && new Date(v.insuranceExpiry) < new Date();
        if (hasVtvExpired || hasInsExpired) {
          answer += `| **${v.brand} ${v.model}** | ${v.plate} | ${hasVtvExpired ? `❌ Vencido (${new Date(v.vtvExpiry!).toLocaleDateString("es-AR")})` : "🟢 Al día"} | ${hasInsExpired ? `❌ Vencido (${new Date(v.insuranceExpiry!).toLocaleDateString("es-AR")})` : "🟢 Al día"} | \`${v.status}\` |\n`;
        }
      });
    } else {
      answer += `*🟢 ¡Todos los vehículos de la flota tienen la VTV y el seguro al día! No se registran alertas críticas.*`;
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
    answer = `### ⛽ Control de Consumo de Combustible

La flota municipal registra los siguientes consumos consolidados:

*   💰 **Gasto Total de Combustible:** $${totalFuelCost.toLocaleString("es-AR")} ARS
*   ⛽ **Total de Litros Cargados:** ${totalLiters.toLocaleString("es-AR")} Lts
*   💳 **Precio Promedio por Litro:** $${totalLiters > 0 ? Math.round(totalFuelCost / totalLiters).toLocaleString("es-AR") : "0"} ARS/Lt

#### 🚗 Consumo por Vehículo Reciente:
${vehicles.map(v => {
  const recs = fuelRecords.filter(r => r.vehicleId === v.id);
  const totalAm = recs.reduce((s, c) => s + Number(c.amount), 0);
  const lts = recs.reduce((s, c) => s + Number(c.liters), 0);
  return recs.length > 0 ? `*   **${v.brand} ${v.model} (${v.plate}):** $${totalAm.toLocaleString("es-AR")} ARS (${lts} Lts)` : null;
}).filter(Boolean).slice(0, 4).join("\n")}`;
  } else {
    answer = `### 🚗 Estado de la Flota Logística Municipal

El municipio cuenta con **${totalVehicles} vehículos registrados**.

#### 📊 Estado de Ocupación de Unidades:
*   🟢 **Disponibles:** ${available} unidades
*   🔧 **En Taller mecánico:** ${inWorkshop} unidades
*   🔴 **Fuera de Servicio:** ${outOfService} unidades

#### 📅 Agenda de Reservas y Movilidad:
*   🟡 **Reservas pendientes de autorización:** ${pendingReservations} solicitudes
*   🟢 **Viajes autorizados/en curso:** ${activeReservations} reservas activas

#### ⚠️ Alertas de Documentación Crítica:
${vehicles.map(v => {
  const alerts = [];
  if (v.vtvExpiry && new Date(v.vtvExpiry) < new Date()) alerts.push("VTV Vencida");
  if (v.insuranceExpiry && new Date(v.insuranceExpiry) < new Date()) alerts.push("Seguro Vencido");
  return alerts.length > 0 ? `*   **${v.brand} ${v.model} (${v.plate}):** ❌ ${alerts.join(" y ")}` : null;
}).filter(Boolean).join("\n") || "*¡No hay alertas de documentación vencida en la flota! Todo al día.*"}`;
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

  const answer = `### 📜 Registro de Convenios Institucionales y Acuerdos

Actualmente el municipio administra **${total} convenios institucionales**.

#### 📊 Resumen Financiero y Operativo:
*   💼 **Monto total comprometido en convenios:** $${totalAmount.toLocaleString("es-AR")} ARS
*   🟢 **Convenios Vigentes:** ${active}
*   🟡 **Convenios En Revisión:** ${review}
*   🔴 **Convenios Vencidos:** ${expired}

#### 🏢 Distribución por Dirección de Área:
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
        }
      }
    });

    const matchedPerson = people.find(p => p.dni && p.dni.replace(/[^0-9]/g, "") === targetDni);
    if (matchedPerson) {
      let answer = `### 👤 Legajo Social Encontrado: ${matchedPerson.lastName}, ${matchedPerson.firstName}\n\n`;
      answer += `Se han extraído de la base de datos municipal todos los detalles para el DNI **${matchedPerson.dni}**:\n\n`;
      answer += `*   🪪 **DNI / Documento:** ${matchedPerson.dni}\n`;
      answer += `*   📞 **Teléfono:** ${matchedPerson.phone || "No registrado"}\n`;
      answer += `*   📍 **Dirección:** ${matchedPerson.address || "No registrada"}\n`;
      answer += `*   📅 **Fecha de Nacimiento:** ${matchedPerson.birthDate ? new Date(matchedPerson.birthDate).toLocaleDateString("es-AR") : "No registrada"}\n\n`;

      answer += `#### 📁 Casos de Asistencia Social Asociados (${matchedPerson.cases.length}):\n`;
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

    let answer = `### 🔍 Ciudadanos registrados con DNI terminado en "${digit}"\n\n`;
    answer += `Se encontraron **${filteredPeople.length} personas** en la base de datos municipal cuyo DNI termina en **"${digit}"**:\n\n`;

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

    let answer = `### 🔍 Búsqueda de Ciudadanos por Inicial "${targetLetter}"\n\n`;
    answer += `Se encontraron **${totalCount} personas** registrados en la base de datos municipal con **${targetField}** que comienza por la letra **"${targetLetter}"**:\n\n`;

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
          }
        }
      });

      if (matchingPeople.length > 0) {
        let answer = `### 👤 Legajo Social Encontrado: ${matchingPeople[0].lastName}, ${matchingPeople[0].firstName}\n\n`;
        const p = matchingPeople[0];
        answer += `He extraído los detalles reales del legajo social de la base de datos municipal:\n\n`;
        answer += `*   🪪 **DNI / Documento:** ${p.dni}\n`;
        answer += `*   📞 **Teléfono:** ${p.phone || "No registrado"}\n`;
        answer += `*   📍 **Dirección:** ${p.address || "No registrada"}\n`;
        answer += `*   📅 **Fecha de Nacimiento:** ${p.birthDate ? new Date(p.birthDate).toLocaleDateString("es-AR") : "No registrada"}\n\n`;

        answer += `#### 📁 Casos de Asistencia Social Asociados (${p.cases.length}):\n`;
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

        answer += `\n🔗 **[Ver Legajo Completo en Ficha Única](/people/${p.id})**`;

        return {
          intent: "social_person_lookup",
          answer,
          dataSummary: p
        };
      } else {
        return {
          intent: "social_person_not_found",
          answer: `🔍 No logré encontrar a ningún ciudadano con el nombre o apellido que coincida con "*${targetName}*" en el Registro Único de personas.\n\nPor favor, verifica el apellido o introduce el número de DNI para realizar una búsqueda exacta.`
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

  const answer = `### 📁 Panel de Casos y Monitoreo Social

La plataforma registra la siguiente situación de vulnerabilidad y asistencia social:

#### 📊 Métricas Principales:
*   👥 **Total de Ciudadanos Registrados:** ${people.length} personas
*   🏠 **Familias Consolidadas:** ${families.length} grupos familiares
*   📂 **Casos Registrados Totales:** ${totalCases} expedientes

#### 🏷️ Estado y Severidad de Casos Activos:
*   🟢 **Casos Activos:** ${activeCases} (Abiertos o en proceso de asistencia)
*   🔴 **Casos Críticos/Urgentes Activos:** **${criticalCases} casos** (Requieren atención inmediata)
*   🏁 **Casos Resueltos/Cerrados:** ${closedCases} asistencias completas

#### 📌 Severidad de la Demanda Social (Casos Totales):
*   🚨 **Urgente:** ${priorities.URGENTE}
*   ⚠️ **Alta:** ${priorities.ALTA}
*   🔵 **Media:** ${priorities.MEDIA}
*   🟢 **Baja:** ${priorities.BAJA}

#### 🏢 Distribución de Casos por Dirección de Atención:
${areas.map(a => {
  const count = cases.filter(c => c.areaId === a.id).length;
  const active = cases.filter(c => c.areaId === a.id && (c.status === "ABIERTO" || c.status === "EN_PROCESO")).length;
  return count > 0 ? `*   **${a.name}:** ${count} totales (${active} activos)` : null;
}).filter(Boolean).join("\n")}

¿Te gustaría consultar detalles de algún caso crítico en particular?`;

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

  const answer = `### 📦 Inventario de Insumos y Depósito Social

Estado actual del stock de asistencia municipal:

*   🔢 **Artículos Registrados en Depósito:** ${totalItems} ítems
*   🚨 **Sin Stock (Agotado):** **${outOfStock} ítems**
*   ⚠️ **En Stock Mínimo/Alerta:** **${lowStock} ítems**

#### 📋 Solicitudes de Insumos Sociales:
*   ⏳ **Pendientes de Entrega:** ${pendingRequests} solicitudes de áreas sociales

#### ⚠️ Alertas de Artículos Críticos (Agotados o en Stock Mínimo):
${items.map(i => {
  if (i.stock === 0) return `*   ❌ **${i.name}:** AGOTADO (Área: ${i.area?.name || "Global"})`;
  if (i.stock <= i.minStock) return `*   ⚠️ **${i.name}:** Stock bajo (${i.stock} de ${i.minStock} mín.)`;
  return null;
}).filter(Boolean).slice(0, 5).join("\n") || "*¡Depósito totalmente abastecido! No hay alertas de stock bajo.*"}`;

  return {
    intent: "supply_query",
    answer,
    dataSummary: { totalItems, outOfStock, lowStock, pendingRequests }
  };
}

function handleGeneralFallback(queryText: string): AIResponse {
  const answer = `### 🤖 ¡Hola! Soy tu Asistente Inteligente Municipal

No logré identificar con precisión qué conjunto de datos deseas consultar con la frase: *"${queryText}"*.

Puedo realizar análisis profundos de la base de datos municipal en tiempo real. Prueba consultarme sobre alguno de estos temas:

*   👥 **Recursos Humanos:** *"¿Cuál es la nómina de personal activo?", "¿Cuál es el presupuesto de sueldos por área?"*
*   💰 **Presupuestos y Compras:** *"¿Cuánto gastamos en órdenes de compra?", "¿Qué órdenes de compra están pendientes de aprobación?"*
*   🚗 **Flota de Vehículos:** *"¿Cuál es el consumo de nafta?", "¿Qué autos están reservados o en taller?", "¿Hay seguros vencidos?"*
*   📜 **Convenios:** *"Mostrame los convenios vigentes", "¿Cuánto dinero hay invertido en convenios?"*
*   📁 **Casos Sociales:** *"¿Cuántos ciudadanos y familias tenemos registrados?", "¿Cuántos casos urgentes tenemos abiertos?"*
*   📦 **Inventario:** *"¿Qué insumos están sin stock en depósito?"*

Escribe cualquier pregunta relacionada y te traeré los datos precisos al instante.`;

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

  let answer = `### 📂 Análisis de Contenidos de Documentos y PDFs\n\n`;
  answer += `He analizado los documentos digitales cargados para el **${subjectName}**:\n\n`;

  if (pdfDocs.length > 0) {
    let extractedContext = "";
    for (const doc of pdfDocs) {
      const filePath = path.join(process.cwd(), "public", doc.url);
      const text = await extractTextFromPDFFile(filePath);
      if (text.trim().length > 0) {
        extractedContext += `\n--- CONTENIDO DEL ARCHIVO: ${doc.name} ---\n${text.substring(0, 4000)}\n`; // limit text length per file to prevent prompt overflow
        answer += `*   📄 **Archivo analizado con éxito:** \`${doc.name}\` (${doc.url})\n`;
      } else {
        answer += `*   ⚠️ **Archivo vacío o ilegible:** \`${doc.name}\`\n`;
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

function parseNaturalLanguageDate(text: string): Date {
  const clean = text.toLowerCase();
  const now = new Date();

  if (clean.includes("hoy")) {
    return now;
  }
  if (clean.includes("mañana") || clean.includes("manana")) {
    const tomorrow = new Date();
    tomorrow.setDate(now.getDate() + 1);
    return tomorrow;
  }

  // Days of the week
  const days = ["domingo", "lunes", "martes", "miércoles", "miercoles", "jueves", "viernes", "sábado", "sabado"];
  for (let i = 0; i < days.length; i++) {
    if (clean.includes(days[i])) {
      const targetDay = i;
      const currentDay = now.getDay();
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7; // Next week's day

      const targetDayDate = new Date();
      targetDayDate.setDate(now.getDate() + daysToAdd);
      return targetDayDate;
    }
  }

  // Exact date format like DD/MM/YYYY or DD/MM
  const dateMatch = clean.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    const month = parseInt(dateMatch[2]) - 1;
    const year = dateMatch[3] ? parseInt(dateMatch[3]) : now.getFullYear();
    const fullYear = year < 100 ? 2000 + year : year;
    return new Date(fullYear, month, day);
  }

  // Default to 1 day from now
  const defaultDate = new Date();
  defaultDate.setDate(now.getDate() + 1);
  return defaultDate;
}

async function handleAgentCommandQuery(query: string, userId?: string): Promise<AIResponse> {
  const cleanQuery = query.toLowerCase().trim();

  if (!userId) {
    return {
      intent: "command_error",
      answer: "⚠️ No se pudo identificar tu sesión de usuario. Debes iniciar sesión para crear tareas o reservas."
    };
  }

  // 1. Task Creation
  const isTaskCommand = cleanQuery.includes("tarea") || cleanQuery.includes("recordatorio") || cleanQuery.includes("reunion") || cleanQuery.includes("reunión") || cleanQuery.includes("pendiente");
  if (isTaskCommand) {
    // Extract title: strip action keywords
    let title = query
      .replace(/crear tarea/i, "")
      .replace(/crear recordatorio/i, "")
      .replace(/agendar reunion/i, "")
      .replace(/agendar reunión/i, "")
      .replace(/agregar tarea/i, "")
      .replace(/agendar/i, "")
      .replace(/recordatorio/i, "")
      .replace(/tarea/i, "")
      .replace(/para el/i, "")
      .replace(/para mañana/i, "")
      .replace(/para manana/i, "")
      .trim();

    // Capitalize first letter
    title = title.charAt(0).toUpperCase() + title.slice(1);
    if (title.length === 0) title = "Nueva tarea agendada por IA";

    const dueDate = parseNaturalLanguageDate(cleanQuery);

    const task = await prisma.task.create({
      data: {
        userId,
        title,
        dueDate,
        status: "PENDIENTE"
      }
    });

    return {
      intent: "task_created",
      answer: `### ✅ ¡Tarea creada con éxito!
He registrado tu nueva tarea en la base de datos municipal:
*   📌 **Título:** ${task.title}
*   📅 **Fecha de Vencimiento:** ${task.dueDate ? new Date(task.dueDate).toLocaleDateString("es-AR") : "Sin fecha"}
*   👤 **Asignado a:** Tu usuario de MuniGestión

¿Deseas que agende alguna otra cosa en tu calendario unificado?`,
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
        answer: "⚠️ No se encontraron vehículos de la flota disponibles para realizar la reserva."
      };
    }

    const startDate = parseNaturalLanguageDate(cleanQuery);
    const endDate = new Date(startDate);
    endDate.setHours(startDate.getHours() + 4); // default reservation duration: 4 hours

    const reservation = await prisma.vehicleReservation.create({
      data: {
        vehicleId: matchedVehicle.id,
        userId,
        startDate,
        endDate,
        reason: "Reserva logística agendada por IA",
        status: "APROBADA"
      }
    });

    return {
      intent: "reservation_created",
      answer: `### ✅ ¡Reserva de Vehículo realizada con éxito!
He registrado la reserva logística en el calendario unificado del municipio:
*   🚗 **Vehículo:** ${matchedVehicle.brand} ${matchedVehicle.model} (Patente: ${matchedVehicle.plate})
*   📅 **Inicio:** ${reservation.startDate.toLocaleString("es-AR")}
*   📅 **Fin:** ${reservation.endDate.toLocaleString("es-AR")}
*   📝 **Motivo:** ${reservation.reason}

¡Listo para salir a la calle! El vehículo ha quedado bloqueado para tu uso en esas horas.`,
      dataSummary: reservation
    };
  }

  return handleGeneralFallback(query);
}
