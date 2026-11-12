import type { Role } from "@prisma/client";
import { canEditSocialRecords, hasPermission, isEmergencySurveyor, PERMISSIONS } from "@/lib/permissions";
import { isSensitiveArea } from "@/lib/sensitive-areas";
import { splitCaseTitle } from "@/lib/case-summary";

// Corregir un expediente ya creado: carátula, descripción y prioridad (idea 121). Reglas sin base de datos.

export const CASE_TITLE_MAX = 200;
export const CASE_DESCRIPTION_MAX = 5000;

export type CasePriority = "BAJA" | "MEDIA" | "ALTA" | "URGENTE";

export const CASE_PRIORITIES: { value: CasePriority; label: string; dot: string }[] = [
  { value: "BAJA", label: "Baja", dot: "bg-slate-400" },
  { value: "MEDIA", label: "Media", dot: "bg-sky-500" },
  { value: "ALTA", label: "Alta", dot: "bg-amber-500" },
  { value: "URGENTE", label: "Urgente", dot: "bg-rose-600" },
];

const PRIORITY_WORD: Record<CasePriority, string> = { BAJA: "baja", MEDIA: "media", ALTA: "alta", URGENTE: "urgente" };

export const isCasePriority = (v: unknown): v is CasePriority =>
  typeof v === "string" && CASE_PRIORITIES.some((p) => p.value === v);

/**
 * Lo corrige quien carga expedientes (no Auditoría ni el relevador), mientras no esté cerrado.
 * Los de Violencia de Género, solo quien puede verlos.
 */
export function canEditCase(user: { role: Role }, caseItem: { status: string; areaName: string | null | undefined }): boolean {
  if (caseItem.status === "CERRADO") return false;
  if (!canEditSocialRecords(user.role) || isEmergencySurveyor(user.role)) return false;
  return !isSensitiveArea(caseItem.areaName) || hasPermission(user.role, PERMISSIONS.VIEW_SENSITIVE_CASES);
}

/**
 * Arma la carátula guardada a partir de la que se ve: si tenía una marca adelante
 * (por ejemplo "[CONTINGENCIA TORMENTA]"), la conserva.
 */
export function rebuildCaseTitle(storedTitle: string, shownTitle: string): string {
  const clean = shownTitle.trim();
  const { tag } = splitCaseTitle(storedTitle);
  if (!tag) return clean;
  const prefix = storedTitle.match(/^\s*\[[^\]]+\]/)?.[0]?.trim();
  if (!prefix || clean.toLowerCase().startsWith(prefix.toLowerCase())) return clean;
  return `${prefix} ${clean}`;
}

export type CaseEditInput = { title?: unknown; description?: unknown; priority?: unknown };
export type CaseEditCurrent = { title: string; description: string | null; priority: string };

export type CaseEditResult =
  | { ok: false; error: string }
  | { ok: true; changed: false }
  | { ok: true; changed: true; data: { title: string; description: string | null; priority: CasePriority }; details: string };

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
const quote = (s: string) => `“${oneLine(s)}”`;

/**
 * Revisa lo que se quiere cambiar y arma el texto que queda en la historia:
 * "Prioridad: media → urgente.", "Carátula: “…” → “…”." y "Corrigió la descripción.",
 * seguido de la descripción anterior, para que no se pierda.
 */
export function checkCaseEdit(current: CaseEditCurrent, input: CaseEditInput): CaseEditResult {
  const shownTitle = typeof input.title === "string" ? input.title.trim() : "";
  if (!shownTitle) return { ok: false, error: "Escribí la carátula del expediente." };
  if (shownTitle.length > CASE_TITLE_MAX) return { ok: false, error: `La carátula puede tener hasta ${CASE_TITLE_MAX} caracteres.` };

  const rawDescription = typeof input.description === "string" ? input.description.trim() : "";
  if (rawDescription.length > CASE_DESCRIPTION_MAX) {
    return { ok: false, error: `La descripción puede tener hasta ${CASE_DESCRIPTION_MAX} caracteres.` };
  }
  if (!isCasePriority(input.priority)) return { ok: false, error: "Elegí la prioridad." };

  const title = rebuildCaseTitle(current.title, shownTitle);
  const description = rawDescription || null;
  const priority = input.priority;
  const oldPriority = isCasePriority(current.priority) ? current.priority : "MEDIA";

  const lines: string[] = [];
  if (priority !== oldPriority) lines.push(`Prioridad: ${PRIORITY_WORD[oldPriority]} → ${PRIORITY_WORD[priority]}.`);
  if (oneLine(title) !== oneLine(current.title)) {
    lines.push(`Carátula: ${quote(splitCaseTitle(current.title).title)} → ${quote(shownTitle)}.`);
  }
  const oldDescription = current.description?.trim() || null;
  const descriptionChanged = (oldDescription ?? "") !== (description ?? "");
  if (descriptionChanged) {
    if (!description) lines.push("Borró la descripción.");
    else if (!oldDescription) lines.push("Agregó una descripción.");
    else lines.push("Corrigió la descripción.");
  }
  if (lines.length === 0) return { ok: true, changed: false };

  const details = descriptionChanged && oldDescription ? `${lines.join("\n")}\n${PREVIOUS_DESCRIPTION}${oldDescription}` : lines.join("\n");
  return { ok: true, changed: true, data: { title, description, priority }, details };
}

const PREVIOUS_DESCRIPTION = "Descripción anterior: ";

/** Para la historia: el resumen del cambio y, aparte, la descripción anterior (si la había). */
export function splitCaseEditDetails(details: string | null | undefined): { summary: string; previousDescription: string | null } {
  const text = details ?? "";
  const at = text.indexOf(`\n${PREVIOUS_DESCRIPTION}`);
  if (at === -1) return { summary: text, previousDescription: null };
  return { summary: text.slice(0, at), previousDescription: text.slice(at + 1 + PREVIOUS_DESCRIPTION.length) };
}

/** Título del movimiento en la historia, según qué se cambió. */
export function caseEditTitle(summary: string): string {
  const priority = summary.match(/^Prioridad: \S+ → (\S+)\.$/m);
  const onlyPriority = priority && summary.split("\n").length === 1;
  if (onlyPriority) return `Cambió la prioridad a ${priority[1]}`;
  return "Corrigió los datos del expediente";
}
