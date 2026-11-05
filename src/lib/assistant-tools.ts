// Las consultas fijas del asistente. Gemini lee la pregunta y elige una de esta lista con sus filtros; la app
// revisa los filtros y hace la consulta con los permisos de quien pregunta. Gemini nunca escribe consultas ni
// entra a la base. Si no hay Gemini (o no responde), se elige por palabras con pickRoute.
// Cada vez que se agrega una parte nueva a la app, se agrega acá su consulta (y en services/assistant/tools.ts).
// Sin base de datos, para poder probarlo solo.
import { CASE_LABELS } from "@/lib/case-labels";
import { PADRON_PROGRAMS } from "@/lib/padron-programs";
import type { AssistantRoute } from "@/lib/assistant-routing";

type StringParam = { type: "string"; description: string; enum?: readonly string[]; kind?: "date" | "time"; maxLength?: number };
type BooleanParam = { type: "boolean"; description: string };
type IntegerParam = { type: "integer"; description: string; min: number; max: number };
type ListParam = { type: "array"; description: string; maxItems: number };
export type ToolParam = StringParam | BooleanParam | IntegerParam | ListParam;

export interface ToolDef {
  name: string;
  /** Para Gemini: cuándo usarla. */
  description: string;
  params: Record<string, ToolParam>;
  /** La pantalla de donde salen los datos: si el rol no la puede abrir, el asistente tampoco la consulta. */
  path: string | null;
  /** Lo que se muestra mientras busca. */
  status: string;
}

export type ToolArgs = Record<string, string | boolean | number | string[]>;
export interface ToolCall {
  tool: string;
  args: ToolArgs;
  /** "gemini" si la eligió Gemini, "palabras" si salió de buscar palabras en la pregunta. */
  via: "gemini" | "palabras";
}

const DATE = (description: string): StringParam => ({ type: "string", kind: "date", description: `${description} Formato AAAA-MM-DD.` });
const TIME = (description: string): StringParam => ({ type: "string", kind: "time", description: `${description} Formato HH:MM, de 24 horas.` });

export const CASE_STATES = ["abiertos", "cerrados", "derivados", "todos"] as const;
export const CASE_GROUPS = ["area", "prioridad", "estado", "etiqueta", "mes", "edad", "genero", "a_cargo"] as const;
export const CHART_TYPES = ["gasto_area", "gasto_proveedor", "personal_contrato", "vehiculos_estado", "personas_inicial", "opciones"] as const;

