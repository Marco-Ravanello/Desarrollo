import prisma from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";
import { findPeopleNearPoint } from "@/services/spatial";
import { searchFichaSocialByDni, calculateCrossPrograms, getProgramCatalog } from "@/services/ficha-social";
import { getFichaSocialByDniFromDb } from "@/services/ficha-social-db";
import { AIResponse } from "./types";
import { callOllama } from "./ollama-client";
import { readUploadedFile, storedNameFromUrl } from "@/lib/file-storage";
import { extractTextFromPDFBuffer } from "@/services/pdf-rag";
import { agreementState } from "@/lib/convenios";
import { todayInArgentina } from "@/lib/follow-up-dates";
import { formatFecha, formatFechaCalendario, formatFechaLarga, formatHora } from "@/lib/fechas";
import { isUrgentOpenCase } from "@/lib/case-urgency";
import { AREA_NOTE, scopedAreaIdWhere, scopedAreaWhere, scopedCaseWhere, type AssistantScope } from "@/lib/assistant-scope";

// Pasa a minúsculas y saca los acentos (conserva la ñ) para que "cuántas" o "padrón"
// se reconozcan igual que "cuantas" o "padron".
export function normalizeQueryText(query: string): string {
  return query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u0302\u0304-\u036f]/g, "")
    .normalize("NFC")
    .trim();
}

/** El texto de "¿qué gráficos podés hacer?". El gráfico de ejemplo (expedientes por área) lo agrega quien la llama. */
export const CHART_OPTIONS_TEXT = `### Gráficos que puedo armar
Puedo armar gráficos con los datos de la app. Pedímelos con tus palabras, por ejemplo:

1. **Expedientes** por área, prioridad, estado, etiqueta, mes, edad, género o profesional a cargo (*"gráfico de expedientes urgentes por área"*).
2. **Gasto por área** (*"gráfico de presupuesto por área"*).
3. **Gasto por proveedor** (*"gráfico de órdenes de compra por proveedor"*).
4. **Personal por tipo de contrato** (*"gráfico de personal por contrato"*).
5. **Vehículos por estado** (*"gráfico de vehículos por estado"*).
6. **Personas por inicial del apellido** (*"gráfico por inicial de apellido"*).

*Como ejemplo, acá tenés los expedientes abiertos por área:*`;

const shortArea = (name: string) => name.replace("Dirección de ", "").replace("Coordinación de ", "").substring(0, 22);

/**
 * Los gráficos que no son de expedientes (los de expedientes los arma handleCasesTool, con filtros).
 * `scope` limita las compras al área del Director.
 */
