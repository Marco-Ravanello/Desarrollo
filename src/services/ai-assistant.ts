import prisma from "@/lib/prisma";

export interface AIResponse {
  answer: string;
  intent: string;
  dataSummary?: any;
}

export async function queryAIAssistant(queryText: string): Promise<AIResponse> {
  const query = queryText.toLowerCase().trim();

  try {
    // Check if the user is explicitly requesting a chart or visualization
    const wantsChart = query.includes("gráfico") || query.includes("grafico") || query.includes("chart") || query.includes("dibujar") || query.includes("mostrar gráfico");

    if (wantsChart) {
      return await handleChartRequest(query);
    }

    // 1. HR & SALARY INTENTS
    if (
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
      return await handleHRQuery(query);
    }

    // 2. PURCHASE ORDERS & BUDGET INTENTS
    if (
      query.includes("orden") ||
      query.includes("compras") ||
      query.includes("gasto") ||
      query.includes("presupuesto") ||
      query.includes("comprar") ||
      query.includes("monto") ||
      query.includes("factura")
    ) {
      return await handleBudgetQuery(query);
    }

    // 3. VEHICLES & FUEL INTENTS
    if (
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
      return await handleVehicleQuery(query);
    }

    // 4. AGREEMENTS (CONVENIOS) INTENTS
    if (
      query.includes("convenio") ||
      query.includes("acuerdo") ||
      query.includes("parties") ||
      query.includes("institucional")
    ) {
      return await handleAgreementQuery(query);
    }

    // 5. CASES & SOCIAL MONITORING INTENTS
    if (
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
      return await handleSocialQuery(query);
    }

    // 6. SUPPLY & INVENTORY INTENTS
    if (
      query.includes("insumo") ||
      query.includes("stock") ||
      query.includes("inventario") ||
      query.includes("deposito") ||
      query.includes("depósito")
    ) {
      return await handleSupplyQuery(query);
    }

    // 7. DEFAULT FALLBACK
    return handleGeneralFallback(queryText);
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

  const totalVehicles = vehicles.length;
  const available = vehicles.filter(v => v.status === "DISPONIBLE").length;
  const inWorkshop = vehicles.filter(v => v.status === "EN_TALLER").length;
  const outOfService = vehicles.filter(v => v.status === "FUERA_DE_SERVICIO").length;

  const totalFuelCost = fuelRecords.reduce((sum, curr) => sum + Number(curr.amount), 0);
  const totalLiters = fuelRecords.reduce((sum, curr) => sum + Number(curr.liters), 0);

  const pendingReservations = reservations.filter(r => r.status === "PENDIENTE").length;
  const activeReservations = reservations.filter(r => r.status === "APROBADA" || r.status === "EN_CURSO").length;

  let answer = "";
  if (query.includes("combustible") || query.includes("nafta") || query.includes("litro") || query.includes("gasto")) {
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
  // 1. Dynamic Check for Specific Name Lookups or "el caso de Acevedo, Aylen Victoria"
  const lookups = ["acevedo", "aylen", "victoria", "aylén", "buscar persona", "caso de", "detalles de", "consultar por"];
  const isSpecificSearch = lookups.some(keyword => query.includes(keyword));

  if (isSpecificSearch) {
    // Extract target name from sentence
    let targetName = "";
    const cleanQuery = query
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

    if (cleanQuery.length > 2) {
      targetName = cleanQuery;
    } else if (query.includes("acevedo")) {
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

  // 2. Dynamic Check for Surname / Name startsWith filter (e.g., "apellido que comience con A")
  const letterMatch = query.match(/(?:apellido|nombre|letra)\s+(?:que\s+)?(?:comience\s+por\s+la\s+|empiece\s+con\s+la\s+|comienza\s+con\s+|de\s+la\s+)?letra\s+([a-z])/i) ||
                      query.match(/(?:apellido|nombre)\s+(?:que\s+)?(?:comience|empiece)\s+(?:por\s+|con\s+)?([a-z])/i);

  if (letterMatch && letterMatch[1]) {
    const targetLetter = letterMatch[1].trim().toUpperCase();
    const isFirstName = query.includes("nombre");

    // Execute dynamic filtering query to DB
    const filteredPeople = await prisma.person.findMany({
      where: isFirstName ? {
        firstName: { startsWith: targetLetter, mode: 'insensitive' }
      } : {
        lastName: { startsWith: targetLetter, mode: 'insensitive' }
      },
      orderBy: isFirstName ? { firstName: 'asc' } : { lastName: 'asc' }
    });

    const totalCount = filteredPeople.length;
    const targetField = isFirstName ? "Nombre" : "Apellido";

    let answer = `### 🔍 Búsqueda de Ciudadanos por Inicial\n\n`;
    answer += `Se encontraron **${totalCount} personas** en el Registro Único con **${targetField}** que comienza por la letra **"${targetLetter}"**.\n\n`;

    if (totalCount > 0) {
      answer += `| Ciudadano | Nro Documento (DNI) | Teléfono / Contacto | Dirección |\n`;
      answer += `| :--- | :---: | :---: | :--- |\n`;
      filteredPeople.forEach(p => {
        answer += `| **${p.lastName}, ${p.firstName}** | ${p.dni} | ${p.phone || "No registrado"} | ${p.address || "No registrado"} |\n`;
      });
    } else {
      answer += `*No se registraron personas cuya inicial coincida con la búsqueda.*`;
    }

    return {
      intent: "social_letter_filter",
      answer,
      dataSummary: { targetLetter, totalCount, isFirstName }
    };
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
