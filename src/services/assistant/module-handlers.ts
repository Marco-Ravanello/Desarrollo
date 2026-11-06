import prisma from "@/lib/prisma";
import { formatNumber, plural } from "@/lib/formato";
import { diaAR } from "@/lib/fechas";
import { getAreaOverview } from "@/services/dashboard";
import { getStaffAwayToday } from "@/services/hr";
import { getProgramSummaries } from "@/services/programs";
import { getBarrioSummaries } from "@/services/barrios";
import { getCursos } from "@/services/cursos";
import { listExpiringDocuments } from "@/services/document-expiry";
import { EXPIRY_WARN_DAYS, documentKindLabel } from "@/lib/document-kinds";
import { AREA_NOTE, NO_AREA_ANSWER, programVisible, scopeWithoutArea, type AssistantScope } from "@/lib/assistant-scope";
import { answerLink, answerStat } from "@/lib/assistant-text";
import type { AIResponse } from "./types";

// Respuestas del asistente para las partes nuevas de la app: expedientes, licencias, programas, barrios,
// cursos, tareas y documentos por vencer. Usan las mismas consultas que las pantallas, así los números coinciden.

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
  for (const r of rows.sort((a, b) => b.open - a.open)) {
    answer += `| ${answerLink(r.name, `/cases?status=ACTIVOS&area=${r.id}`)} | ${formatNumber(r.open)} | ${formatNumber(r.urgent)} | ${formatNumber(r.stale)} |\n`;
  }
  const actions = [nav("Ver expedientes abiertos", "/cases")];
  if (urgent) actions.push(nav("Ver los urgentes", "/cases?priority=URGENTE"));
  if (stale) actions.push(nav("Ver los que no se mueven", "/cases?quiet=1"));
  const stats = [
    answerStat("Abiertos", open, { href: "/cases?status=ACTIVOS" }),
    answerStat("Urgentes", urgent, { href: "/cases?status=ACTIVOS&priority=URGENTE", attention: true }),
    answerStat("Sin movimiento hace 30 días", stale, { href: "/cases?quiet=1", attention: true }),
  ];
  return { intent: "cases_summary", answer: answer.trim() + areaNote(scope), dataSummary: { hasResults: true, stats, sources: [], actions } };
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
      answer += `| ${answerLink(a.name, `/admin/hr/${a.id}`)} | ${cell(a.area ?? "Sin área")} | ${label[a.status] ?? "Licencia"} | ${vuelve} |\n`;
    }
    if (away.length > 30) answer += `\nY ${plural(away.length - 30, "persona")} más.\n`;
  }
  if (expired > 0) {
    answer += `\n\n${expired === 1 ? "1 persona terminó su licencia" : `${formatNumber(expired)} personas terminaron su licencia`} y falta confirmar que ${expired === 1 ? "volvió" : "volvieron"}.`;
  }
  const actions = [nav("Ver Ausencias del mes", "/admin/hr/ausencias")];
  if (expired > 0) actions.push(nav("Confirmar las vueltas", "/admin/hr?status=volver"));
  const stats = [answerStat("Faltan hoy", away.length, { href: "/admin/hr/ausencias" })];
  if (expired > 0) stats.push(answerStat("Falta confirmar la vuelta", expired, { href: "/admin/hr?status=volver", attention: true }));
  return { intent: "leaves_query", answer: answer.trim(), dataSummary: { hasResults: away.length > 0 || expired > 0, stats, sources: [], actions } };
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
  for (const p of programs) answer += `| ${answerLink(p.label, `/people/programas/${p.slug}`)} | ${formatNumber(p.people)} | ${formatNumber(p.altas)} | ${formatNumber(p.bajas)} |\n`;
  answer += `\nUna persona puede estar en más de un programa.`;
  if (scope.areaId) answer += ` Te muestro los programas a cargo de tu área y los que no tienen un área a cargo.`;
  const stats = [
    answerStat("Programas con personas", programs.filter((p) => p.people > 0).length, { href: "/people/programas" }),
    answerStat("Altas en 30 días", programs.reduce((n, p) => n + p.altas, 0)),
    answerStat("Bajas en 30 días", programs.reduce((n, p) => n + p.bajas, 0)),
  ];
  return { intent: "programs_query", answer, dataSummary: { hasResults: true, stats, sources: [], actions: [nav("Ver Programas", "/people/programas")] } };
}