export async function handleChartRequest(tipo: string, scope: AssistantScope): Promise<AIResponse> {
  if (tipo === "personas_inicial") {
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
      chartData = rows.map((r: any) => ({ name: `Letra ${r.inicial}`, value: r.cantidad }));
    } catch (e) {
      console.error("Error consultando padron_unificado para gráfico por inicial:", e);
    }
    const total = chartData.reduce((acc, curr) => acc + curr.value, 0);
    return {
      intent: "chart_render",
      answer: `### Personas por inicial del apellido\n\nLas ${total.toLocaleString("es-AR")} personas del padrón, según la letra con la que empieza su apellido.`,
      dataSummary: { chart: { type: "bar", title: `Personas por inicial del apellido (${total.toLocaleString("es-AR")} en total)`, color: "#8b5cf6", data: chartData } },
    };
  }

  if (tipo === "gasto_proveedor") {
    const rows = await prisma.purchaseOrder.groupBy({
      by: ["providerName"],
      where: { ...scopedAreaIdWhere(scope), status: { in: ["APROBADA", "CUMPLIDA"] } },
      _sum: { amount: true },
    });
    const chartData = rows
      .map((r) => ({ name: (r.providerName || "Sin proveedor").substring(0, 20), value: Number(r._sum.amount || 0) }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);
    return {
      intent: "chart_render",
      answer: `### Gasto por proveedor\n\nCuánto suman las órdenes de compra aprobadas o cumplidas de cada proveedor.${scope.areaId ? ` ${AREA_NOTE}` : ""}`,
      dataSummary: { chart: { type: "bar", title: "Gasto por proveedor", color: "#10b981", data: chartData } },
    };
  }

  if (tipo === "gasto_area") {
    const [rows, areas] = await Promise.all([
      prisma.purchaseOrder.groupBy({
        by: ["areaId"],
        where: { ...scopedAreaIdWhere(scope), status: { in: ["APROBADA", "CUMPLIDA"] } },
        _sum: { amount: true },
      }),
      prisma.area.findMany({ where: scopedAreaWhere(scope), select: { id: true, name: true } }),
    ]);
    const chartData = areas
      .map((a) => ({ name: shortArea(a.name), value: Number(rows.find((r) => r.areaId === a.id)?._sum.amount || 0) }))
      .filter((a) => a.value > 0);
    return {
      intent: "chart_render",
      answer: `### Gasto por área\n\nCuánto suman las órdenes de compra aprobadas o cumplidas de cada área.${scope.areaId ? ` ${AREA_NOTE}` : ""}`,
      dataSummary: { chart: { type: "bar", title: "Gasto por área", color: "#10b981", data: chartData } },
    };
  }

  if (tipo === "personal_contrato") {
    const rows = await prisma.hRRecord.groupBy({ by: ["contractType"], where: { status: { not: "BAJA" } }, _count: { _all: true } });
    const label: Record<string, string> = { MONOTRIBUTISTA: "Monotributistas", MENSUALIZADO: "Mensualizados", PLANTA_PERMANENTE: "Planta permanente" };
    const chartData = rows.map((r) => ({ name: label[r.contractType] ?? r.contractType, value: r._count._all })).filter((r) => r.value > 0);
    return {
      intent: "chart_render",
      answer: `### Personal por tipo de contrato\n\nCuántas personas del personal (sin contar las bajas) hay con cada tipo de contrato.`,
      dataSummary: { chart: { type: "pie", title: "Personal por tipo de contrato", data: chartData } },
    };
  }

  // vehiculos_estado
  const rows = await prisma.vehicle.groupBy({ by: ["status"], _count: { _all: true } });
  const label: Record<string, string> = { DISPONIBLE: "Disponibles", EN_TALLER: "En el taller", FUERA_DE_SERVICIO: "Fuera de servicio" };
  const chartData = rows.map((r) => ({ name: label[r.status] ?? r.status, value: r._count._all })).filter((r) => r.value > 0);
  return {
    intent: "chart_render",
    answer: `### Vehículos por estado\n\nCuántos vehículos están disponibles, en el taller o fuera de servicio.`,
    dataSummary: { chart: { type: "pie", title: "Vehículos por estado", data: chartData } },
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
      let answer = `### Personal encontrado\n\nEncontré **${matchedAgents.length}** personas del personal que coinciden con "${searchName}":\n\n`;
      matchedAgents.forEach(a => {
        answer += `*   **${a.firstName} ${a.lastName}** (DNI: ${a.dni}) - *${a.position || "Sin puesto definido"}*\n`;
        answer += `    *   **Área:** ${a.area?.name || "Sin área asignada"}\n`;
        answer += `    *   **Contrato:** ${a.contractType} - **Sueldo:** $${Number(a.salary || 0).toLocaleString("es-AR")}\n`;
        answer += `    *   **Horario:** ${a.schedule || "No especificado"} - **Situación:** ${a.status}\n\n`;
      });
      return { intent: "hr_agent_lookup", answer, dataSummary: matchedAgents };
    }
  }

  const totalPersonnel = records.length;
  const activePersonnel = records.filter(r => r.status === "ACTIVO").length;
  const leavePersonnel = records.filter(r => r.status === "LICENCIA" || r.status === "LICENCIA_SIN_GOCE" || r.status === "VACACIONES").length;
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
    answer = `### Sueldos del personal

Los sueldos del personal activo y de licencia suman **$${totalSalary.toLocaleString("es-AR")} por mes**.

#### Por área
| Área | Personas | Total por mes | Sueldo promedio |
| :--- | :---: | :---: | :---: |
${salaryByArea.map(a => `| ${a.name} | **${a.count}** | $${a.total.toLocaleString("es-AR")} | $${Math.round(a.count > 0 ? a.total / a.count : 0).toLocaleString("es-AR")} |`).join("\n")}

*No cuenta a las personas dadas de baja.*`;
  } else {
    answer = `### Personal

Hay **${totalPersonnel}** legajos cargados.

#### Situación
*   **Activos:** ${activePersonnel} agentes
*   **De licencia o de vacaciones:** ${leavePersonnel} agentes
*   **De baja:** ${inactivePersonnel} agentes

#### Tipo de contrato
*   **Monotributistas:** ${contracts.MONOTRIBUTISTA} agentes
*   **Mensualizados:** ${contracts.MENSUALIZADO} agentes
*   **Planta permanente:** ${contracts.PLANTA_PERMANENTE} agentes

Si querés, te muestro los sueldos de alguno de estos contratos.`;
  }

  return {
    intent: "hr_query",
    answer,
    dataSummary: { totalPersonnel, activePersonnel, totalSalary, contracts }
  };
}

