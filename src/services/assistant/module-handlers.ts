import prisma from "@/lib/prisma";
import { formatNumber, plural } from "@/lib/formato";
import { diaAR } from "@/lib/fechas";
import { getAreaOverview } from "@/services/dashboard";
import { getStaffAwayToday } from "@/services/hr";
import { getProgramSummaries } from "@/services/programs";
import { getBarrioSummaries } from "@/services/barrios";
import { getCursos } from "@/services/cursos";
import { AREA_NOTE, NO_AREA_ANSWER, programVisible, scopeWithoutArea, type AssistantScope } from "@/lib/assistant-scope";
import type { AIResponse } from "./types";

// Respuestas del asistente para las partes nuevas de la app: expedientes, licencias, programas, barrios,
// cursos y tareas. Usan las mismas consultas que las pantallas, así los números coinciden.

const areaNote = (scope: AssistantScope) => (scope.areaId ? `\n\n${AREA_NOTE}` : "");
const noArea = (intent: string): AIResponse => ({ intent, answer: NO_AREA_ANSWER, dataSummary: { hasResults: false } });
const nav = (label: string, path: string) => ({ label, actionType: "NAVIGATE", payload: { path } });
const cell = (s: string) => s.replace(/\|/g, "/");
const ddmm = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join("/");

/** Expedientes sin cerrar: total, urgentes y quietos, por área. Solo números, sin nombres ni textos. */
export async function handleCasesSummary(scope: AssistantScope): Promise<AIResponse> {
  if (scopeWithoutArea(scope)) return noArea("cases_summary");
  const rows = (await getAreaOverview({ areaId: scope.areaId, canViewSensitive: scope.canViewSensitive })).filter((r) => r.open > 0);
  const open = rows.reduce((n, r) => n + r.open, 0);
  const urgent = rows.reduce((n, r) => n + r.urgent, 0);
  const stale = rows.reduce((n, r) => n + r.stale, 0);
  if (open === 0) {
    return { intent: "cases_summary", answer: "No hay expedientes abiertos en este momento.", dataSummary: { hasResults: false, actions: [nav("Ir a Expedientes", "/cases")] } };
  }
  let answer = `### Expedientes abiertos\n\nHay **${plural(open, "expediente abierto")}**: ${plural(urgent, "urgente")} y ${plural(stale, "sin movimiento", "sin movimiento")} hace 30 días o más.\n\n`;
  answer += `| Área | Abiertos | Urgentes | Sin movimiento |\n| :--- | ---: | ---: | ---: |\n`;
  for (const r of rows.sort((a, b) => b.open - a.open)) answer += `| ${cell(r.name)} | ${formatNumber(r.open)} | ${formatNumber(r.urgent)} | ${formatNumber(r.stale)} |\n`;
  const actions = [nav("Ver expedientes abiertos", "/cases")];
  if (urgent) actions.push(nav("Ver los urgentes", "/cases?priority=URGENTE"));
  if (stale) actions.push(nav("Ver los que no se mueven", "/cases?quiet=1"));
  return { intent: "cases_summary", answer: answer.trim() + areaNote(scope), dataSummary: { hasResults: true, sources: [], actions } };
}

