// Tipos de documento y vencimientos (por ejemplo, el CUD). Sin base de datos, para poder probarlo solo.

import { addDays } from "@/lib/follow-up-dates";
import { diasEntre } from "@/lib/fechas";

export const DOCUMENT_KINDS = [
  { key: "CUD", label: "CUD (Certificado Único de Discapacidad)", short: "CUD" },
  { key: "DNI", label: "DNI", short: "DNI" },
  { key: "ESCOLARIDAD", label: "Certificado de escolaridad", short: "Escolaridad" },
  { key: "SALUD", label: "Certificado o informe médico", short: "Informe médico" },
  { key: "PARTIDA", label: "Partida de nacimiento", short: "Partida" },
  { key: "CONSTANCIA", label: "Constancia o declaración jurada", short: "Constancia" },
  { key: "OTRO", label: "Otro", short: "Documento" },
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number]["key"];

export const isDocumentKind = (v: unknown): v is DocumentKind => DOCUMENT_KINDS.some((k) => k.key === v);
export const documentKindLabel = (k: string | null | undefined) => DOCUMENT_KINDS.find((d) => d.key === k)?.short ?? "Documento";

/** Cuántos días antes de vencer se avisa y se marca en ámbar. */
export const EXPIRY_WARN_DAYS = 60;
/** Hasta cuántos años para adelante se acepta un vencimiento. */
const MAX_YEARS = 15;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export type ExpiryState = { state: "vencido" | "por-vencer" | "vigente"; days: number; label: string };

/**
 * Cómo está un vencimiento hoy. `expiry` y `today` son "AAAA-MM-DD". "Vence hoy" cuenta como por vencer;
 * desde el día siguiente, vencido.
 */
export function expiryState(expiry: string, today: string): ExpiryState {
  const days = diasEntre(today, expiry);
  const fecha = expiry.split("-").reverse().join("/");
  if (days < 0) return { state: "vencido", days, label: `Venció el ${fecha}` };
  if (days === 0) return { state: "por-vencer", days, label: "Vence hoy" };
  if (days <= EXPIRY_WARN_DAYS) return { state: "por-vencer", days, label: days === 1 ? "Vence mañana" : `Vence en ${days} días (${fecha})` };
  return { state: "vigente", days, label: `Vence el ${fecha}` };
}

/** Revisa la fecha de vencimiento que se cargó. Vacía = sin vencimiento. */
export function checkExpiry(raw: unknown, today: string): { day: string | null } | { error: string } {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return { day: null };
  if (!ISO_DAY.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) return { error: "Elegí una fecha de vencimiento válida." };
  if (value < addDays(today, -365 * 5)) return { error: "Revisá el vencimiento: es de hace más de 5 años." };
  if (value > addDays(today, 365 * MAX_YEARS)) return { error: `Revisá el vencimiento: es de más de ${MAX_YEARS} años para adelante.` };
  return { day: value };
}

/** El nombre que se muestra cuando se anota un vencimiento sin subir archivo: "CUD", "DNI"… */
export function documentNameWithoutFile(kind: DocumentKind): string {
  return DOCUMENT_KINDS.find((k) => k.key === kind)!.short;
}
