import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ACTIVE_CASE_STATUSES } from "@/lib/case-urgency";
import { CASE_LABELS, caseLabelName } from "@/lib/case-labels";
import { CASE_STATUS_LABEL, staleCutoff } from "@/lib/case-summary";
import { formatNumber, plural } from "@/lib/formato";
import { diaAR } from "@/lib/fechas";
import { AREA_NOTE, NO_AREA_ANSWER, scopedAreaWhere, scopedCaseWhere, scopeWithoutArea, type AssistantScope } from "@/lib/assistant-scope";
import { matchAreaName, type ToolArgs } from "@/lib/assistant-tools";
import type { AIResponse } from "./types";
import { handleCasesSummary } from "./module-handlers";

// La consulta "expedientes" del asistente: cuenta con los filtros que eligió Gemini (o que salieron de la
// pregunta) y separa por área, prioridad, estado, etiqueta, mes, edad, género o profesional a cargo.
// Solo números y nombres de área o de profesional: nunca títulos ni datos de las personas.

const PRIORITY_ORDER = ["URGENTE", "ALTA", "MEDIA", "BAJA"];
const PRIORITY_LABEL: Record<string, string> = { URGENTE: "Urgente", ALTA: "Alta", MEDIA: "Media", BAJA: "Baja" };
const GROUP_TITLE: Record<string, string> = {
  area: "Área",
  prioridad: "Prioridad",
  estado: "Estado",
  etiqueta: "Etiqueta",
  mes: "Mes",
  edad: "Edad de la persona",
  genero: "Género",
  a_cargo: "Profesional a cargo",
};
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
/** Para agrupar por mes, edad o género se leen las fechas de a lo sumo esta cantidad de expedientes. */
const MAX_ROWS = 50000;

const nav = (label: string, path: string) => ({ label, actionType: "NAVIGATE", payload: { path } });
const cell = (s: string) => s.replace(/\|/g, "/");
const ddmmyyyy = (iso: string) => iso.split("-").reverse().join("/");

function ageBucket(birth: Date | null, now: Date): string {
  if (!birth) return "Sin fecha de nacimiento";
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  if (age <= 12) return "0 a 12 años";
  if (age <= 17) return "13 a 17 años";
  if (age <= 29) return "18 a 29 años";
  if (age <= 59) return "30 a 59 años";
  return "60 años o más";
}
const AGE_ORDER = ["0 a 12 años", "13 a 17 años", "18 a 29 años", "30 a 59 años", "60 años o más", "Sin fecha de nacimiento"];

function genderLabel(g: string | null): string {
  const v = (g ?? "").toUpperCase();
  return v === "FEMENINO" ? "Femenino" : v === "MASCULINO" ? "Masculino" : v === "OTRO" ? "Otro" : "Sin dato";
}