export const ASSISTANT_TOOLS: ToolDef[] = [
  {
    name: "ayuda",
    description: "Saludos, agradecimientos, despedidas o preguntas sobre qué puede hacer el asistente. No la uses si la pregunta pide datos.",
    params: {},
    path: null,
    status: "Preparando la respuesta…",
  },
  {
    name: "expedientes",
    description:
      "Contar expedientes (casos sociales) con filtros, y agruparlos o graficarlos. Sirve para: cuántos hay abiertos, urgentes, sin movimiento, sin profesional a cargo, de una etiqueta, de un área, abiertos en un período, o un gráfico de expedientes.",
    params: {
      estado: { type: "string", enum: CASE_STATES, description: "abiertos (abiertos o en proceso, el valor normal), cerrados, derivados o todos." },
      prioridad: { type: "string", enum: ["URGENTE", "ALTA", "MEDIA", "BAJA"], description: "Solo los de esa prioridad." },
      area: { type: "string", maxLength: 80, description: "Nombre del área, si la pregunta nombra una." },
      etiqueta: { type: "string", enum: CASE_LABELS.map((l) => l.key), description: "Etiqueta del expediente." },
      desde: DATE("Abiertos desde esta fecha."),
      hasta: DATE("Abiertos hasta esta fecha."),
      sin_movimiento: { type: "boolean", description: "Solo los que no tienen intervenciones hace 30 días o más." },
      sin_asignar: { type: "boolean", description: "Solo los que no tienen un profesional a cargo." },
      agrupar_por: { type: "string", enum: CASE_GROUPS, description: "Cómo separarlos en la tabla o el gráfico. a_cargo es por profesional." },
      grafico: { type: "boolean", description: "true si pide un gráfico." },
    },
    path: "/cases",
    status: "Buscando en Expedientes…",
  },
  {
    name: "persona",
    description: "Los datos de una persona del Registro Único: sus programas, su familia y sus expedientes. Usala cuando la pregunta nombra a alguien o da un DNI.",
    params: { nombre_o_dni: { type: "string", maxLength: 80, description: "El nombre y apellido, o el DNI, tal como aparece en la pregunta." } },
    path: "/people",
    status: "Buscando a la persona en el Registro Único…",
  },
  {
    name: "registro_unico",
    description: "Números del padrón (Registro Único): cuántas personas hay, cuántas tienen el apellido con una letra, o cuántas tienen el DNI terminado en un número.",
    params: {
      tema: { type: "string", enum: ["total", "letra", "dni_terminado"], description: "Qué contar." },
      letra: { type: "string", maxLength: 1, description: "La letra inicial del apellido." },
      digito: { type: "string", maxLength: 1, description: "El último número del DNI." },
    },
    path: "/people",
    status: "Buscando en el Registro Único…",
  },
  {
    name: "programas",
    description: "Cuántas personas hay en cada programa social, con las altas y bajas de los últimos 30 días.",
    params: {},
    path: "/people/programas",
    status: "Buscando en Programas…",
  },
  {
    name: "cruce_programas",
    description: "Cuántas personas están en varios programas a la vez (coincidencia), en al menos uno (cobertura) o en uno y no en los otros (exclusión).",
    params: {
      programas: { type: "array", maxItems: 6, description: `Nombres de los programas. Los que hay: ${PADRON_PROGRAMS.map((p) => p.label).join("; ")}.` },
      modo: { type: "string", enum: ["coincidencia", "cobertura", "exclusion"], description: "coincidencia es el valor normal. En exclusion, el primero es el programa base." },
    },
    path: "/people/programas/cruces",
    status: "Cruzando programas…",
  },
  {
    name: "barrios",
    description: "Personas del padrón, personas con programas y expedientes abiertos en cada barrio de Tres de Febrero.",
    params: {},
    path: "/barrios",
    status: "Buscando en Barrios…",
  },
  {
    name: "cerca_de",
    description: "Personas ubicadas en el mapa cerca de un lugar (Palacio Municipal, centro comunitario, hospital, plaza o comisaría) o de unas coordenadas.",
    params: {
      lugar: { type: "string", maxLength: 80, description: "El lugar o las coordenadas, como aparecen en la pregunta." },
      metros: { type: "integer", min: 50, max: 5000, description: "Distancia en metros. Una cuadra son 100 metros." },
    },
    path: "/maps",
    status: "Buscando en el Mapa Social…",
  },
  {
    name: "licencias",
    description: "Quién del personal está de licencia o de vacaciones hoy, y cuántas vueltas falta confirmar.",
    params: {},
    path: "/admin/hr",
    status: "Buscando en Licencias y vacaciones…",
  },
  {
    name: "personal",
    description: "El personal municipal (Recursos Humanos): cuántos agentes hay por situación y contrato, los sueldos, o buscar a un agente por nombre.",
    params: {
      tema: { type: "string", enum: ["resumen", "sueldos", "buscar"], description: "resumen es el valor normal." },
      nombre: { type: "string", maxLength: 60, description: "Para buscar: el nombre o apellido del agente." },
    },
    path: "/admin/hr",
    status: "Buscando en Recursos Humanos…",
  },
  {
    name: "compras",
    description: "Órdenes de compra y presupuesto: lo aprobado y lo que espera aprobación, la ejecución del presupuesto por área, la lista de órdenes o una orden por su número.",
    params: {
      tema: { type: "string", enum: ["resumen", "presupuesto", "lista", "orden"], description: "resumen es el valor normal." },
      numero: { type: "string", maxLength: 20, description: "El número de la orden de compra." },
    },
    path: "/admin/purchase-orders",
    status: "Buscando en Compras y presupuesto…",
  },
  {
    name: "vehiculos",
    description: "Vehículos municipales: el estado de cada uno y sus reservas, la VTV y el seguro vencidos, o el combustible.",
    params: {
      tema: { type: "string", enum: ["resumen", "vencimientos", "combustible"], description: "resumen es el valor normal." },
      patente: { type: "string", maxLength: 10, description: "La patente, si la pregunta nombra un vehículo." },
    },
    path: "/admin/vehicles",
    status: "Buscando en Vehículos…",
  },
  {
    name: "convenios",
    description: "Los convenios con instituciones: cuántos hay, vigentes, en revisión y vencidos, por área.",
    params: {},
    path: "/admin/agreements",
    status: "Buscando en Convenios…",
  },
  {
    name: "stock",
    description: "El stock de insumos: los que no tienen stock, los que están debajo del mínimo y los pedidos de las áreas.",
    params: {},
    path: "/admin/stock",
    status: "Buscando en Stock…",
  },
  {
    name: "cursos",
    description: "Los cursos y talleres abiertos, con inscriptos y asistencia.",
    params: {},
    path: "/cursos",
    status: "Buscando en Cursos y talleres…",
  },
  {
    name: "mis_tareas",
    description: "Las tareas pendientes de quien pregunta: atrasadas, de hoy y de la semana.",
    params: {},
    path: "/tasks",
    status: "Buscando en Mis tareas…",
  },
  {
    name: "grafico",
    description: "Gráficos que no son de expedientes: gasto por área o por proveedor, personal por contrato, vehículos por estado, personas por inicial del apellido, u opciones si preguntan qué gráficos puede hacer. Para gráficos de expedientes usá expedientes con grafico=true.",
    params: { tipo: { type: "string", enum: CHART_TYPES, description: "Qué gráfico." } },
    path: null,
    status: "Armando el gráfico…",
  },
  {
    name: "documentos",
    description: "Leer los PDF adjuntos de una persona o de un expediente.",
    params: { nombre: { type: "string", maxLength: 80, description: "El nombre de la persona o el título del expediente." } },
    path: "/cases",
    status: "Leyendo los documentos…",
  },
  {
    name: "crear_tarea",
    description: "Agendar una tarea o un recordatorio para quien pregunta. No se guarda sola: la persona la confirma.",
    params: {
      titulo: { type: "string", maxLength: 120, description: "Un título corto, sin la fecha." },
      fecha: DATE("El día."),
      hora: TIME("La hora, si la dice."),
    },
    path: "/tasks",
    status: "Preparando lo que pediste…",
  },
  {
    name: "reservar_vehiculo",
    description: "Pedir un vehículo municipal para un día y horario. No se guarda sola: la persona la confirma, y después la aprueba quien administra la flota.",
    params: {
      fecha: DATE("El día."),
      hora_salida: TIME("La hora de salida."),
      hora_vuelta: TIME("La hora de vuelta, si la dice."),
      patente: { type: "string", maxLength: 10, description: "La patente, si pide un vehículo en particular." },
      motivo: { type: "string", maxLength: 120, description: "Para qué lo necesita, si lo dice." },
    },
    path: "/admin/vehicles",
    status: "Preparando lo que pediste…",
  },
  {
    name: "buscar",
    description: "Buscar una palabra en toda la app (personas, expedientes, órdenes, vehículos) cuando ninguna otra consulta sirve.",
    params: { texto: { type: "string", maxLength: 80, description: "Lo que hay que buscar." } },
    path: null,
    status: "Buscando en toda la app…",
  },
];

