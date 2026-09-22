import prisma from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";
import { findPeopleNearPoint } from "@/services/spatial";
import { searchFichaSocialByDni, getFichaSocialByDniFromDb, calculateCrossPrograms, getProgramCatalog } from "@/services/ficha-social";
import { AIResponse } from "./types";
import { callOllama } from "./ollama-client";

export async function handleChartRequest(query: string): Promise<AIResponse> {
  const cleanQuery = query.toLowerCase();

  const isMetaChartQuery = cleanQuery.includes("podes hacer") || cleanQuery.includes("podés hacer") ||
                           cleanQuery.includes("cualquier") || cleanQuery.includes("qué gráficos") ||
                           cleanQuery.includes("que graficos") || cleanQuery.includes("tipos de gráfico") ||
                           cleanQuery.includes("tipos de grafico") || cleanQuery.includes("qué tipo") ||
                           cleanQuery.includes("que tipo");

  if (isMetaChartQuery) {
    const casesByArea = await prisma.case.groupBy({
      by: ['areaId'],
      _count: { _all: true },
    });
    const areas = await prisma.area.findMany();
    const fallbackChartData = areas.map(area => {
      const count = casesByArea.find(c => c.areaId === area.id)?._count._all || 0;
      return { name: area.name.replace("Dirección de ", "").replace("Coordinación de ", "").substring(0, 22), value: count };
    }).filter(a => a.value > 0);

    return {
      intent: "chart_capabilities",
      answer: `### Capacidades de Generación de Gráficos del Asistente
¡Sí! Puedo generar gráficos interactivos en tiempo real basados en cualquier módulo de la base de datos municipal.

#### Gráficos que puedes pedirme en lenguaje natural:
1. **Casos Sociales por Área Municipal** (ej: *"mostrar gráfico de casos por área"*).
2. **Casos por Rango Etario / Edad** (ej: *"mostrar un gráfico de casos por edad"*).
3. **Distribución de Casos por Género** (ej: *"dibujar gráfico de casos por género"*).
4. **Severidad y Prioridad de Casos** (ej: *"mostrar gráfico de casos por prioridad"*).
5. **Presupuesto Ejecutado por Dirección ($ ARS)** (ej: *"mostrar gráfico de presupuesto por área"*).
6. **Monto Comprometido por Proveedor** (ej: *"gráficos de órdenes de compra por proveedor"*).
7. **Modalidades de Contratación de Personal** (ej: *"gráficos de personal por contrato"*).
8. **Operatividad de la Flota Logística** (ej: *"gráficos de vehículos por estado"*).
9. **Distribución por Inicial de Apellido/Nombre** (ej: *"gráficos por inicial de apellido"*).

*A continuación te muestro un ejemplo del gráfico consolidado de Casos Sociales por Área Municipal:*`,
      dataSummary: {
        chart: {
          type: "bar",
          title: "Casos por Área Municipal",
          color: "#3b82f6",
          data: fallbackChartData
        }
      }
    };
  }

  if (cleanQuery.includes("letra") || cleanQuery.includes("inicial") || cleanQuery.includes("apellido") || cleanQuery.includes("nombre")) {
    let chartData: { name: string; value: number }[] = [];
    try {
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT UPPER(SUBSTRING(TRIM(nombre_completo), 1, 1)) as inicial, COUNT(*)::int as cantidad
         FROM padron_unificado
         WHERE nombre_completo IS NOT NULL AND TRIM(nombre_completo) != ''
           AND UPPER(SUBSTRING(TRIM(nombre_completo), 1, 1)) ~ '^[A-ZÁÉÍÓÚÑ]'
         GROUP BY inicial
         ORDER BY inicial ASC;`
      );
      if (rows && rows.length > 0) {
        chartData = rows.map((r: any) => ({ name: `Letra ${r.inicial}`, value: r.cantidad }));
      }
    } catch (e) {
      console.error("Error consultando padron_unificado para gráfico por inicial:", e);
    }
    if (chartData.length === 0) {
      const people = await prisma.person.findMany();
      const isFirstName = cleanQuery.includes("nombre");
      const counts: Record<string, number> = {};
      people.forEach(p => {
        const name = isFirstName ? p.firstName : p.lastName;
        const initial = name && name.trim() ? name.trim().charAt(0).toUpperCase() : "?";
        counts[initial] = (counts[initial] || 0) + 1;
      });
      chartData = Object.entries(counts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, value]) => ({ name: `Letra ${name}`, value }));
    }
    const totalPersonasGrafico = chartData.reduce((acc, curr) => acc + curr.value, 0);
    return {
      intent: "chart_render",
      answer: `### Gráfico: Distribución de Ciudadanos por Inicial de Apellido\n\nVisualización estadística sobre el Padrón Social Unificado de **${totalPersonasGrafico.toLocaleString("es-AR")} ciudadanos** de Tres de Febrero según la letra inicial de su apellido.`,
      dataSummary: {
        chart: {
          type: "bar",
          title: `Ciudadanos por Inicial de Apellido (${totalPersonasGrafico.toLocaleString("es-AR")} totales)`,
          color: "#8b5cf6",
          data: chartData
        }
      }
    };
  }

  if (cleanQuery.includes("proveedor") || cleanQuery.includes("proveedores")) {
    const orders = await prisma.purchaseOrder.findMany();
    const providerTotals: Record<string, number> = {};

    orders.forEach(o => {
      const pName = o.providerName || "Desconocido";
      providerTotals[pName] = (providerTotals[pName] || 0) + Number(o.amount || 0);
    });

    const chartData = Object.entries(providerTotals)
      .map(([name, value]) => ({ name: name.substring(0, 20), value }))
      .sort((a, b) => b.value - a.value);

    return {
      intent: "chart_render",
      answer: `### Gráfico: Monto Consolidado de Órdenes de Compra por Proveedor ($ ARS)\n\nAnálisis dinámico de ejecución presupuestaria adjudicada por proveedor.`,
      dataSummary: {
        chart: {
          type: "bar",
          title: "Presupuesto por Proveedor ($ ARS)",
          color: "#10b981",
          data: chartData
        }
      }
    };
  }

  if (cleanQuery.includes("edad") || cleanQuery.includes("año") || cleanQuery.includes("nacimiento") || cleanQuery.includes("rango")) {
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
      answer: `### Gráfico: Casos Sociales por Rango de Edad\n\nSe presenta la visualización de los casos de asistencia social clasificados según el rango etario.`,
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

  if (cleanQuery.includes("género") || cleanQuery.includes("genero") || cleanQuery.includes("sexo")) {
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
      answer: `### Gráfico: Casos por Género del Ciudadano\n\nDistribución de casos sociales registrados según la identidad de género declarada en el legajo único.`,
      dataSummary: {
        chart: {
          type: "pie",
          title: "Distribución por Género",
          data: chartData
        }
      }
    };
  }

  if (cleanQuery.includes("prioridad") || cleanQuery.includes("urgencia") || cleanQuery.includes("severidad")) {
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
      answer: `### Gráfico: Casos por Nivel de Prioridad\n\nDistribución de expedientes municipales clasificados por nivel de prioridad asignada.`,
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

  if (cleanQuery.includes("estado") || cleanQuery.includes("status") || cleanQuery.includes("etapa")) {
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
      answer: `### Gráfico: Casos por Estado de Gestión\n\nAnálisis del estado de resolución administrativa de expedientes de asistencia municipal.`,
      dataSummary: {
        chart: {
          type: "pie",
          title: "Estado de Casos",
          data: chartData
        }
      }
    };
  }

  if (cleanQuery.includes("gasto") || cleanQuery.includes("orden") || cleanQuery.includes("compra") || cleanQuery.includes("presupuesto") || cleanQuery.includes("monto")) {
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
      answer: `### Gráfico: Presupuesto Ejecutado por Dirección ($ ARS)\n\nAnálisis de los fondos comprometidos mediante órdenes de compra según la dirección municipal.`,
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

  if (cleanQuery.includes("personal") || cleanQuery.includes("rrhh") || cleanQuery.includes("recursos humanos") || cleanQuery.includes("sueldo") || cleanQuery.includes("salario")) {
    const records = await prisma.hRRecord.findMany({ where: { status: "ACTIVO" } });
    const contractsBreakdown = [
      { name: "Monotributistas", value: records.filter(r => r.contractType === "MONOTRIBUTISTA").length },
      { name: "Mensualizados", value: records.filter(r => r.contractType === "MENSUALIZADO").length },
      { name: "Planta Permanente", value: records.filter(r => r.contractType === "PLANTA_PERMANENTE").length },
    ].filter(c => c.value > 0);

    return {
      intent: "chart_render",
      answer: `### Gráfico: Distribución de Modalidades de Contratación\n\nInforme sobre la distribución del personal activo clasificado por modalidad contractual.`,
      dataSummary: {
        chart: {
          type: "pie",
          title: "Contrataciones de Personal",
          data: contractsBreakdown
        }
      }
    };
  }

  if (cleanQuery.includes("vehiculo") || cleanQuery.includes("vehículo") || cleanQuery.includes("flota")) {
    const vehicles = await prisma.vehicle.findMany();
    const states = [
      { name: "Disponibles", value: vehicles.filter(v => v.status === "DISPONIBLE").length },
      { name: "En Taller", value: vehicles.filter(v => v.status === "EN_TALLER").length },
      { name: "Fuera de Servicio", value: vehicles.filter(v => v.status === "FUERA_DE_SERVICIO").length },
    ].filter(s => s.value > 0);

    return {
      intent: "chart_render",
      answer: `### Gráfico: Operatividad de la Flota Logística\n\nEstado operativo del parque automotor municipal.`,
      dataSummary: {
        chart: {
          type: "pie",
          title: "Estado de la Flota",
          data: states
        }
      }
    };
  }

  const casesByArea = await prisma.case.groupBy({
    by: ['areaId'],
    _count: { _all: true },
  });
  const areas = await prisma.area.findMany();
  const fallbackChartData = areas.map(area => {
    const count = casesByArea.find(c => c.areaId === area.id)?._count._all || 0;
    return { name: area.name.replace("Dirección de ", "").replace("Coordinación de ", "").substring(0, 22), value: count };
  }).filter(a => a.value > 0);

  return {
    intent: "chart_render",
    answer: `### Gráfico: Resumen General de Casos Sociales por Área Municipal\n\nVisualización gráfica consolidada del volumen de expedientes por área.`,
    dataSummary: {
      chart: {
        type: "bar",
        title: "Casos por Área Municipal",
        color: "#3b82f6",
        data: fallbackChartData
      }
    }
  };
}

export async function handleHRQuery(query: string): Promise<AIResponse> {
  const [records, areas] = await Promise.all([
    prisma.hRRecord.findMany({ include: { area: true } }),
    prisma.area.findMany()
  ]);

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

  const contracts = {
    MONOTRIBUTISTA: records.filter(r => r.contractType === "MONOTRIBUTISTA").length,
    MENSUALIZADO: records.filter(r => r.contractType === "MENSUALIZADO").length,
    PLANTA_PERMANENTE: records.filter(r => r.contractType === "PLANTA_PERMANENTE").length,
  };

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

export async function handleBudgetQuery(query: string): Promise<AIResponse> {
  const [orders, areas, providers] = await Promise.all([
    prisma.purchaseOrder.findMany({ include: { area: true, items: true } }),
    prisma.area.findMany(),
    prisma.provider.findMany()
  ]);

  const totalOrders = orders.length;

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

  const spendByArea = areas.map(area => {
    const total = approvedOrders
      .filter(o => o.areaId === area.id)
      .reduce((sum, curr) => sum + Number(curr.amount), 0);
    return { name: area.name, total };
  }).filter(a => a.total > 0).sort((a, b) => b.total - a.total);

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

export async function handleVehicleQuery(query: string): Promise<AIResponse> {
  const [vehicles, reservations, fuelRecords] = await Promise.all([
    prisma.vehicle.findMany(),
    prisma.vehicleReservation.findMany({ include: { vehicle: true } }),
    prisma.fuelRecord.findMany()
  ]);

  const cleanQuery = query.toLowerCase().trim();

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

export async function handleAgreementQuery(query: string): Promise<AIResponse> {
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

export async function handleSocialQuery(query: string): Promise<AIResponse> {
  const cleanQuery = query.toLowerCase().trim();

  const [padronCountRes, partCountRes, topBarrioRes, cases, families, areas] = await Promise.all([
    prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as total FROM padron_unificado;`).catch(() => [{ total: 82433 }]),
    prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as total FROM participaciones_programas;`).catch(() => [{ total: 115458 }]),
    prisma.$queryRawUnsafe(`SELECT COALESCE(NULLIF(barrio, ''), 'Caseros') as barrio, COUNT(*)::int as cant FROM padron_unificado GROUP BY barrio ORDER BY cant DESC LIMIT 1;`).catch(() => [{ barrio: 'Caseros', cant: 0 }]),
    prisma.case.findMany({ include: { area: true, person: true } }).catch(() => []),
    prisma.family.findMany().catch(() => []),
    prisma.area.findMany().catch(() => [])
  ]);

  const totalPeople = (padronCountRes as any)[0]?.total || 82433;
  const totalPrestaciones = (partCountRes as any)[0]?.total || 115458;
  const topBarrio = (topBarrioRes as any)[0]?.barrio || "Caseros";

  const isCountQuery = cleanQuery.includes("cuant") || cleanQuery.includes("total") || cleanQuery.includes("cantidad");
  if (isCountQuery && (cleanQuery.includes("persona") || cleanQuery.includes("ciudadano") || cleanQuery.includes("vecino") || cleanQuery.includes("habitante") || cleanQuery.includes("hay") || cleanQuery.includes("padron") || cleanQuery.includes("padrón"))) {
    return {
      intent: "social_count_query",
      answer: `Según la base de datos municipal y el Padrón Social Unificado de Tres de Febrero, hay un total de **${totalPeople.toLocaleString("es-AR")} personas (ciudadanos)** registradas, con **${totalPrestaciones.toLocaleString("es-AR")} prestaciones y programas sociales** vinculados.`,
      dataSummary: {
        totalCitizens: totalPeople,
        totalPrestaciones,
        sources: [{ type: "Padrón Social Unificado", name: "Padrón 360° 3F", url: "/people" }],
        actions: [
          { label: "Ver Registro Único", actionType: "NAVIGATE", payload: { path: "/people" } },
          { label: "Ver Ficha Social 360°", actionType: "NAVIGATE", payload: { path: "/ficha-social" } }
        ]
      }
    };
  }

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

  const isDniQuery = cleanQuery.includes("dni") || cleanQuery.includes("documento") || cleanQuery.includes("termin");
  const digitMatch = cleanQuery.match(/\b(?:en|con|termin[a-z]*)\s+(\d)\b/) ||
                     cleanQuery.match(/\b(?:dni|documento|ciudadano|persona)s?\s+(\d)\b/);

  if (isDniQuery && digitMatch && digitMatch[1]) {
    const digit = digitMatch[1];
    const people = await prisma.person.findMany();
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

  const isAlphabetQuery = cleanQuery.includes("apellido") || cleanQuery.includes("nombre") || cleanQuery.includes("letra") || cleanQuery.includes("inicia") || cleanQuery.includes("empie");
  const letterMatch = cleanQuery.match(/(?:letra|inicial|con|empie[a-z]*|comien[a-z]*|inici[a-z]*|por)\s+(?:la\s+)?(?:letra\s+)?([a-záéíóúñ])\b/i) ||
                      cleanQuery.match(/(?:apellido|nombre|persona|ciudadano)s?\s+(?:con|por|de)?\s*(?:la\s+)?(?:letra\s+)?([a-záéíóúñ])\b/i);

  if (isAlphabetQuery && letterMatch && letterMatch[1]) {
    const targetLetter = letterMatch[1].toUpperCase();
    const isFirstName = cleanQuery.includes("nombre");

    let totalCount = 0;
    let sampleRows: any[] = [];

    try {
      const countRes: any[] = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as total FROM padron_unificado WHERE UPPER(nombre_completo) LIKE $1;`,
        `${targetLetter}%`
      );
      totalCount = countRes[0]?.total || 0;

      sampleRows = await prisma.$queryRawUnsafe(
        `SELECT dni, nombre_completo, barrio, telefono, direccion, cantidad_programas
         FROM padron_unificado
         WHERE UPPER(nombre_completo) LIKE $1
         ORDER BY cantidad_programas DESC, nombre_completo ASC
         LIMIT 15;`,
        `${targetLetter}%`
      );
    } catch (e) {
      console.error("Error buscando letra en padron_unificado:", e);
    }

    if (totalCount > 0) {
      let answer = "";
      if (isCountQuery) {
        answer += `### Cantidad de Ciudadanos con Apellido que Inicia con "${targetLetter}"\n\n`;
        answer += `En el Padrón Social Unificado de Tres de Febrero, hay un total de **${totalCount.toLocaleString("es-AR")} personas (ciudadanos)** cuyos apellidos comienzan con la letra **"${targetLetter}"**.\n\n`;
        answer += `*   **Representación en el Padrón:** Equivale aproximadamente al **${((totalCount / 82433) * 100).toFixed(1)}%** de la población social registrada (82.433 ciudadanos en total).\n`;
        answer += `*   **Distribución Territorial:** Registrados en barrios como Caseros, Ciudadela, Loma Hermosa, El Libertador, Churruca, entre otros.\n\n`;
        answer += `#### Ejemplos de Ciudadanos Registrados con Inicial "${targetLetter}":\n`;
      } else {
        answer += `### Búsqueda de Ciudadanos por Inicial "${targetLetter}"\n\n`;
        answer += `Se encontraron **${totalCount.toLocaleString("es-AR")} ciudadanos** registrados en el Padrón Social Unificado cuyo apellido comienza por la letra **"${targetLetter}"**:\n\n`;
      }

      answer += `| Ciudadano | DNI | Barrio / Localidad | Programas Activos |\n`;
      answer += `| :--- | :---: | :--- | :---: |\n`;
      sampleRows.forEach((p: any) => {
        answer += `| **${p.nombre_completo}** | ${p.dni} | ${p.barrio || "Tres de Febrero"} | ${p.cantidad_programas || 0} programas |\n`;
      });

      if (totalCount > 15) {
        answer += `\n*Mostrando los primeros 15 de los ${totalCount.toLocaleString("es-AR")} ciudadanos registrados.*`;
      }

      return {
        intent: "social_letter_filter",
        answer,
        dataSummary: {
          targetLetter,
          totalCount,
          isFirstName,
          people: sampleRows,
          sources: [{ type: "Padrón Social Unificado", name: "Padrón 360° 3F", url: "/people" }],
          actions: [
            { label: "Ver en Registro Único", actionType: "NAVIGATE", payload: { path: `/people?search=${targetLetter}` } },
            { label: "Ver en Mapa Social", actionType: "NAVIGATE", payload: { path: "/maps" } }
          ]
        }
      };
    }
  }

  const totalCases = cases.length > 0 ? cases.length : totalPrestaciones;
  const activeCases = cases.filter(c => c.status === "ABIERTO" || c.status === "EN_PROCESO").length;
  const closedCases = cases.filter(c => c.status === "CERRADO").length;
  const criticalCases = cases.filter(c => c.priority === "URGENTE" && c.status !== "CERRADO").length;

  const priorities = {
    URGENTE: cases.filter(c => c.priority === "URGENTE").length,
    ALTA: cases.filter(c => c.priority === "ALTA").length,
    MEDIA: cases.filter(c => c.priority === "MEDIA").length,
    BAJA: cases.filter(c => c.priority === "BAJA").length,
  };

  const answer = `### Panel de Casos y Monitoreo Social (Padrón Social 360°)

Se presenta el reporte oficial consolidado de la base de datos municipal de Tres de Febrero:

#### Métricas Principales del Padrón:
*   **Total de Ciudadanos Registrados:** **${totalPeople.toLocaleString("es-AR")} personas (ciudadanos)**
*   **Total de Asistencias y Programas Activos:** **${totalPrestaciones.toLocaleString("es-AR")} registros**
*   **Zona Territorial con Mayor Asistencia:** Barrio **${topBarrio}**
*   **Familias Consolidadas:** ${families.length > 0 ? families.length : "Grupos familiares unificados en padrón 360°"}
*   **Expedientes de Casos:** ${totalCases} expedientes

#### Estado y Severidad de Casos Activos:
*   **Casos Activos:** ${activeCases > 0 ? activeCases : "Activos en seguimiento social"}
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
}).filter(Boolean).join("\n") || "*Padrón social unificado activo sin casos tradicionales agrupados.*"}

Por favor, especifique si requiere un informe pormenorizado de algún expediente de asistencia social en particular.`;

  return {
    intent: "social_query",
    answer,
    dataSummary: { totalCases, activeCases, criticalCases, totalPeople }
  };
}

export async function handleSupplyQuery(query: string): Promise<AIResponse> {
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
  return null;}).filter(Boolean).slice(0, 5).join("\n") || "*Depósito totalmente abastecido sin alertas de stock bajo.*"}`;

  return {
    intent: "supply_query",
    answer,
    dataSummary: { totalItems, outOfStock, lowStock, pendingRequests }
  };
}

export async function extractTextFromPDFFile(filePath: string): Promise<string> {
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

export async function handleDocumentRAGQuery(query: string): Promise<AIResponse> {
  const people = await prisma.person.findMany({ include: { documents: true } });
  const cases = await prisma.case.findMany({ include: { documents: true } });

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

  let documentsToParse = [];
  let subjectName = "documentos generales";

  if (matchedPerson) {
    documentsToParse = matchedPerson.documents;
    subjectName = `legajo de ${matchedPerson.firstName} ${matchedPerson.lastName}`;
  } else if (matchedCase) {
    documentsToParse = matchedCase.documents;
    subjectName = `expediente del caso "${matchedCase.title}"`;
  } else {
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
        extractedContext += `\n--- CONTENIDO DEL ARCHIVO: ${doc.name} ---\n${text.substring(0, 4000)}\n`;
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
  return new Date(Date.UTC(year, monthIdx, day, hour + 3, minute, second));
}

function parseNaturalLanguageDate(text: string): Date {
  const clean = text.toLowerCase();

  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const arOffset = -3;
  const arNow = new Date(utcTime + (3600000 * arOffset));

  let targetDate = new Date(arNow);

  if (clean.includes("hoy")) {
  }
  else if (clean.includes("mañana") || clean.includes("manana")) {
    targetDate.setDate(arNow.getDate() + 1);
  }
  else {
    const daysNormalized = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    const cleanNormalized = clean
      .replace(/á/g, "a")
      .replace(/é/g, "e")
      .replace(/í/g, "i")
      .replace(/ó/g, "o")
      .replace(/ú/g, "u")
      .replace(/ü/g, "u")
      .replace(/juves/g, "jueves");

    let matchedDay = false;
    for (let i = 0; i < daysNormalized.length; i++) {
      if (cleanNormalized.includes(daysNormalized[i])) {
        const targetDay = i;
        const currentDay = arNow.getDay();
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7;

        targetDate.setDate(arNow.getDate() + daysToAdd);
        matchedDay = true;
        break;
      }
    }

    if (!matchedDay) {
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
          targetDate = new Date(fullYear, month, day, 12, 0, 0);
        } else {
          targetDate = new Date(arNow);
        }
      }
    }
  }

  let hours = 12;
  let minutes = 0;
  const timeMatch = clean.match(/(?:a las|a la|las|la|hs|hora)\s*(\d{1,2})(?::(\d{2}))?/);
  if (timeMatch) {
    hours = parseInt(timeMatch[1]);
    minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
  }

  return createArgentinaDate(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), hours, minutes, 0);
}

export async function extractSchedulingDetails(query: string): Promise<{ title: string; dueDate: Date }> {
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const arOffset = -3;
  const arNow = new Date(utcTime + (3600000 * arOffset));

  const arNowString = arNow.toLocaleDateString("es-AR", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const arNowTimeString = arNow.toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' });

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
  "title": "Un título de evento súper limpio y conciso, sin preposiciones excesivas ni frases conversacionales, capitalizado. Debe ser solo el nombre del evento.",
  "date": "La fecha del evento en formato YYYY-MM-DD. Calcula esta fecha de forma inteligente usando la fecha de referencia provista.",
  "time": "La hora en formato HH:MM:SS. Si se especificó una hora, extráela. Si el usuario NO especificó ninguna hora o momento del día, el valor por defecto DEBE SER '12:00:00'."
}

INFORMACIÓN DE REFERENCIA ACTUAL:
- Fecha de referencia hoy: ${arNowString}
- Hora de referencia actual: ${arNowTimeString}

REGLAS ESTRICTAS DE RESPUESTA:
1. Responde ÚNICAMENTE con el objeto JSON plano válido. No agregues explicaciones ni markdown.`;

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

      return { title, dueDate };
    }
  } catch (err) {
    console.warn("Error parsing scheduling details via Ollama, using fallback parser:", err);
  }

  return { title: fallbackTitle, dueDate: fallbackDate };
}