/** Quién está de licencia o de vacaciones hoy, y cuántas vueltas faltan confirmar. */
export async function handleLeavesQuery(): Promise<AIResponse> {
  const { away, expired } = await getStaffAwayToday();
  const label: Record<string, string> = { LICENCIA: "Licencia", LICENCIA_SIN_GOCE: "Licencia sin goce", VACACIONES: "Vacaciones" };
  let answer = "";
  if (away.length === 0) {
    answer = "### Licencias y vacaciones\n\nHoy no hay nadie de licencia ni de vacaciones.";
  } else {
    answer = `### Licencias y vacaciones\n\nHoy ${away.length === 1 ? "falta 1 persona" : `faltan ${formatNumber(away.length)} personas`}.\n\n`;
    answer += `| Persona | Área | Situación | Hasta |\n| :--- | :--- | :--- | :--- |\n`;
    for (const a of away.slice(0, 30)) {
      const vuelve = a.until ? `${a.until.split("-").reverse().join("/")}` : "Sin fecha";
      answer += `| ${cell(a.name)} | ${cell(a.area ?? "Sin área")} | ${label[a.status] ?? "Licencia"} | ${vuelve} |\n`;
    }
    if (away.length > 30) answer += `\nY ${plural(away.length - 30, "persona")} más.\n`;
  }
  if (expired > 0) {
    answer += `\n\n${expired === 1 ? "1 persona terminó su licencia" : `${formatNumber(expired)} personas terminaron su licencia`} y falta confirmar que ${expired === 1 ? "volvió" : "volvieron"}.`;
  }
  const actions = [nav("Ver Ausencias del mes", "/admin/hr/ausencias")];
  if (expired > 0) actions.push(nav("Confirmar las vueltas", "/admin/hr?status=volver"));
  const sources = away.slice(0, 8).map((a) => ({ type: "Recursos Humanos", name: a.name, url: `/admin/hr/${a.id}` }));
  return { intent: "leaves_query", answer: answer.trim(), dataSummary: { hasResults: away.length > 0 || expired > 0, sources, actions } };
}

/** Cuántas personas hay en cada programa, con las altas y bajas de los últimos 30 días. */
export async function handleProgramsQuery(scope: AssistantScope): Promise<AIResponse> {
  // El Director ve los programas a cargo de su área y los que no tienen un área a cargo.
  const programs = (await getProgramSummaries())
    .filter((p) => programVisible(scope, p.owner?.areaId))
    .filter((p) => p.people > 0 || p.altas > 0 || p.bajas > 0)
    .sort((a, b) => b.people - a.people);
  if (programs.length === 0) {
    return { intent: "programs_query", answer: "Todavía no hay personas cargadas en ningún programa.", dataSummary: { hasResults: false, actions: [nav("Ir a Programas", "/people/programas")] } };
  }
  let answer = `### Personas en cada programa\n\n| Programa | Personas | Altas (30 días) | Bajas (30 días) |\n| :--- | ---: | ---: | ---: |\n`;
  for (const p of programs) answer += `| ${cell(p.label)} | ${formatNumber(p.people)} | ${formatNumber(p.altas)} | ${formatNumber(p.bajas)} |\n`;
  answer += `\nUna persona puede estar en más de un programa.`;
  if (scope.areaId) answer += ` Te muestro los programas a cargo de tu área y los que no tienen un área a cargo.`;
  const sources = programs.slice(0, 6).map((p) => ({ type: "Programa", name: p.label, url: `/people/programas/${p.slug}` }));
  return { intent: "programs_query", answer, dataSummary: { hasResults: true, sources, actions: [nav("Ver Programas", "/people/programas")] } };
}

/** Personas del padrón, con programas y expedientes abiertos en cada uno de los 29 barrios. */
export async function handleBarriosQuery(scope: AssistantScope): Promise<AIResponse> {
  const { barrios, withoutBarrio } = await getBarrioSummaries({ canViewSensitive: scope.canViewSensitive, areaId: scope.areaId });
  const rows = barrios.filter((b) => b.people > 0 || b.openCases > 0).sort((a, b) => b.people - a.people);
  if (rows.length === 0) {
    return { intent: "barrios_query", answer: "Todavía no hay personas del padrón ubicadas en los barrios.", dataSummary: { hasResults: false, actions: [nav("Ir a Barrios", "/barrios")] } };
  }
  let answer = `### Barrios\n\n| Barrio | Personas | Con programas | Expedientes abiertos |\n| :--- | ---: | ---: | ---: |\n`;
  for (const b of rows) answer += `| ${cell(b.barrio)} | ${formatNumber(b.people)} | ${formatNumber(b.withPrograms)} | ${formatNumber(b.openCases)} |\n`;
  if (withoutBarrio > 0) answer += `\n${plural(withoutBarrio, "persona")} del padrón no ${withoutBarrio === 1 ? "tiene" : "tienen"} un barrio de la lista.`;
  if (scope.areaId) answer += `\n\nLas personas son de todo el padrón; los expedientes abiertos, solo los de tu área.`;
  const sources = rows.slice(0, 6).map((b) => ({ type: "Barrio", name: b.barrio, url: `/barrios/${b.slug}` }));
  return { intent: "barrios_query", answer: answer.trim(), dataSummary: { hasResults: true, sources, actions: [nav("Ver Barrios", "/barrios")] } };
}