const BY_NAME = new Map(ASSISTANT_TOOLS.map((t) => [t.name, t]));

export function findTool(name: string): ToolDef | undefined {
  return BY_NAME.get(name);
}

/** La pantalla de donde salen los datos de esa consulta (el gráfico depende de qué gráfico es). */
export function toolPath(call: { tool: string; args: ToolArgs }): string | null {
  if (call.tool === "grafico") {
    const tipo = call.args.tipo;
    if (tipo === "gasto_area" || tipo === "gasto_proveedor") return "/admin/purchase-orders";
    if (tipo === "personal_contrato") return "/admin/hr";
    if (tipo === "vehiculos_estado") return "/admin/vehicles";
    if (tipo === "personas_inicial") return "/people";
    return null;
  }
  return findTool(call.tool)?.path ?? null;
}

function validDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function validTime(s: string): string | null {
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 23 && min <= 59 ? `${String(h).padStart(2, "0")}:${m[2]}` : null;
}

/**
 * Lo que Gemini mandó, revisado: se queda solo con los filtros conocidos y con valores válidos.
 * null si la consulta no existe.
 */
export function validateToolArgs(name: string, raw: unknown): ToolArgs | null {
  const tool = findTool(name);
  if (!tool) return null;
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: ToolArgs = {};
  for (const [key, spec] of Object.entries(tool.params)) {
    const value = input[key];
    if (value === undefined || value === null) continue;
    if (spec.type === "boolean") {
      if (typeof value === "boolean") out[key] = value;
      else if (value === "true" || value === "false") out[key] = value === "true";
    } else if (spec.type === "integer") {
      const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
      if (Number.isFinite(n)) out[key] = Math.min(spec.max, Math.max(spec.min, Math.round(n)));
    } else if (spec.type === "array") {
      const list = (Array.isArray(value) ? value : typeof value === "string" ? value.split(/[;,]/) : [])
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim().slice(0, 100))
        .filter(Boolean);
      if (list.length) out[key] = [...new Set(list)].slice(0, spec.maxItems);
    } else {
      if (typeof value !== "string" && typeof value !== "number") continue;
      const text = String(value).trim();
      if (!text) continue;
      if (spec.enum) {
        const match = spec.enum.find((e) => e.toLowerCase() === text.toLowerCase());
        if (match) out[key] = match;
      } else if (spec.kind === "date") {
        if (validDate(text)) out[key] = text;
      } else if (spec.kind === "time") {
        const t = validTime(text);
        if (t) out[key] = t;
      } else {
        out[key] = text.replace(/[\u0000-\u001f]/g, " ").slice(0, spec.maxLength ?? 80);
      }
    }
  }
  return out;
}