export async function handleCasesTool(args: ToolArgs, scope: AssistantScope, now = new Date()): Promise<AIResponse> {
  if (scopeWithoutArea(scope)) return { intent: "cases_query", answer: NO_AREA_ANSWER, dataSummary: { hasResults: false } };

  const filterKeys = ["prioridad", "area", "etiqueta", "desde", "hasta", "sin_movimiento", "sin_asignar"];
  const hasFilters = filterKeys.some((k) => args[k] !== undefined && args[k] !== false);
  const estado = typeof args.estado === "string" ? args.estado : "abiertos";
  const group = typeof args.agrupar_por === "string" ? args.agrupar_por : null;
  const wantsChart = args.grafico === true;

  // Sin filtros ni agrupación, el resumen de siempre: abiertos, urgentes y quietos por área.
  if (!hasFilters && !group && !wantsChart && estado === "abiertos") return handleCasesSummary(scope);

  const areas = await prisma.area.findMany({ where: scopedAreaWhere(scope), select: { id: true, name: true }, orderBy: { name: "asc" } });
  const and: Prisma.CaseWhereInput[] = [scopedCaseWhere(scope)];
  const described: string[] = [];
  const listParams = new URLSearchParams();

  if (estado === "abiertos") {
    and.push({ status: { in: [...ACTIVE_CASE_STATUSES] } });
    listParams.set("status", "ACTIVOS");
  } else if (estado === "cerrados") {
    and.push({ status: "CERRADO" });
    listParams.set("status", "CERRADO");
  } else if (estado === "derivados") {
    and.push({ status: "DERIVADO" });
    listParams.set("status", "DERIVADO");
  }
  if (typeof args.prioridad === "string") {
    and.push({ priority: args.prioridad as any });
    described.push(`de prioridad ${PRIORITY_LABEL[args.prioridad]?.toLowerCase() ?? args.prioridad}`);
    listParams.set("priority", args.prioridad);
  }
  if (typeof args.area === "string") {
    const area = matchAreaName(args.area, areas);
    if (!area) {
      const answer = scope.limitedToArea
        ? `Solo puedo mostrarte los expedientes de tu área, como en el resto de la app.`
        : `No encontré el área "${args.area}". Las áreas son: ${areas.map((a) => a.name).join(", ")}.`;
      return { intent: "cases_query", answer, dataSummary: { hasResults: false } };
    }
    and.push({ areaId: area.id });
    described.push(`de ${area.name}`);
    listParams.set("area", area.id);
  }
  if (typeof args.etiqueta === "string") {
    and.push({ labels: { has: args.etiqueta } });
    described.push(`con la etiqueta ${caseLabelName(args.etiqueta) ?? args.etiqueta}`);
    listParams.set("label", args.etiqueta);
  }
  if (typeof args.desde === "string") {
    and.push({ createdAt: { gte: new Date(`${args.desde}T00:00:00-03:00`) } });
  }
  if (typeof args.hasta === "string") {
    and.push({ createdAt: { lte: new Date(`${args.hasta}T23:59:59.999-03:00`) } });
  }
  if (args.desde || args.hasta) {
    described.push(
      args.desde && args.hasta
        ? `abiertos entre el ${ddmmyyyy(String(args.desde))} y el ${ddmmyyyy(String(args.hasta))}`
        : args.desde
          ? `abiertos desde el ${ddmmyyyy(String(args.desde))}`
          : `abiertos hasta el ${ddmmyyyy(String(args.hasta))}`
    );
  }
  if (args.sin_movimiento === true) {
    const cutoff = staleCutoff(now);
    and.push({ status: { not: "CERRADO" }, createdAt: { lt: cutoff }, interventions: { none: { date: { gte: cutoff } } } });
    described.push("sin movimiento hace 30 días o más");
    listParams.set("quiet", "1");
  }
  if (args.sin_asignar === true) {
    and.push({ assignedToId: null });
    described.push("sin profesional a cargo");
    listParams.set("assigned", "none");
  }

  const where: Prisma.CaseWhereInput = { AND: and };
  const total = await prisma.case.count({ where });
  const stateWord = estado === "abiertos" ? "abierto" : estado === "cerrados" ? "cerrado" : estado === "derivados" ? "derivado" : "";
  const noun = stateWord ? plural(total, `expediente ${stateWord}`, `expedientes ${stateWord}s`) : plural(total, "expediente");
  const filtersText = described.length ? ` ${described.join(", ")}` : "";
  let answer = `### Expedientes\n\nHay **${noun}**${filtersText}.`;

  let rows: { name: string; value: number }[] = [];
  const chosenGroup = group ?? (wantsChart ? "area" : null);
  if (total > 0 && chosenGroup) rows = await groupCases(chosenGroup, where, areas, now);

  if (rows.length) {
    answer += `\n\n| ${GROUP_TITLE[chosenGroup!]} | Expedientes |\n| :--- | ---: |\n`;
    for (const r of rows) answer += `| ${cell(r.name)} | ${formatNumber(r.value)} |\n`;
    if (chosenGroup === "etiqueta") answer += `\nUn expediente puede tener más de una etiqueta.`;
    if ((chosenGroup === "mes" || chosenGroup === "edad" || chosenGroup === "genero") && total > MAX_ROWS) {
      answer += `\nCuento los ${formatNumber(MAX_ROWS)} más nuevos.`;
    }
  }
  if (scope.areaId) answer += `\n\n${AREA_NOTE}`;

  const chart =
    wantsChart && rows.length
      ? {
          type: chosenGroup === "estado" || chosenGroup === "genero" ? "pie" : "bar",
          title: `Expedientes${stateWord ? ` ${stateWord}s` : ""} por ${GROUP_TITLE[chosenGroup!].toLowerCase()}`,
          color: "#1e3a8a",
          data: rows,
        }
      : undefined;

  return {
    intent: wantsChart ? "chart_render" : "cases_query",
    answer: answer.trim(),
    dataSummary: {
      hasResults: total > 0,
      total,
      ...(chart ? { chart } : {}),
      sources: [],
      actions: [nav("Ver estos expedientes", `/cases${listParams.size ? `?${listParams.toString()}` : ""}`)],
    },
  };
}