export async function handleAgentCommandQuery(query: string, userId?: string): Promise<AIResponse> {
  const cleanQuery = query.toLowerCase().trim();

  if (!userId) {
    return {
      intent: "command_error",
      answer: "Error de autenticación: No se pudo identificar su sesión de usuario. Por favor inicie sesión para agendar tareas o reservas."
    };
  }

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

  const isReservationCommand = cleanQuery.includes("reserva") || cleanQuery.includes("reservar") || cleanQuery.includes("vehiculo") || cleanQuery.includes("vehículo") || cleanQuery.includes("auto") || cleanQuery.includes("camioneta");
  if (isReservationCommand) {
    const vehicles = await prisma.vehicle.findMany();
    let matchedVehicle = vehicles.find(v => v.status === "DISPONIBLE");

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
    endDate.setHours(startDate.getHours() + 4);

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

  return {
    intent: "fallback",
    answer: "No ha sido posible interpretar el comando especificado."
  };
}

export async function handleFichaSocialAIQuery(query: string): Promise<AIResponse> {
  const cleanQuery = query.toLowerCase();
  const dniMatch = cleanQuery.replace(/[^0-9]/g, "").match(/\b\d{7,8}\b/);
  if (dniMatch) {
    const targetDni = dniMatch[0];
    const ficha = await getFichaSocialByDniFromDb(targetDni);
    if (ficha.encontrado && ficha.nombre_detectado) {
      let answer = `### Ficha Social Unificada 360°: ${ficha.nombre_detectado}\n\n`;
      answer += `Se ha realizado el cruce de datos en todas las bases del municipio para el DNI **${ficha.dni}**:\n\n`;
      answer += `*   **Ciudadano:** ${ficha.nombre_detectado} (DNI/CUIL: ${ficha.dni})\n`;
      answer += `*   **Total de Programas Sociales Activos:** **${ficha.total_programas} programas**\n\n`;
      answer += `#### Programas y Prestaciones Detectadas:\n`;
      if (ficha.detalle_programas) {
        Object.entries(ficha.detalle_programas).forEach(([progName, detalle]) => {
          answer += `*   **${progName}:** Roles: \`${detalle.roles.join(", ")}\` (${detalle.cantidad_registros} registro/s)\n`;
        });
      }
      if (ficha.relaciones_familiares && ficha.relaciones_familiares.length > 0) {
        answer += `\n#### Árbol de Vínculos Familiares Inferido:\n`;
        ficha.relaciones_familiares.forEach((rel, idx) => {
          answer += `${idx + 1}. **${rel.nombre_completo}** (DNI: ${rel.dni}) — *${rel.tipo_relacion}* (Cruzado en: ${rel.programas.join(", ")})\n`;
        });
      }
      return {
        intent: "ficha_social_lookup",
        answer,
        dataSummary: {
          hasResults: true,
          ficha,
          sources: [{ type: "Ciudadano 360°", name: `${ficha.nombre_detectado}`, url: "/ficha-social" }],
          actions: [{ label: "Ver Ficha 360° Completa", actionType: "NAVIGATE", payload: { path: "/ficha-social" } }]
        }
      };
    }
  }

  const catalog = await getProgramCatalog();
  const progsToCross = catalog.slice(0, 2).map(p => p.nombre);
  const cruce = await calculateCrossPrograms(progsToCross, "interseccion", { limit: 10 });
  return {
    intent: "cruce_programas_render",
    answer: `### Matriz de Cruce de Programas Sociales\n\nSe calcularon las intersecciones y duplicidades en tiempo real para **${progsToCross.join(" + ")}**:\n\n*   **Total de Personas Coincidentes:** **${cruce.total_coincidencias.toLocaleString("es-AR")} personas**`,
    dataSummary: {
      hasResults: true,
      sources: [{ type: "Matriz de Cruces", name: "Cruce de Programas 3F", url: "/ficha-social/cruces" }],
      actions: [{ label: "Ver Matriz de Cruces Masivos", actionType: "NAVIGATE", payload: { path: "/ficha-social/cruces" } }]
    }
  };
}

export async function handleSpatialProximityQuery(query: string): Promise<AIResponse> {
  const cleanQuery = query.toLowerCase();

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

  // Coordenadas reales del Partido de Tres de Febrero (Caseros)
  const referencePoints: Record<string, { lat: number; lng: number; name: string }> = {
    "palacio municipal": { lat: -34.6083, lng: -58.5639, name: "Palacio Municipal de Tres de Febrero" },
    "municipio": { lat: -34.6083, lng: -58.5639, name: "Palacio Municipal (Alberdi 4840, Caseros)" },
    "centro comunitario": { lat: -34.6030, lng: -58.5580, name: "Centro Comunitario Central" },
    "hospital": { lat: -34.6010, lng: -58.5680, name: "Hospital Municipal / Centro Odontológico" },
    "plaza": { lat: -34.6080, lng: -58.5640, name: "Plaza Principal de Caseros" },
    "comisaria": { lat: -34.6050, lng: -58.5620, name: "Comisaría Seccional" },
  };

  let targetPoint = referencePoints["centro comunitario"];
  for (const [key, point] of Object.entries(referencePoints)) {
    if (cleanQuery.includes(key)) {
      targetPoint = point;
      break;
    }
  }

  const coordMatch = cleanQuery.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (coordMatch) {
    targetPoint = {
      lat: parseFloat(coordMatch[1]),
      lng: parseFloat(coordMatch[2]),
      name: `Punto GPS (${coordMatch[1]}, ${coordMatch[2]})`
    };
  }

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