/** Las consultas en el formato que pide Gemini para elegir una ("function calling"). */
export function geminiFunctionDeclarations() {
  return ASSISTANT_TOOLS.map((t) => {
    const properties: Record<string, unknown> = {};
    for (const [key, spec] of Object.entries(t.params)) {
      if (spec.type === "boolean") properties[key] = { type: "BOOLEAN", description: spec.description };
      else if (spec.type === "integer") properties[key] = { type: "INTEGER", description: spec.description };
      else if (spec.type === "array") properties[key] = { type: "ARRAY", items: { type: "STRING" }, description: spec.description };
      else if (spec.enum) properties[key] = { type: "STRING", format: "enum", enum: [...spec.enum], description: spec.description };
      else properties[key] = { type: "STRING", description: spec.description };
    }
    return {
      name: t.name,
      description: t.description,
      ...(Object.keys(properties).length ? { parameters: { type: "OBJECT", properties } } : {}),
    };
  });
}

// ---------------------------------------------------------------------------
// Sin Gemini: de la búsqueda por palabras a una consulta de la lista.
// ---------------------------------------------------------------------------

const GREETING_WORDS = [
  "hola", "buenas", "buen dia", "buenos dias", "buenas tardes", "buenas noches", "que tal", "como estas", "como andas",
  "gracias", "muchas gracias", "chau", "adios", "hasta luego", "saludos", "ayuda", "quien sos", "que podes hacer",
  "que puede hacer", "que sabes hacer", "en que me podes ayudar", "como te uso",
];

/**
 * ¿Es solo un saludo, un gracias o una pregunta sobre qué hace el asistente? Mira el mensaje entero, así
 * "¿Cuántas personas reciben ayuda alimentaria?" no cuenta como saludo.
 */
export function isGreeting(query: string): boolean {
  const clean = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return false;
  const rest = GREETING_WORDS.slice()
    .sort((a, b) => b.length - a.length)
    .reduce((text, g) => text.replace(new RegExp(`\\b${g}\\b`, "g"), " "), ` ${clean} `)
    .replace(/\b(che|asistente|claude|me|a|y|vos|todo|bien|mucho|muchas|por|favor|porfa|ok|dale|genial|perfecto|que|tal)\b/g, " ")
    .trim();
  return rest === "" && clean !== "";
}

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));
const PLATE = /\b([a-z]{3}\s?\d{3}|[a-z]{2}\s?\d{3}\s?[a-z]{2})\b/;

function caseGroup(text: string): (typeof CASE_GROUPS)[number] | undefined {
  if (has(text, ["prioridad", "urgencia"])) return "prioridad";
  if (has(text, ["estado", "etapa"])) return "estado";
  if (has(text, ["etiqueta"])) return "etiqueta";
  if (has(text, ["edad", "franja"])) return "edad";
  if (has(text, ["genero", "sexo"])) return "genero";
  if (has(text, ["mes", "meses"])) return "mes";
  if (has(text, ["profesional", "a cargo"])) return "a_cargo";
  if (has(text, ["area"])) return "area";
  return undefined;
}