export async function handleBudgetQuery(query: string, scope: AssistantScope): Promise<AIResponse> {
  const [orders, areas, providers] = await Promise.all([
    prisma.purchaseOrder.findMany({ where: scopedAreaIdWhere(scope), include: { area: true, items: true }, orderBy: { createdAt: "asc" } }),
    prisma.area.findMany({ where: scopedAreaWhere(scope) }),
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

      let answer = `### Orden de compra N° ${order.number}\n\n`;
      answer += ``;
      answer += `*   **Área que la pidió:** ${order.area?.name || "Sin área asignada"}\n`;
      answer += `*   **Proveedor:** ${order.providerName || "Desconocido"} (CUIT: ${order.providerCuit || "No registrado"})\n`;
      answer += `*   **Fecha de entrega:** ${order.deliveryDate ? formatFechaCalendario(order.deliveryDate) : "No especificada"}\n`;
      answer += `*   **Lugar de entrega:** ${order.deliveryPlace || "No especificado"}\n`;
      answer += `*   **Forma de pago:** ${order.paymentTerms || "No especificada"}\n`;
      answer += `*   **Estado:** \`${order.status}\`\n\n`;

      answer += `#### Montos\n`;
      answer += `*   **Total:** $${totalAmount.toLocaleString("es-AR")}\n`;
      answer += `*   **Ya entregado:** $${executedAmount.toLocaleString("es-AR")}\n`;
      answer += `*   **Falta entregar:** $${pendingBalance.toLocaleString("es-AR")}\n\n`;

      answer += `#### Ítems\n`;
      if (order.items.length > 0) {
        answer += `| Ítem | Pedido | Entregado | Precio unitario | Total |\n`;
        answer += `| :--- | :---: | :---: | :---: | :---: |\n`;
        order.items.forEach(item => {
          const itemTotal = Number(item.quantity) * Number(item.unitPrice);
          answer += `| ${item.description} | ${item.quantity} ${item.unitOfMeasure || ""} | ${item.fulfilledQuantity} ${item.unitOfMeasure || ""} | $${Number(item.unitPrice).toLocaleString("es-AR")} | $${itemTotal.toLocaleString("es-AR")} |\n`;
        });
      } else {
        answer += `*Esta orden no tiene ítems cargados.*\n`;
      }

      return {
        intent: "purchase_order_lookup",
        answer,
        dataSummary: order
      };
    }
  }

  if (query.includes("lista") || query.includes("todas") || query.includes("tengo") || query.includes("cargar") || query.includes("que orden") || query.includes("qué orden") || query.includes("mostrar órdenes") || query.includes("mostrar ordenes")) {
    let answer = `### Órdenes de compra\n\n`;
    answer += `Acá tenés todas las órdenes de compra cargadas en la app:\n\n`;
    answer += `| N° | Área | Proveedor | Total | Estado |\n`;
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
    answer = `### Ejecución del presupuesto y gastos

Las órdenes de compra aprobadas suman **$${totalSpent.toLocaleString("es-AR")}**.
Hay otras esperando aprobación por **$${totalPendingAmount.toLocaleString("es-AR")}**.

#### Aprobado por área
| Área | Aprobado |
| :--- | :---: |
${spendByArea.map(a => `| ${a.name} | **$${a.total.toLocaleString("es-AR")}** |`).join("\n")}

#### Las órdenes más grandes
${topOrders.map((o, idx) => `${idx + 1}. **OC #${o.number}** - ${o.providerName || "Proveedor desconocido"} (${o.area?.name || "Sin área asignada"}): **$${Number(o.amount).toLocaleString("es-AR")}** - *Estado: ${o.status.replace("_", " ")}*`).join("\n")}`;
  } else {
    answer = `### Órdenes de compra y proveedores

Hay **${totalOrders} órdenes de compra** cargadas.

#### Estado
*   **Aprobadas o cumplidas:** ${approvedOrders.length} (Monto: $${totalSpent.toLocaleString("es-AR")})
*   **Esperando aprobación:** ${pendingOrders.length} (Monto: $${totalPendingAmount.toLocaleString("es-AR")})
*   **Borradores:** ${draftOrders.length}

#### Proveedores
Hay **${providers.length} proveedores** cargados. Las órdenes más recientes son de ${orders.slice(-2).map(o => `*${o.providerName}*`).join(" y ")}.`;
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

  const cleanQuery = normalizeQueryText(query);

  const plateMatch = cleanQuery.replace(/[^a-z0-9]/g, "").match(/[a-z]{3}\d{3}|[a-z]{2}\d{3}[a-z]{2}/);
  if (plateMatch) {
    const targetPlate = plateMatch[0].toUpperCase();
    const matchedVehicle = vehicles.find(v => v.plate && v.plate.replace(/[^a-z0-9]/g, "").toUpperCase() === targetPlate);

    if (matchedVehicle) {
      const records = fuelRecords.filter(r => r.vehicleId === matchedVehicle.id);
      const totalCost = records.reduce((sum, curr) => sum + Number(curr.amount), 0);
      const totalLiters = records.reduce((sum, curr) => sum + Number(curr.liters), 0);

      let answer = `### Combustible de ${matchedVehicle.brand} ${matchedVehicle.model} (${matchedVehicle.plate})\n\n`;
      answer += ``;
      answer += `*   **Vehículo:** ${matchedVehicle.brand} ${matchedVehicle.model}\n`;
      answer += `*   **Patente:** ${matchedVehicle.plate}\n`;
      answer += `*   **Límite por mes:** $${Number(matchedVehicle.fuelMonthlyLimit || 0).toLocaleString("es-AR")} (Tarjeta: ${matchedVehicle.fuelCardNumber || "No registrada"})\n`;
      answer += `*   **Estado:** \`${matchedVehicle.status}\`\n\n`;

      answer += `#### Total cargado\n`;
      answer += `*   **Gasto en combustible:** $${totalCost.toLocaleString("es-AR")}\n`;
      answer += `*   **Litros cargados:** ${totalLiters.toLocaleString("es-AR")} litros\n`;
      answer += `*   **Precio promedio por litro:** $${totalLiters > 0 ? Math.round(totalCost / totalLiters).toLocaleString("es-AR") : "0"} por litro\n\n`;

      answer += `#### Cargas (${records.length})\n`;
      if (records.length > 0) {
        answer += `| Fecha | Litros | Monto | N° de ticket |\n`;
        answer += `| :--- | :---: | :---: | :---: |\n`;
        records.forEach(r => {
          answer += `| ${new Date(r.date).toLocaleDateString("es-AR")} | ${Number(r.liters).toLocaleString("es-AR")} litros | $${Number(r.amount).toLocaleString("es-AR")} | ${r.ticketNumber || "No registrado"} |\n`;
        });
      } else {
        answer += `*Este vehículo no tiene cargas de combustible.*`;
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

    let answer = `### VTV y seguros vencidos\n\n`;
    answer += `Estos vehículos tienen la VTV o el seguro vencido:\n\n`;

    if (expiredVtv.length > 0 || expiredInsurance.length > 0) {
      answer += `| Vehículo | Patente | VTV | Seguro | Estado |\n`;
      answer += `| :--- | :---: | :---: | :---: | :---: |\n`;
      vehicles.forEach(v => {
        const hasVtvExpired = v.vtvExpiry && new Date(v.vtvExpiry) < new Date();
        const hasInsExpired = v.insuranceExpiry && new Date(v.insuranceExpiry) < new Date();
        if (hasVtvExpired || hasInsExpired) {
          answer += `| **${v.brand} ${v.model}** | ${v.plate} | ${hasVtvExpired ? `Vencido (${formatFechaCalendario(v.vtvExpiry)})` : "Al día"} | ${hasInsExpired ? `Vencido (${formatFechaCalendario(v.insuranceExpiry)})` : "Al día"} | \`${v.status}\` |\n`;
        }
      });
    } else {
      answer += `*Todos los vehículos tienen la VTV y el seguro al día.*`;
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
    answer = `### Combustible

La flota municipal registra los siguientes consumos consolidados:

*   **Gasto en combustible:** $${totalFuelCost.toLocaleString("es-AR")}
*   **Litros cargados:** ${totalLiters.toLocaleString("es-AR")} litros
*   **Precio promedio por litro:** $${totalLiters > 0 ? Math.round(totalFuelCost / totalLiters).toLocaleString("es-AR") : "0"} por litro

#### Por vehículo
${vehicles.map(v => {
  const recs = fuelRecords.filter(r => r.vehicleId === v.id);
  const totalAm = recs.reduce((s, c) => s + Number(c.amount), 0);
  const lts = recs.reduce((s, c) => s + Number(c.liters), 0);
  return recs.length > 0 ? `*   **${v.brand} ${v.model} (${v.plate}):** $${totalAm.toLocaleString("es-AR")} (${lts} litros)` : null;
}).filter(Boolean).slice(0, 4).join("\n")}`;
  } else {
    answer = `### Vehículos

Hay **${totalVehicles} vehículos** cargados.

#### Estado
*   **Disponibles:** ${available} unidades
*   **En el taller:** ${inWorkshop} unidades
*   **Fuera de servicio:** ${outOfService} unidades

#### Reservas
*   **Esperando aprobación:** ${pendingReservations}
*   **Aprobadas o en uso:** ${activeReservations}

#### VTV y seguro
${vehicles.map(v => {
  const alerts = [];
  if (v.vtvExpiry && new Date(v.vtvExpiry) < new Date()) alerts.push("VTV Vencida");
  if (v.insuranceExpiry && new Date(v.insuranceExpiry) < new Date()) alerts.push("Seguro Vencido");
  return alerts.length > 0 ? `*   **${v.brand} ${v.model} (${v.plate}):** ${alerts.join(" y ")}` : null;
}).filter(Boolean).join("\n") || "*Todos tienen la VTV y el seguro al día.*"}`;
  }

  return {
    intent: "vehicle_query",
    answer,
    dataSummary: { totalVehicles, available, inWorkshop, totalFuelCost }
  };
}

export async function handleAgreementQuery(query: string, scope: AssistantScope): Promise<AIResponse> {
  const [agreements, areas] = await Promise.all([
    prisma.agreement.findMany({ where: scopedAreaIdWhere(scope), include: { area: true } }),
    prisma.area.findMany({ where: scopedAreaWhere(scope) })
  ]);

  const total = agreements.length;
  // Un convenio vigente cuya fecha de fin ya pasó cuenta como vencido.
  const today = todayInArgentina();
  const states = agreements.map((a) => agreementState(a, today).status);
  const active = states.filter((st) => st === "VIGENTE").length;
  const review = states.filter((st) => st === "EN_REVISION").length;
  const expired = states.filter((st) => st === "VENCIDO").length;

  const totalAmount = agreements.reduce((sum, curr) => sum + Number(curr.amount || 0), 0);

  const answer = `### Convenios

Hay **${total} convenios** cargados.

#### Estado
*   **Monto total:** $${totalAmount.toLocaleString("es-AR")}
*   **Vigentes:** ${active}
*   **En revisión:** ${review}
*   **Vencidos:** ${expired}

#### Por área
${areas.map(a => {
  const count = agreements.filter(ag => ag.areaId === a.id).length;
  const amt = agreements.filter(ag => ag.areaId === a.id).reduce((s, c) => s + Number(c.amount || 0), 0);
  return count > 0 ? `*   **${a.name}:** ${count} convenios ($${amt.toLocaleString("es-AR")})` : null;
}).filter(Boolean).join("\n")}`;

  return {
    intent: "agreement_query",
    answer,
    dataSummary: { total, active, totalAmount }
  };
}

export async function handleSocialQuery(query: string, scope: AssistantScope): Promise<AIResponse> {
  const cleanQuery = normalizeQueryText(query);

  const [padronCountRes, partCountRes, topBarrioRes, cases, families, areas] = await Promise.all([
    prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as total FROM padron_unificado;`).catch(() => [{ total: 0 }]),
    prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as total FROM participaciones_programas;`).catch(() => [{ total: 0 }]),
    prisma.$queryRawUnsafe(`SELECT COALESCE(NULLIF(barrio, ''), NULLIF(localidad, '')) as barrio, COUNT(*)::int as cant FROM padron_unificado WHERE (barrio IS NOT NULL AND TRIM(barrio) != '') OR (localidad IS NOT NULL AND TRIM(localidad) != '') GROUP BY 1 ORDER BY cant DESC LIMIT 1;`).catch(() => []),
    prisma.case.findMany({ where: scopedCaseWhere(scope), select: { areaId: true, status: true, priority: true } }).catch(() => []),
    prisma.family.findMany().catch(() => []),
    prisma.area.findMany({ where: scopedAreaWhere(scope) }).catch(() => [])
  ]);

  let totalPeople = (padronCountRes as any)[0]?.total || 0;
  if (totalPeople === 0) {
    totalPeople = await prisma.person.count().catch(() => 0);
  }
  let totalPrestaciones = (partCountRes as any)[0]?.total || 0;
  if (totalPrestaciones === 0) {
    totalPrestaciones = await prisma.intervention.count().catch(() => 0);
  }
  let topBarrio = (topBarrioRes as any)[0]?.barrio || "";
  if (!topBarrio) {
    const personWithAddr = await prisma.person.findFirst({ where: { address: { not: null } }, select: { address: true } }).catch(() => null);
    topBarrio = personWithAddr?.address?.split(",")[0] || "Tres de Febrero";
  }

  const isCountQuery = cleanQuery.includes("cuant") || cleanQuery.includes("total") || cleanQuery.includes("cantidad");
  if (isCountQuery && (cleanQuery.includes("persona") || cleanQuery.includes("ciudadano") || cleanQuery.includes("vecino") || cleanQuery.includes("habitante") || cleanQuery.includes("hay") || cleanQuery.includes("padron"))) {
    return {
      intent: "social_count_query",
      answer: `En el padrón hay **${totalPeople.toLocaleString("es-AR")} personas (ciudadanos)** registradas, con **${totalPrestaciones.toLocaleString("es-AR")} prestaciones y programas sociales** vinculados.`,
      dataSummary: {
        totalCitizens: totalPeople,
        totalPrestaciones,
        sources: [{ type: "Padrón Social Unificado", name: "Padrón 360° 3F", url: "/people" }],
        actions: [
          { label: "Ver Registro Único", actionType: "NAVIGATE", payload: { path: "/people" } }
        ]
      }
    };
  }

  const numericDniMatch = cleanQuery.replace(/[^0-9]/g, "").match(/\b\d{7,8}\b/);
  if (numericDniMatch) {
    const targetDni = numericDniMatch[0];
    // Los expedientes de la persona, como en su ficha: sin Violencia de Género para quien no tiene el permiso.
    const matchedPerson = await prisma.person.findFirst({
      where: { dni: targetDni },
      include: {
        cases: { where: scope.canViewSensitive ? {} : { NOT: { area: { name: { contains: "violencia", mode: "insensitive" } } } }, include: { area: true } },
        documents: { where: { OR: [{ caseId: null }, { case: scope.canViewSensitive ? {} : { NOT: { area: { name: { contains: "violencia", mode: "insensitive" } } } } }] } }
      }
    });
    if (matchedPerson) {
      let answer = `### ${matchedPerson.lastName}, ${matchedPerson.firstName}\n\n`;
      answer += ``;
      answer += `*   **DNI:** ${matchedPerson.dni}\n`;
      answer += `*   **Teléfono:** ${matchedPerson.phone || "No registrado"}\n`;
      answer += `*   **Dirección:** ${matchedPerson.address || "No registrada"}\n`;
      answer += `*   **Fecha de nacimiento:** ${matchedPerson.birthDate ? formatFechaCalendario(matchedPerson.birthDate) : "No registrada"}\n\n`;

      answer += `#### Expedientes (${matchedPerson.cases.length})\n`;
      if (matchedPerson.cases.length > 0) {
        matchedPerson.cases.forEach((c, idx) => {
          answer += `\n${idx + 1}. **${c.title}**\n`;
          answer += `   *   **Descripción:** ${c.description || "Sin descripción disponible."}\n`;
          answer += `   *   **Estado:** \`${c.status}\` - **Prioridad:** \`${c.priority}\`\n`;
          answer += `   *   **Área:** *${c.area.name}*\n`;
          answer += `   *   **Abierto el:** ${formatFecha(c.createdAt)}\n`;
        });
      } else {
        answer += `*No tiene expedientes abiertos.*\n`;
      }

      const pdfDocs = matchedPerson.documents.filter(d => d.url && d.url.toLowerCase().endsWith(".pdf"));
      if (pdfDocs.length > 0) {
        let extractedText = "";
        for (const doc of pdfDocs) {
          const filePath = doc.url;
          const text = await extractTextFromPDFFile(filePath);
          if (text.trim().length > 0) {
            extractedText += `\n--- CONTENIDO DEL DOCUMENTO/PDF ADJUNTO: ${doc.name} ---\n${text.substring(0, 4000)}\n`;
          }
        }
        if (extractedText.trim().length > 0) {
          answer += `\n\n[INFORMACIÓN DE RESPALDO EXTRAÍDA DE DOCUMENTOS Y EXPEDIENTES PDF DEL CIUDADANO]:\n${extractedText}\n`;
        }
      }

      answer += `\nPodés ver todo en la ficha de la persona.`;

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
    const filteredPeople = await prisma.person.findMany({ where: { dni: { endsWith: digit } }, orderBy: { lastName: "asc" }, take: 50 });

    let answer = `### Personas con DNI terminado en ${digit}\n\n`;
    answer += `Encontré **${filteredPeople.length} personas**:\n\n`;

    if (filteredPeople.length > 0) {
      answer += `| Persona | DNI | Teléfono | Dirección |\n`;
      answer += `| :--- | :---: | :---: | :--- |\n`;
      filteredPeople.forEach(p => {
        answer += `| **${p.lastName}, ${p.firstName}** | ${p.dni} | ${p.phone || "No registrado"} | ${p.address || "No registrado"} |\n`;
      });
    } else {
      answer += `*No encontré personas con el DNI terminado en ${digit}.*`;
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
        const totalRef = totalPeople > 0 ? totalPeople : totalCount;
        const pct = totalPeople > 0 ? ((totalCount / totalPeople) * 100).toFixed(1) : "100";

        answer += `### Apellidos con ${targetLetter}\n\n`;
        answer += `En el Padrón Social Unificado de Tres de Febrero, hay un total de **${totalCount.toLocaleString("es-AR")} personas (ciudadanos)** cuyos apellidos comienzan con la letra **"${targetLetter}"**.\n\n`;
        answer += `*   **Representación en el Padrón:** Equivale aproximadamente al **${pct}%** de la población social registrada (${totalRef.toLocaleString("es-AR")} ciudadanos en total).\n`;
        answer += `*   **Distribución Territorial:** Registrados en barrios como Caseros, Ciudadela, Loma Hermosa, El Libertador, Churruca, entre otros.\n\n`;
        answer += `#### Algunas de esas personas\n`;
      } else {
        answer += `### Apellidos con ${targetLetter}\n\n`;
        answer += `Se encontraron **${totalCount.toLocaleString("es-AR")} ciudadanos** registrados en el Padrón Social Unificado cuyo apellido comienza por la letra **"${targetLetter}"**:\n\n`;
      }

      answer += `| Persona | DNI | Barrio / Localidad | Programas activos |\n`;
      answer += `| :--- | :---: | :--- | :---: |\n`;
      sampleRows.forEach((p: any) => {
        answer += `| **${p.nombre_completo}** | ${p.dni} | ${p.barrio || "Tres de Febrero"} | ${p.cantidad_programas || 0} programas |\n`;
      });

      if (totalCount > 15) {
        answer += `\n*Muestro las primeras 15 de ${totalCount.toLocaleString("es-AR")}.*`;
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
  const criticalCases = cases.filter(isUrgentOpenCase).length;

  const priorities = {
    URGENTE: cases.filter(c => c.priority === "URGENTE").length,
    ALTA: cases.filter(c => c.priority === "ALTA").length,
    MEDIA: cases.filter(c => c.priority === "MEDIA").length,
    BAJA: cases.filter(c => c.priority === "BAJA").length,
  };

  const answer = `### Resumen del Registro Único

#### Padrón
*   **Personas:** **${totalPeople.toLocaleString("es-AR")}**
*   **Programas activos (sumando todas las personas):** **${totalPrestaciones.toLocaleString("es-AR")}**
*   **Barrio con más personas en programas:** **${topBarrio}**
*   **Expedientes:** ${totalCases}

#### Expedientes
*   **Abiertos o en proceso:** ${activeCases}
*   **Urgentes sin cerrar:** **${criticalCases}**
*   **Cerrados:** ${closedCases}

#### Por prioridad (todos)
*   **Urgente:** ${priorities.URGENTE}
*   **Alta:** ${priorities.ALTA}
*   **Media:** ${priorities.MEDIA}
*   **Baja:** ${priorities.BAJA}

#### Por área
${areas.map(a => {
  const count = cases.filter(c => c.areaId === a.id).length;
  const active = cases.filter(c => c.areaId === a.id && (c.status === "ABIERTO" || c.status === "EN_PROCESO")).length;
  return count > 0 ? `*   **${a.name}:** ${count} en total, ${active} sin cerrar` : null;
}).filter(Boolean).join("\n") || "*Todavía no hay expedientes.*"}

Si querés el detalle de algún expediente en particular, pedímelo con el DNI o el apellido.`;

  return {
    intent: "social_query",
    answer,
    dataSummary: { totalCases, activeCases, criticalCases, totalPeople }
  };
}

export async function handleSupplyQuery(query: string, scope: AssistantScope): Promise<AIResponse> {
  // El Director ve el stock de su área y el que es para todas las áreas.
  const itemWhere = scopedAreaIdWhere(scope, true);
  const [items, requests] = await Promise.all([
    prisma.supplyItem.findMany({ where: itemWhere, include: { area: true } }),
    prisma.supplyRequest.findMany({ where: { supply: itemWhere }, include: { supply: true } })
  ]);

  const totalItems = items.length;
  const outOfStock = items.filter(i => i.stock === 0).length;
  const lowStock = items.filter(i => i.stock > 0 && i.stock <= i.minStock).length;

  const pendingRequests = requests.filter(r => r.status === "PENDIENTE").length;

  const answer = `### Stock

*   **Insumos cargados:** ${totalItems}
*   **Sin stock:** **${outOfStock}**
*   **Debajo del mínimo:** **${lowStock}**
*   **Pedidos de las áreas sin entregar:** ${pendingRequests}

#### Los que hay que reponer
${items.map(i => {
  if (i.stock === 0) return `*   **${i.name}:** sin stock (${i.area?.name || "todas las áreas"})`;
  if (i.stock <= i.minStock) return `*   **${i.name}:** quedan ${i.stock} y el mínimo es ${i.minStock}`;
  return null;}).filter(Boolean).slice(0, 5).join("\n") || "*Depósito totalmente abastecido sin alertas de stock bajo.*"}`;

  return {
    intent: "supply_query",
    answer,
    dataSummary: { totalItems, outOfStock, lowStock, pendingRequests }
  };
}

export async function extractTextFromPDFFile(filePath: string): Promise<string> {
  try {
    // Los documentos subidos se guardan como "/api/uploads/<nombre>" y pueden estar en Vercel Blob.
    const fileBuffer = filePath.startsWith("/api/uploads/")
      ? await readUploadedFile(storedNameFromUrl(filePath))
      : await fs.readFile(filePath);
    if (!fileBuffer) return "";
    return await extractTextFromPDFBuffer(fileBuffer);
  } catch (error) {
    console.error(`Error extracting text from PDF ${filePath}:`, error);
    return "";
  }
}

export async function handleDocumentRAGQuery(query: string, scope: AssistantScope): Promise<AIResponse> {
  // Los documentos de expedientes que no puede ver (otra área para el Director, o Violencia de Género) no se leen.
  const caseScope = scopedCaseWhere(scope);
  const visibleDocs = { OR: [{ caseId: null }, { case: caseScope }] };
  const words = normalizeQueryText(query).split(/[^a-zñ]+/).filter((w) => w.length >= 3).slice(0, 6);

  const matchedPerson = words.length
    ? await prisma.person.findFirst({
        where: { OR: words.map((w) => ({ lastName: { equals: w, mode: "insensitive" as const } })) },
        include: { documents: { where: visibleDocs } },
      })
    : null;
  const matchedCase = !matchedPerson && words.length
    ? await prisma.case.findFirst({
        where: { AND: [caseScope, ...words.map((w) => ({ title: { contains: w, mode: "insensitive" as const } }))] },
        include: { documents: true },
      })
    : null;

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
      where: visibleDocs,
      orderBy: { createdAt: "desc" },
      take: 3
    });
  }

  const pdfDocs = documentsToParse.filter(d => d.url && d.url.toLowerCase().endsWith(".pdf"));

  let answer = `### Documentos\n\n`;
  answer += `Esto encontré en los documentos de **${subjectName}**:\n\n`;

  if (pdfDocs.length > 0) {
    let extractedContext = "";
    for (const doc of pdfDocs) {
      const filePath = doc.url;
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
      answer += `\n*No se pudo extraer texto legible de los archivos adjuntos. Fijate que sean PDF con texto, no fotos escaneadas.*`;
    }
  } else {
    answer += `*No hay archivos PDF adjuntos.*`;
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

  const arNowString = formatFechaLarga(now);
  const arNowTimeString = formatHora(now);

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

export async function handleFichaSocialAIQuery(query: string): Promise<AIResponse> {
  const cleanQuery = normalizeQueryText(query);
  const dniMatch = cleanQuery.replace(/[^0-9]/g, "").match(/\b\d{7,8}\b/);
  if (dniMatch) {
    const targetDni = dniMatch[0];
    const ficha = await getFichaSocialByDniFromDb(targetDni);
    if (ficha.encontrado && ficha.nombre_detectado) {
      let answer = `### ${ficha.nombre_detectado}\n\n`;
      answer += `Lo que encontré para el DNI **${ficha.dni}**:\n\n`;
      answer += `*   **Ciudadano:** ${ficha.nombre_detectado} (DNI/CUIL: ${ficha.dni})\n`;
      answer += `*   **Total de Programas Sociales Activos:** **${ficha.total_programas} programas**\n\n`;
      answer += `#### Programas\n`;
      if (ficha.detalle_programas) {
        Object.entries(ficha.detalle_programas).forEach(([progName, detalle]) => {
          answer += `*   **${progName}:** Roles: \`${detalle.roles.join(", ")}\` (${detalle.cantidad_registros} registro/s)\n`;
        });
      }
      if (ficha.relaciones_familiares && ficha.relaciones_familiares.length > 0) {
        answer += `\n#### Familia\n`;
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
          sources: [{ type: "Registro Único", name: `${ficha.nombre_detectado}`, url: `/people/${ficha.dni}` }],
          actions: [{ label: "Ver su ficha completa", actionType: "NAVIGATE", payload: { path: `/people/${ficha.dni}` } }]
        }
      };
    }
  }

  const catalog = await getProgramCatalog();
  const progsToCross = catalog.slice(0, 2).map(p => p.nombre);
  const cruce = await calculateCrossPrograms(progsToCross, "interseccion", { limit: 10 });
  return {
    intent: "cruce_programas_render",
    answer: `### Cruce de programas\n\nPersonas en **${progsToCross.join(" + ")}**:\n\n*   **Total de Personas Coincidentes:** **${cruce.total_coincidencias.toLocaleString("es-AR")} personas**`,
    dataSummary: {
      hasResults: true,
      sources: [{ type: "Matriz de Cruces", name: "Cruce de Programas 3F", url: "/people/programas/cruces" }],
      actions: [{ label: "Ver cruces de programas", actionType: "NAVIGATE", payload: { path: "/people/programas/cruces" } }]
    }
  };
}

export async function handleSpatialProximityQuery(query: string): Promise<AIResponse> {
  const cleanQuery = normalizeQueryText(query);

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
      answer: `### Personas cerca\n\nNo encontré personas ubicadas en el mapa a menos de **${radiusMeters} metros** alrededor de **${targetPoint.name}**.`,
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

  let answer = `### Personas a menos de ${radiusMeters} m de ${targetPoint.name}\n\n`;
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