/** Los cursos y talleres abiertos, con inscriptos y asistencia. */
export async function handleCoursesQuery(scope: AssistantScope): Promise<AIResponse> {
  // El Director ve los cursos de su área y los que no tienen área.
  const cursos = (await getCursos({ estado: "ABIERTO" })).filter((c) => !scope.areaId || !c.areaId || c.areaId === scope.areaId);
  if (cursos.length === 0) {
    return { intent: "courses_query", answer: "No hay cursos ni talleres abiertos en este momento.", dataSummary: { hasResults: false, actions: [nav("Ir a Cursos y talleres", "/cursos")] } };
  }
  const inscriptos = cursos.reduce((n, c) => n + c.inscriptos, 0);
  let answer = `### Cursos y talleres abiertos\n\nHay **${plural(cursos.length, "curso abierto", "cursos abiertos")}** con ${plural(inscriptos, "persona inscripta", "personas inscriptas")}.\n\n`;
  answer += `| Curso | Lugar | Inscriptos | Asistencia |\n| :--- | :--- | ---: | ---: |\n`;
  for (const c of cursos.slice(0, 25)) {
    answer += `| ${cell(c.nombre)} | ${cell(c.lugar ?? "Sin lugar")} | ${formatNumber(c.inscriptos)} | ${c.asistencia === null ? "Sin clases" : `${c.asistencia} %`} |\n`;
  }
  const sources = cursos.slice(0, 6).map((c) => ({ type: "Curso", name: c.nombre, url: `/cursos/${c.id}` }));
  return { intent: "courses_query", answer: answer.trim() + areaNote(scope), dataSummary: { hasResults: true, sources, actions: [nav("Ver Cursos y talleres", "/cursos")] } };
}

/** Las tareas sin terminar de quien pregunta: atrasadas, de hoy y de los próximos 7 días. */
export async function handleMyTasksQuery(user: { id?: string | null }, now = new Date()): Promise<AIResponse> {
  if (!user.id) return { intent: "tasks_query", answer: "Tu sesión expiró. Volvé a iniciar sesión." };
  const today = diaAR(now);
  const tasks = await prisma.task.findMany({
    where: { userId: user.id, status: { not: "COMPLETADA" } },
    select: { id: true, title: true, dueDate: true },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
    take: 200,
  });
  const day = (d: Date | null) => (d ? diaAR(d) : null);
  const in7 = diaAR(new Date(now.getTime() + 7 * 86400000));
  const late = tasks.filter((t) => day(t.dueDate) && day(t.dueDate)! < today);
  const forToday = tasks.filter((t) => day(t.dueDate) === today);
  const soon = tasks.filter((t) => day(t.dueDate) && day(t.dueDate)! > today && day(t.dueDate)! <= in7);
  const undated = tasks.filter((t) => !t.dueDate).length;
  if (tasks.length === 0) {
    return { intent: "tasks_query", answer: "### Mis tareas\n\nNo tenés tareas pendientes.", dataSummary: { hasResults: false, actions: [nav("Ir a Mis tareas", "/tasks")] } };
  }
  const list = (title: string, items: typeof tasks) =>
    items.length ? `#### ${title} (${items.length})\n${items.slice(0, 10).map((t) => `- ${t.title}${t.dueDate ? ` · ${ddmm(new Date(`${day(t.dueDate)}T00:00:00Z`))}` : ""}`).join("\n")}\n\n` : "";
  let answer = `### Mis tareas\n\nTenés **${plural(tasks.length, "tarea pendiente", "tareas pendientes")}**.\n\n`;
  answer += list("Atrasadas", late) + list("Para hoy", forToday) + list("En los próximos 7 días", soon);
  if (undated) answer += `${plural(undated, "tarea", "tareas")} sin fecha.`;
  return { intent: "tasks_query", answer: answer.trim(), dataSummary: { hasResults: true, sources: [], actions: [nav("Ir a Mis tareas", "/tasks")] } };
}
