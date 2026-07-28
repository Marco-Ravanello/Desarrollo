import prisma from "@/lib/prisma";

export interface AIResponse {
  answer: string;
  intent: string;
  dataSummary?: any;
}

export async function queryAIAssistant(queryText: string): Promise<AIResponse> {
  const query = queryText.toLowerCase().trim();

  try {
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
      query.includes("abierto")
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

async function handleHRQuery(query: string): Promise<AIResponse> {
  const [records, areas] = await Promise.all([
    prisma.hRRecord.findMany({ include: { area: true } }),
    prisma.area.findMany()
  ]);

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

#### 📊 Estado de Operación de Unidades:
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