/** Los filtros de expedientes que se pueden leer de la pregunta sin Gemini. */
function caseArgs(text: string): ToolArgs {
  const args: ToolArgs = {};
  // "¿Cuántos hay abiertos y cuántos son urgentes?" pide las dos cosas: va al resumen, sin filtrar.
  if (has(text, ["urgente"]) && !/\by\s+cu[aá]ntos\s+(son\s+|hay\s+)?urgentes/.test(text)) args.prioridad = "URGENTE";
  if (has(text, ["cerrado"])) args.estado = "cerrados";
  if (has(text, ["sin movimiento", "quieto", "no se mueven"])) args.sin_movimiento = true;
  if (has(text, ["sin asignar", "sin profesional", "nadie a cargo"])) args.sin_asignar = true;
  const label = CASE_LABELS.find((l) => text.includes(l.label.toLowerCase()) || text.includes(l.label.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")));
  if (label) args.etiqueta = label.key;
  const group = caseGroup(text);
  if (group) args.agrupar_por = group;
  return args;
}

function chartCall(text: string): Omit<ToolCall, "via"> {
  if (has(text, ["podes hacer", "podés hacer", "que graficos", "qué gráficos", "tipos de grafico", "tipos de gráfico", "cualquier"])) {
    return { tool: "grafico", args: { tipo: "opciones" } };
  }
  if (has(text, ["proveedor"])) return { tool: "grafico", args: { tipo: "gasto_proveedor" } };
  if (has(text, ["gasto", "orden", "compra", "presupuesto", "monto"])) return { tool: "grafico", args: { tipo: "gasto_area" } };
  if (has(text, ["personal", "rrhh", "recursos humanos", "sueldo", "salario", "contrato"])) return { tool: "grafico", args: { tipo: "personal_contrato" } };
  if (has(text, ["vehiculo", "vehículo", "flota"])) return { tool: "grafico", args: { tipo: "vehiculos_estado" } };
  if (has(text, ["letra", "inicial", "apellido"])) return { tool: "grafico", args: { tipo: "personas_inicial" } };
  return { tool: "expedientes", args: { ...caseArgs(text), agrupar_por: caseGroup(text) ?? "area", grafico: true } };
}

/**
 * La consulta de la lista que corresponde a lo que eligió la búsqueda por palabras.
 * `text` es el de routingText y `query` la pregunta tal cual.
 */
export function routeToToolCall(route: AssistantRoute, text: string, query: string): ToolCall {
  const call = ((): Omit<ToolCall, "via"> => {
    switch (route) {
      case "chart":
        return chartCall(text);
      case "command":
        return has(text, ["reserv", "vehiculo", "vehículo", "auto", "camioneta"]) && !text.includes("tarea")
          ? { tool: "reservar_vehiculo", args: {} }
          : { tool: "crear_tarea", args: {} };
      case "documents":
        return { tool: "documentos", args: {} };
      case "leaves":
        return { tool: "licencias", args: {} };
      case "tasks":
        return { tool: "mis_tareas", args: {} };
      case "courses":
        return { tool: "cursos", args: {} };
      case "programs":
        return { tool: "programas", args: {} };
      case "barrios":
        return { tool: "barrios", args: {} };
      case "hr":
        return { tool: "personal", args: { tema: has(text, ["sueldo", "salario", "gasto"]) ? "sueldos" : "resumen" } };
      case "budget": {
        const num = query.match(/(?:orden|oc|compra|nro|número|numero)\s*#?\s*(\d+)/i) ?? query.match(/\b(\d{3,})\b/);
        if (num) return { tool: "compras", args: { tema: "orden", numero: num[1] } };
        if (has(text, ["lista", "todas", "mostrar ordenes", "mostrar órdenes", "que orden", "qué orden"])) return { tool: "compras", args: { tema: "lista" } };
        if (has(text, ["presupuesto", "gasto", "gastado", "monto", "ejecucion"])) return { tool: "compras", args: { tema: "presupuesto" } };
        return { tool: "compras", args: { tema: "resumen" } };
      }
      case "vehicles": {
        const plate = text.match(PLATE);
        const tema = has(text, ["vencid", "vtv", "seguro", "alerta"]) ? "vencimientos" : has(text, ["combustible", "nafta", "litro"]) ? "combustible" : "resumen";
        return { tool: "vehiculos", args: { tema, ...(plate ? { patente: plate[1].replace(/\s/g, "").toUpperCase() } : {}) } };
      }
      case "agreements":
        return { tool: "convenios", args: {} };
      case "person":
        return { tool: "persona", args: { nombre_o_dni: query.slice(0, 80) } };
      case "crossing":
        return { tool: "cruce_programas", args: {} };
      case "cases":
        return { tool: "expedientes", args: caseArgs(text) };
      case "social": {
        const dni = query.replace(/[.\s]/g, "").match(/\b\d{7,8}\b/);
        if (dni) return { tool: "persona", args: { nombre_o_dni: dni[0] } };
        const letter = text.match(/letra\s+([a-zñ])\b/);
        if (letter) return { tool: "registro_unico", args: { tema: "letra", letra: letter[1].toUpperCase() } };
        const digit = text.match(/termin[a-z]*\s+en\s+(\d)\b/);
        if (digit) return { tool: "registro_unico", args: { tema: "dni_terminado", digito: digit[1] } };
        if (has(text, ["expediente", "caso", "urgente", "abierto", "deriva"])) return { tool: "expedientes", args: caseArgs(text) };
        // "¿Cuántas personas reciben ayuda alimentaria?": mejor la tabla de programas que el total del padrón.
        if (has(text, ["recib", "alimentar", "beneficio", "prestacion", "comedor", "tarjeta", "plan "])) return { tool: "programas", args: {} };
        return { tool: "registro_unico", args: { tema: "total" } };
      }
      case "supplies":
        return { tool: "stock", args: {} };
      case "nearby": {
        const m = text.match(/(\d+)\s*(?:m\b|metro)/);
        const blocks = text.match(/(\d+)\s*cuadra/);
        const metros = m ? Number(m[1]) : blocks ? Number(blocks[1]) * 100 : 500;
        return { tool: "cerca_de", args: { lugar: query.slice(0, 80), metros: Math.min(5000, Math.max(50, metros)) } };
      }
      default:
        return { tool: "buscar", args: { texto: query.slice(0, 80) } };
    }
  })();
  return { ...call, via: "palabras" };
}

/** Los nombres de programa que mandó Gemini, llevados a los de la lista ("tarjeta alimentar" → "Tarjeta Alimentar"). */
export function matchProgramLabels(names: string[]): string[] {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const out: string[] = [];
  for (const raw of names) {
    const n = norm(raw);
    if (!n) continue;
    const exact = PADRON_PROGRAMS.find((p) => norm(p.label) === n);
    const partial = exact ?? PADRON_PROGRAMS.find((p) => norm(p.label).startsWith(n) || norm(p.label).includes(n) || n.includes(norm(p.label).split(" (")[0]));
    if (partial && !out.includes(partial.label)) out.push(partial.label);
  }
  return out;
}

/** El área que nombró la pregunta, entre las que puede ver ("niñez" → "Dirección de Niñez"). */
export function matchAreaName<T extends { name: string }>(name: string, areas: T[]): T | null {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\b(direccion|coordinacion|subsecretaria|secretaria|de|del|la|el|y)\b/g, " ").replace(/\s+/g, " ").trim();
  const n = norm(name);
  if (!n) return null;
  return areas.find((a) => norm(a.name) === n) ?? areas.find((a) => norm(a.name).includes(n) || n.includes(norm(a.name))) ?? null;
}

/**
 * Sin Gemini: el título de la tarea a partir del pedido. "Agendame una tarea para mañana a las 10: llamar a la
 * escuela" → "Llamar a la escuela". Si hay dos puntos, es lo que sigue; si no, se sacan el pedido, el día y la hora.
 */
export function taskTitleFromQuery(query: string): string {
  const afterColon = query.includes(":") ? query.slice(query.lastIndexOf(":") + 1) : "";
  let t = afterColon.trim().length >= 3 && !/^\d/.test(afterColon.trim()) ? afterColon : query;
  t = t
    .replace(/(?<![\p{L}\d])(agend\p{L}*|record\p{L}*|cre[aá]\p{L}*|anot[aá]\p{L}*|pon[eé](?:me)?|agreg[aá]\p{L}*)(?![\p{L}\d])/giu, " ")
    .replace(/\b(una|un)\s+(tarea|recordatorio|reuni[oó]n|evento|cita|turno)\b/gi, " ")
    .replace(/\b(tarea|recordatorio)\b/gi, " ")
    .replace(/\b(para\s+)?(el\s+)?(hoy|ma[nñ]ana|pasado ma[nñ]ana|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/gi, " ")
    .replace(/\b(para\s+)?(el\s+)?\d{1,2}(\s+de\s+[a-z]+|[\/-]\d{1,2}([\/-]\d{2,4})?)\b/gi, " ")
    .replace(/\b(a\s+las?|a\s+la|tipo|hs?)\s*\d{1,2}([:.]\d{2})?\s*(hs?|horas?)?\b/gi, " ")
    .replace(/\b(por favor|porfa)\b/gi, " ")
    .replace(/^[\s,.:;¿?¡!-]+|[\s,.:;¿?¡!-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1, 120) : "Tarea";
}
