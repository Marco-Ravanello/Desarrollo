import { SemanticFilters } from "./types";

export function resolveAnaphoraAndContext(
  query: string,
  history?: { role: "user" | "assistant"; content: string }[]
): string {
  if (!history || history.length === 0) return query;

  let resolvedQuery = query.toLowerCase();

  let lastDni: string | null = null;
  let lastOc: string | null = null;
  let lastPlate: string | null = null;

  for (let i = history.length - 1; i >= 0; i--) {
    const text = history[i].content;

    const dniMatch = text.match(/\b\d{7,8}\b/);
    if (dniMatch && !lastDni) {
      lastDni = dniMatch[0];
    }

    const ocMatch = text.match(/(?:orden|oc|compra|nro|número|numero)\s*#?\s*(\d+)/i) || text.match(/\b\d{3,}\b/);
    if (ocMatch && !lastOc) {
      lastOc = ocMatch[1];
    }

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

  const isListFollowup = resolvedQuery.includes("cuáles") || resolvedQuery.includes("cuales") ||
                         resolvedQuery.includes("quiénes") || resolvedQuery.includes("quienes") ||
                         resolvedQuery.includes("dame la lista") || resolvedQuery.includes("ver los") ||
                         resolvedQuery.includes("mostrar");
  if (isListFollowup) {
    for (let i = history.length - 1; i >= 0; i--) {
      const pastContent = history[i].content.toLowerCase();
      const pastLetterMatch = pastContent.match(/\b(?:letra|inicial|con|empie[a-z]*|comien[a-z]*|inici[a-z]*|por)\s+([a-z])\b/) ||
                              pastContent.match(/\b(?:apellido|nombre)s?\s+([a-z])\b/);
      if (pastLetterMatch && pastLetterMatch[1]) {
        resolvedQuery += ` personas con apellido que empiece con la letra ${pastLetterMatch[1]}`;
        break;
      }
    }
  }

  return resolvedQuery;
}

export function expandMunicipalSynonyms(query: string): SemanticFilters {
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
