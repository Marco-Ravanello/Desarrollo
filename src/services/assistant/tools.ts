import prisma from "@/lib/prisma";
import { findTool, matchProgramLabels, toolPath, type ToolCall } from "@/lib/assistant-tools";
import { MANAGEMENT_ONLY_ANSWER, scopeCanSee, scopedAreaWhere, type AssistantScope } from "@/lib/assistant-scope";
import { columnasDelCruce, condicionDelCruce, fraseDelCruce, nombreDelModo, type ModoCruce } from "@/lib/cruces";
import { PADRON_PROGRAMS } from "@/lib/padron-programs";
import { plural } from "@/lib/formato";
import { answerStat } from "@/lib/assistant-text";
import { canAccessPath } from "@/lib/permissions";
import type { AIResponse } from "./types";
import {
  CHART_OPTIONS_TEXT,
  handleAgreementQuery,
  handleBudgetQuery,
  handleChartRequest,
  handleDocumentRAGQuery,
  handleHRQuery,
  handleSocialQuery,
  handleSpatialProximityQuery,
  handleSupplyQuery,
  handleVehicleQuery,
} from "./intent-handlers";
import { handleBarriosQuery, handleCoursesQuery, handleExpiringDocumentsQuery, handleLeavesQuery, handleMyTasksQuery, handleProgramsQuery } from "./module-handlers";
import { handleCasesTool } from "./cases-tool";
import { lookupPersonByName, personByDni } from "./person-name-lookup";
import { proposeReservation, proposeTask } from "./proposals";

// Hace la consulta que eligió Gemini (o la búsqueda por palabras), con los permisos de quien pregunta.
// Primero se revisa que pueda abrir la pantalla de donde salen los datos; después cada consulta filtra por
// su área si es Director de Área (lib/assistant-scope.ts).

export interface ToolContext {
  scope: AssistantScope;
  /** La pregunta en minúsculas, con lo de la charla anterior resuelto. */
  query: string;
  /** La pregunta tal cual la escribió. */
  rawQuery: string;
  history?: { role: "user" | "assistant"; content: string }[];
  /** La búsqueda general de toda la app (vive en services/ai-assistant.ts). */
  universalSearch: (text: string) => Promise<AIResponse>;
}

const DENIED = "Con tu rol no podés ver esa parte de la app, así que tampoco la puedo consultar.";