/** Personas del padrón, con programas y expedientes abiertos en cada uno de los 29 barrios. */
export async function handleBarriosQuery(scope: AssistantScope): Promise<AIResponse> {
  const { barrios, withoutBarrio } = await getBarrioSummaries({ canViewSensitive: scope.canViewSensitive, areaId: scope.areaId });
  const rows = barrios.filter((b) => b.people > 0 || b.openCases > 0).sort((a, b) => b.people - a.people);
  if (rows.length === 0) {
    return { intent: "barrios_query", answer: "Todavía no hay personas del padrón ubicadas en los barrios.", dataSummary: { hasResults: false, actions: [nav("Ir a Barrios", "/barrios")] } };
  }
  let answer = `### Barrios\n\n| Barrio | Personas | Con programas | Expedientes abiertos |\n| :--- | ---: | ---: | ---: |\n`;
  for (const b of rows) answer += `| ${answerLink(b.barrio, `/barrios/${b.slug}`)} | ${formatNumber(b.people)} | ${formatNumber(b.withPrograms)} | ${formatNumber(b.openCases)} |\n`;
  if (withoutBarrio > 0) answer += `\n${plural(withoutBarrio, "persona")} del padrón no ${withoutBarrio === 1 ? "tiene" : "tienen"} un barrio de la lista.`;
  if (scope.areaId) answer += `\n\nLas personas son de todo el padrón; los expedientes abiertos, solo los de tu área.`;
  const stats = [
    answerStat("Personas en los barrios", rows.reduce((n, b) => n + b.people, 0)),
    answerStat("Con programas", rows.reduce((n, b) => n + b.withPrograms, 0)),
    answerStat("Expedientes abiertos", rows.reduce((n, b) => n + b.openCases, 0)),
  ];
  return { intent: "barrios_query", answer: answer.trim(), dataSummary: { hasResults: true, stats, sources: [], actions: [nav("Ver Barrios", "/barrios")] } };
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
    answer += `| ${answerLink(c.nombre, `/cursos/${c.id}`)} | ${cell(c.lugar ?? "Sin lugar")} | ${formatNumber(c.inscriptos)} | ${c.asistencia === null ? "Sin clases" : `${c.asistencia} %`} |\n`;
  }
  const stats = [answerStat("Cursos abiertos", cursos.length, { href: "/cursos" }), answerStat("Personas inscriptas", inscriptos)];
  return { intent: "courses_query", answer: answer.trim() + areaNote(scope), dataSummary: { hasResults: true, stats, sources: [], actions: [nav("Ver Cursos y talleres", "/cursos")] } };
}

/** Las tareas sin terminar de quien pregunta: atrasadas, de hoy y de los próximos 7 días. */
export async function handleMyTasksQuery(user: { id?: string | null }, now = new Date()): Promise<AIResponse> {
  if (!user.id) return { intent: "tasks_query", answer: "Tu sesión expiró. Volvé a iniciar sesión." };
  const today = diaAR(now);
  const tasks = await prisma.task.findMany({
    where: { userId: user.id, status: { not: "COMPLETADA" } },
    select: { id: true, title: true, dueDate: true, caseId: true },
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
    items.length ? `#### ${title} (${items.length})\n${items.slice(0, 10).map((t) => `- ${t.caseId ? answerLink(t.title, `/cases/${t.caseId}`) : t.title}${t.dueDate ? ` · ${ddmm(new Date(`${day(t.dueDate)}T00:00:00Z`))}` : ""}`).join("\n")}\n\n` : "";
  let answer = `### Mis tareas\n\nTenés **${plural(tasks.length, "tarea pendiente", "tareas pendientes")}**.\n\n`;
  answer += list("Atrasadas", late) + list("Para hoy", forToday) + list("En los próximos 7 días", soon);
  if (undated) answer += `${plural(undated, "tarea", "tareas")} sin fecha.`;
  const stats = [
    answerStat("Pendientes", tasks.length, { href: "/tasks" }),
    answerStat("Atrasadas", late.length, { href: "/tasks", attention: true }),
    answerStat("Para hoy", forToday.length, { href: "/tasks" }),
  ];
  return { intent: "tasks_query", answer: answer.trim(), dataSummary: { hasResults: true, stats, sources: [], actions: [nav("Ir a Mis tareas", "/tasks")] } };
}

/** Los documentos de las personas (el CUD, por ejemplo) que vencen en los próximos 60 días y los que ya vencieron. */
export async function handleExpiringDocumentsQuery(scope: AssistantScope, today = diaAR(new Date())): Promise<AIResponse> {
  const { docs, porVencer, vencidos } = await listExpiringDocuments(scope.role, "por-vencer", today);
  const actions = [nav("Ver Documentos por vencer", "/people/vencimientos")];
  if (vencidos) actions.push(nav("Ver los vencidos", "/people/vencimientos?vista=vencidos"));
  const stats = [
    answerStat("Vencen en 60 días", porVencer, { href: "/people/vencimientos" }),
    answerStat("Vencidos en el último año", vencidos, { href: "/people/vencimientos?vista=vencidos", attention: true }),
  ];
  if (porVencer === 0) {
    const answer = `### Documentos por vencer\n\nNo hay documentos que venzan en los próximos ${EXPIRY_WARN_DAYS} días.${vencidos ? ` Hay ${plural(vencidos, "documento vencido", "documentos vencidos")} en el último año.` : ""}`;
    return { intent: "expiring_documents", answer, dataSummary: { hasResults: vencidos > 0, stats, sources: [], actions } };
  }
  let answer = `### Documentos por vencer\n\nEn los próximos ${EXPIRY_WARN_DAYS} días vencen **${plural(porVencer, "documento", "documentos")}**${vencidos ? `, y hay ${plural(vencidos, "vencido", "vencidos")} en el último año` : ""}.\n\n`;
  answer += `| Persona | Documento | Vence |\n| :--- | :--- | :--- |\n`;
  for (const d of docs.slice(0, 15)) {
    answer += `| ${answerLink(d.persona, `/people/${d.dni}?tab=documentos&doc=${d.id}`)} | ${cell(d.kind ? documentKindLabel(d.kind) : d.name)} | ${ddmm(new Date(`${d.expiresAt}T00:00:00Z`))} |\n`;
  }
  if (docs.length > 15) answer += `\nY ${plural(docs.length - 15, "documento más", "documentos más")} en la lista.`;
  return { intent: "expiring_documents", answer: answer.trim(), dataSummary: { hasResults: true, stats, sources: [], actions } };
}