async function groupCases(group: string, where: Prisma.CaseWhereInput, areas: { id: string; name: string }[], now: Date) {
  if (group === "area") {
    const g = await prisma.case.groupBy({ by: ["areaId"], where, _count: { _all: true } });
    return areas
      .map((a) => ({ name: a.name, value: g.find((r) => r.areaId === a.id)?._count._all ?? 0 }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }
  if (group === "prioridad") {
    const g = await prisma.case.groupBy({ by: ["priority"], where, _count: { _all: true } });
    return PRIORITY_ORDER.map((p) => ({ name: PRIORITY_LABEL[p], value: g.find((r) => r.priority === p)?._count._all ?? 0 })).filter((r) => r.value > 0);
  }
  if (group === "estado") {
    const g = await prisma.case.groupBy({ by: ["status"], where, _count: { _all: true } });
    return g.map((r) => ({ name: (CASE_STATUS_LABEL as Record<string, string>)[r.status] ?? r.status, value: r._count._all })).sort((a, b) => b.value - a.value);
  }
  if (group === "etiqueta") {
    const counts = await Promise.all([
      ...CASE_LABELS.map((l) => prisma.case.count({ where: { AND: [where, { labels: { has: l.key } }] } })),
      prisma.case.count({ where: { AND: [where, { labels: { isEmpty: true } }] } }),
    ]);
    return [...CASE_LABELS.map((l, i) => ({ name: l.label, value: counts[i] })), { name: "Sin etiqueta", value: counts[CASE_LABELS.length] }].filter((r) => r.value > 0);
  }
  if (group === "a_cargo") {
    const g = await prisma.case.groupBy({ by: ["assignedToId"], where, _count: { _all: true } });
    const users = await prisma.user.findMany({
      where: { id: { in: g.map((r) => r.assignedToId).filter((x): x is string => Boolean(x)) } },
      select: { id: true, name: true, username: true },
    });
    return g
      .map((r) => {
        const u = users.find((x) => x.id === r.assignedToId);
        return { name: r.assignedToId ? u?.name || u?.username || "Otra persona" : "Sin profesional a cargo", value: r._count._all };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 30);
  }

  const cases = await prisma.case.findMany({
    where,
    select: { createdAt: true, person: { select: { birthDate: true, gender: true } } },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
  });
  const counts = new Map<string, number>();
  const add = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1);
  if (group === "mes") {
    for (const c of cases) add(diaAR(c.createdAt).slice(0, 7));
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-24)
      .map(([ym, value]) => ({ name: `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`, value }));
  }
  if (group === "edad") {
    for (const c of cases) add(ageBucket(c.person?.birthDate ?? null, now));
    return AGE_ORDER.map((name) => ({ name, value: counts.get(name) ?? 0 })).filter((r) => r.value > 0);
  }
  for (const c of cases) add(genderLabel(c.person?.gender ?? null));
  return [...counts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}