function denied(path: string): AIResponse {
  return {
    intent: "access_denied",
    answer: path.startsWith("/admin/hr") ? MANAGEMENT_ONLY_ANSWER : DENIED,
    dataSummary: { hasResults: false, sources: [], actions: [] },
  };
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

export async function runTool(call: ToolCall, ctx: ToolContext): Promise<AIResponse> {
  const { scope } = ctx;
  const path = toolPath(call);
  if (path && !scopeCanSee(scope, path)) return denied(path);
  const a = call.args;
  // Las consultas viejas leen la pregunta: si la eligió Gemini, se les arma una con los filtros; si salió de
  // buscar palabras, reciben la pregunta tal cual (como antes).
  const words = call.via === "palabras";

  switch (call.tool) {
    case "ayuda":
      return helpAnswer(ctx.rawQuery, scope);
    case "expedientes":
      return handleCasesTool(a, scope);
    case "persona": {
      const text = str(a.nombre_o_dni) || ctx.rawQuery;
      const dni = text.replace(/[.\s-]/g, "").match(/\b\d{7,8}\b/);
      if (dni) return (await personByDni(dni[0], scope)) ?? handleSocialQuery(`dni ${dni[0]}`, scope);
      return (
        (await lookupPersonByName(text, scope)) ?? {
          intent: "person_not_found",
          answer: "No encontré a nadie con ese nombre en el Registro Único. Probá con el nombre y el apellido completos, o con el DNI.",
          dataSummary: { hasResults: false, actions: [{ label: "Ir al Registro Único", actionType: "NAVIGATE", payload: { path: "/people" } }] },
        }
      );
    }
    case "registro_unico": {
      if (words) return handleSocialQuery(ctx.query, scope);
      if (a.tema === "letra" && a.letra) return handleSocialQuery(`personas con apellido de la letra ${str(a.letra).toLowerCase()}`, scope);
      if (a.tema === "dni_terminado" && a.digito) return handleSocialQuery(`personas con dni terminado en ${str(a.digito)}`, scope);
      return handleSocialQuery("cuantas personas hay en el padron", scope);
    }
    case "programas":
      return handleProgramsQuery(scope);
    case "cruce_programas":
      return crossPrograms(Array.isArray(a.programas) ? a.programas : [], str(a.modo));
    case "barrios":
      return handleBarriosQuery(scope);
    case "cerca_de":
      return handleSpatialProximityQuery(words ? ctx.query : `${a.metros ?? 500} metros ${str(a.lugar)}`);
    case "licencias":
      return handleLeavesQuery();
    case "personal":
      return handleHRQuery(words ? ctx.query : a.tema === "sueldos" ? "sueldos del personal" : a.tema === "buscar" && a.nombre ? `buscar ${str(a.nombre)}` : "personal");
    case "compras":
      return handleBudgetQuery(
        words ? ctx.query : a.tema === "orden" && a.numero ? `orden ${str(a.numero)}` : a.tema === "lista" ? "lista de ordenes" : a.tema === "presupuesto" ? "presupuesto" : "ordenes",
        scope
      );
    case "vehiculos":
      return handleVehicleQuery(
        words ? ctx.query : a.patente ? `patente ${str(a.patente)}` : a.tema === "vencimientos" ? "vtv vencida" : a.tema === "combustible" ? "combustible" : "vehiculos"
      );
    case "convenios":
      return handleAgreementQuery(ctx.query, scope);
    case "stock":
      return handleSupplyQuery(ctx.query, scope);
    case "cursos":
      return handleCoursesQuery(scope);
    case "documentos_por_vencer":
      return handleExpiringDocumentsQuery(scope);
    case "mis_tareas":
      return handleMyTasksQuery({ id: scope.userId });
    case "grafico": {
      if (a.tipo === "opciones" || !a.tipo) {
        const example = scopeCanSee(scope, "/cases") ? await handleCasesTool({ agrupar_por: "area", grafico: true }, scope) : null;
        return { intent: "chart_render", answer: CHART_OPTIONS_TEXT, dataSummary: { chart: example?.dataSummary?.chart } };
      }
      return handleChartRequest(str(a.tipo), scope);
    }
    case "documentos":
      return handleDocumentRAGQuery(words ? ctx.query : str(a.nombre).toLowerCase(), scope);
    case "crear_tarea":
      return proposeTask(a, ctx.rawQuery, scope.userId);
    case "reservar_vehiculo":
      return proposeReservation(a, ctx.rawQuery, scope.userId);
    default:
      return ctx.universalSearch(str(a.texto) || ctx.rawQuery);
  }
}

/** Lo que se muestra mientras busca. */
export function toolStatus(call: ToolCall): string {
  return findTool(call.tool)?.status ?? "Buscando…";
}

const MODE_BY_NAME: Record<string, ModoCruce> = { coincidencia: "interseccion", cobertura: "union", exclusion: "diferencia" };

/** Cuántas personas hay en el cruce de programas (las mismas cuentas que la pantalla Cruces de programas). */
async function crossPrograms(names: string[], modeName: string): Promise<AIResponse> {
  const labels = matchProgramLabels(names);
  const actions = [{ label: "Abrir Cruces de programas", actionType: "NAVIGATE", payload: { path: "/people/programas/cruces" } }];
  if (labels.length === 0) {
    return {
      intent: "crossing_question",
      answer: `### Cruce de programas\n\nDecime qué programas querés cruzar, por ejemplo: "¿Cuántas personas están en Tarjeta Alimentar y en Jardines Municipales?".\n\nLos programas son: ${PADRON_PROGRAMS.map((p) => p.label).join(", ")}.`,
      dataSummary: { hasResults: false, actions },
    };
  }
  const modo = MODE_BY_NAME[modeName] ?? "interseccion";
  const columns = columnasDelCruce(labels);
  const rows: { total: number }[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS total FROM padron_unificado WHERE ${condicionDelCruce(columns, modo)};`);
  const total = rows[0]?.total ?? 0;
  return {
    intent: "crossing_query",
    answer: `### Cruce de programas (${nombreDelModo(modo)})\n\nHay **${plural(total, "persona")}** ${fraseDelCruce(labels, modo)}.`,
    dataSummary: {
      hasResults: true,
      total,
      stats: [answerStat(`Personas (${nombreDelModo(modo).toLowerCase()})`, total)],
      sources: [{ type: "Cruces de programas", name: labels.join(" + "), url: "/people/programas/cruces" }],
      actions,
    },
  };
}

const HELP_TOPICS: { path: string; text: string }[] = [
  { path: "/cases", text: "- **Expedientes:** cuántos hay abiertos, urgentes o sin movimiento, por área, etiqueta o mes, también en gráficos." },
  { path: "/people", text: "- **Personas, programas y barrios:** cuántas personas hay en cada programa o barrio, o los datos de alguien por DNI o apellido." },
  { path: "/admin/hr", text: "- **Recursos Humanos:** quién está de licencia, el personal y los sueldos." },
  { path: "/admin/purchase-orders", text: "- **Compras y stock:** las órdenes de compra, el presupuesto y los insumos que faltan." },
  { path: "/admin/vehicles", text: "- **Vehículos:** el estado de cada uno, la VTV, el seguro y el combustible. También te ayudo a pedir uno." },
  { path: "/tasks", text: "- **Cursos y tareas:** los cursos abiertos y tus tareas pendientes. También puedo agendarte una tarea." },
];

/** Saludo, gracias o "¿qué podés hacer?": solo nombra lo que puede ver con su rol. */
export function helpAnswer(query: string, scope: AssistantScope): AIResponse {
  const clean = query.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/\bgracias\b/.test(clean)) return { intent: "thanks", answer: "De nada. Si necesitás algo más, preguntame.", dataSummary: { hasResults: true } };
  if (/\b(chau|adios|hasta luego)\b/.test(clean)) return { intent: "goodbye", answer: "¡Hasta luego! Acá voy a estar para la próxima.", dataSummary: { hasResults: true } };
  const topics = HELP_TOPICS.filter((t) => canAccessPath(scope.role, t.path)).map((t) => t.text);
  const answer = [
    "### Asistente de IA",
    "",
    "Te ayudo a consultar los datos de la app. Podés preguntarme por:",
    "",
    ...topics,
    "",
    scope.areaId ? "Te muestro los datos de tu área, como en el resto de la app." : "",
    "Por ejemplo: \"¿Cuántos expedientes urgentes hay sin movimiento?\".",
  ]
    .filter((l, i, all) => l !== "" || all[i - 1] !== "")
    .join("\n");
  return { intent: "greeting", answer, dataSummary: { hasResults: true, sources: [], actions: [] } };
}

/** Los nombres de las áreas que puede ver, para que Gemini reconozca "Niñez" o "Hábitat" en la pregunta. */
export async function visibleAreaNames(scope: AssistantScope): Promise<string[]> {
  const areas = await prisma.area.findMany({ where: scopedAreaWhere(scope), select: { name: true }, orderBy: { name: "asc" } }).catch(() => []);
  return areas.map((a) => a.name);
}

