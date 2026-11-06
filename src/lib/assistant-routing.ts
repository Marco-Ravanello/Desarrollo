// Qué parte de la app consulta el asistente para cada pregunta, y qué dice mientras busca.
// Sin base de datos, para poder probarlo solo.

export type AssistantRoute =
  | "chart"
  | "command"
  | "documents"
  | "leaves"
  | "tasks"
  | "courses"
  | "expiring_documents"
  | "programs"
  | "barrios"
  | "hr"
  | "budget"
  | "vehicles"
  | "agreements"
  | "person"
  | "cases"
  | "social"
  | "crossing"
  | "supplies"
  | "nearby"
  | "search";

/** Lo que se muestra mientras busca ("Buscando en Expedientes…"). */
export const ROUTE_STATUS: Record<AssistantRoute, string> = {
  chart: "Armando el gráfico…",
  command: "Preparando lo que pediste…",
  documents: "Leyendo los documentos…",
  leaves: "Buscando en Licencias y vacaciones…",
  tasks: "Buscando en Mis tareas…",
  courses: "Buscando en Cursos y talleres…",
  expiring_documents: "Buscando en Documentos por vencer…",
  programs: "Buscando en Programas…",
  barrios: "Buscando en Barrios…",
  hr: "Buscando en Recursos Humanos…",
  budget: "Buscando en Compras y presupuesto…",
  vehicles: "Buscando en Vehículos…",
  agreements: "Buscando en Convenios…",
  person: "Buscando a la persona en el Registro Único…",
  cases: "Buscando en Expedientes…",
  social: "Buscando en el Registro Único…",
  crossing: "Cruzando programas…",
  supplies: "Buscando en Stock…",
  nearby: "Buscando en el Mapa Social…",
  search: "Buscando en toda la app…",
};

export const WRITING_STATUS = "Escribiendo la respuesta…";

/** La pregunta en minúsculas y también sin tildes, para buscar palabras ("órdenes" también encuentra "orden"). */
export function routingText(query: string): string {
  const q = query.toLowerCase().trim();
  return `${q} ${q.normalize("NFD").replace(/[̀-ͯ]/g, "")}`;
}

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));

const COMMAND = ["tarea", "recordatorio", "agendar", "reservar", "reserva", "evento", "reunion", "reunión", "cita", "turno"];
const CREATE = ["crear", "agend", "program", "añadir", "agregar", "hacer", "reserv", "pon"];
const CHART = ["gráfico", "grafico", "chart", "dibujar"];
const DOCUMENTS = ["pdf", "documento", "archivo", "leé", "lee", "informe", "adjunto", "ordenanza", "decreto", "pliego", "resolución", "resolucion"];
const LEAVES = ["licencia", "vacacion", "ausen"];
const COURSES = ["curso", "talleres", "inscript"];
const EXPIRING = ["vence", "vencid", "vencimiento", "por vencer"];
const PERSON_DOCS = ["cud", "certificado", "documento", "papeles"];
const BARRIOS = ["barrio"];
const HR = ["sueldo", "salario", "rrhh", "recursos humanos", "personal", "empleado", "agente", "contrato", "nómina", "nomina"];
const BUDGET = ["orden", "compras", "gasto", "presupuesto", "comprar", "monto", "factura"];
const VEHICLES = ["vehiculo", "vehículo", "auto", "camioneta", "flota", "taller", "reserva", "combustible", "nafta", "litro"];
const AGREEMENTS = ["convenio", "acuerdo", "parties", "institucional"];
const CASES = ["expediente"];
const SOCIAL = [
  "caso", "urgente", "critico", "crítico", "social", "familia", "persona", "ciudadano", "deriva", "abierto", "registro",
  "apellido", "nombre", "letra", "buscar", "consultar",
];
const CROSSING = ["ficha social", "ficha 360", "cruce de datos", "cruce de programas", "programas sociales", "matriz de cruce"];
const SUPPLIES = ["insumo", "stock", "inventario", "deposito", "depósito"];
const NEARBY = ["metro", "metros", "cerca", "radio", "proximidad", "cuadra", "cuadras", "distancia"];

/** Si la pregunta pide crear algo (una tarea, una reserva), en vez de consultar. */
export function isCreationRequest(text: string): boolean {
  return has(text, COMMAND) && has(text, CREATE);
}

/** ¿Hace falta buscar a la persona por su nombre antes de elegir? (No para gráficos, pedidos ni documentos.) */
export function needsPersonLookup(text: string): boolean {
  return !has(text, CHART) && !isCreationRequest(text) && !has(text, DOCUMENTS);
}

/**
 * Elige dónde buscar. `text` es el de `routingText`. `personFound` dice si la pregunta nombra a alguien del padrón.
 * El orden importa: lo más preciso va primero ("cursos y talleres" son cursos, no el taller de los vehículos).
 */
export function pickRoute(text: string, personFound = false): AssistantRoute {
  if (has(text, CHART)) return "chart";
  if (isCreationRequest(text)) return "command";
  if (has(text, EXPIRING) && has(text, PERSON_DOCS)) return "expiring_documents";
  if (has(text, DOCUMENTS)) return "documents";
  if (has(text, LEAVES) && !text.includes("conducir")) return "leaves";
  if (text.includes("tarea")) return "tasks";
  if (has(text, COURSES)) return "courses";
  if (text.includes("programa") && !has(text, CROSSING)) return "programs";
  if (has(text, BARRIOS)) return "barrios";
  if (has(text, HR)) return "hr";
  if (has(text, BUDGET)) return "budget";
  if (has(text, VEHICLES)) return "vehicles";
  if (has(text, AGREEMENTS)) return "agreements";
  if (personFound) return "person";
  if (has(text, CROSSING)) return "crossing";
  if (has(text, CASES)) return "cases";
  if (has(text, SOCIAL)) return "social";
  if (has(text, SUPPLIES)) return "supplies";
  if (has(text, NEARBY)) return "nearby";
  return "search";
}
