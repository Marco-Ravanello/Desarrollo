// Convenios: cómo se muestra el estado y qué se revisa al cargarlos. Sin acceso a la base:
// se usa en pantalla y en el servidor.
import type { Role } from "@prisma/client";
import { MANAGEMENT_ROLES } from "@/lib/permissions";
import { diaDeVencimiento, diasEntre } from "@/lib/fechas";

export const AGREEMENT_STATUS_LABELS: Record<string, string> = {
  EN_REVISION: "En revisión",
  VIGENTE: "Vigente",
  VENCIDO: "Vencido",
  RESCINDIDO: "Rescindido",
  FINALIZADO: "Finalizado",
};

/** Con qué estado se puede cargar un convenio nuevo (los otros llegan después). */
export const AGREEMENT_INITIAL_STATUSES = ["VIGENTE", "EN_REVISION"] as const;

/** Faltando estos días o menos, se avisa que está por vencer. */
export const AGREEMENT_SOON_DAYS = 60;

/** Cargan convenios: la conducción. */
export const canCreateAgreements = (role?: Role | string | null) => MANAGEMENT_ROLES.includes(role as Role);

export type AgreementTone = "green" | "amber" | "rose" | "blue" | "gray";

export type AgreementState = {
  /** El estado que se muestra: un convenio vigente cuya fecha de fin ya pasó se muestra como vencido. */
  status: string;
  label: string;
  tone: AgreementTone;
  /** "Vence en 20 días", "Venció el 03/03/2026", "Hasta el 31/12/2027", o null sin fecha de fin. */
  endLabel: string | null;
  /** Rojo si ya venció, naranja si está por vencer. */
  endTone: AgreementTone;
  /** Le quedan AGREEMENT_SOON_DAYS días o menos. */
  soon: boolean;
};

const TONES: Record<string, AgreementTone> = {
  EN_REVISION: "blue",
  VIGENTE: "green",
  VENCIDO: "rose",
  RESCINDIDO: "gray",
  FINALIZADO: "gray",
};

const dia = (iso: string) => iso.split("-").reverse().join("/");

/** El estado de un convenio hoy (`today` es "AAAA-MM-DD" de Argentina). */
export function agreementState(a: { status: string; endDate?: Date | string | null }, today: string): AgreementState {
  const end = a.endDate ? diaDeVencimiento(a.endDate) : "";
  const left = end ? diasEntre(today, end) : null;
  const open = a.status === "VIGENTE" || a.status === "EN_REVISION";
  const status = a.status === "VIGENTE" && left !== null && left < 0 ? "VENCIDO" : a.status;
  const soon = open && left !== null && left >= 0 && left <= AGREEMENT_SOON_DAYS;

  let endLabel: string | null = null;
  let endTone: AgreementTone = "gray";
  if (end && left !== null) {
    if (!open) endLabel = `Hasta el ${dia(end)}`;
    else if (left < 0) {
      endLabel = `Venció el ${dia(end)}`;
      endTone = "rose";
    } else {
      endLabel = left === 0 ? "Vence hoy" : left === 1 ? "Vence mañana" : soon ? `Vence en ${left} días` : `Hasta el ${dia(end)}`;
      if (soon) endTone = "amber";
    }
  }
  return {
    status,
    label: AGREEMENT_STATUS_LABELS[status] ?? status,
    tone: soon && status === "VIGENTE" ? "amber" : TONES[status] ?? "gray",
    endLabel,
    endTone,
    soon,
  };
}

export const AGREEMENT_LIMITS = { title: 300, number: 60, parties: 500, description: 5000 };

export type AgreementInput = {
  title: string;
  number: string | null;
  parties: string;
  description: string | null;
  amount: number | null;
  startDate: string | null;
  endDate: string | null;
  areaId: string | null;
  status: (typeof AGREEMENT_INITIAL_STATUSES)[number];
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Revisa lo que llega del formulario. Devuelve los datos limpios o qué hay que corregir. */
export function parseAgreementInput(raw: Record<string, unknown>): { ok: true; data: AgreementInput } | { ok: false; error: string } {
  const title = text(raw.title);
  const number = text(raw.number);
  const parties = text(raw.parties);
  const description = text(raw.description);
  if (!title) return { ok: false, error: "Escribí el título o el objeto del convenio." };
  if (!parties) return { ok: false, error: "Escribí con quién se firma el convenio (las partes)." };
  if (title.length > AGREEMENT_LIMITS.title) return { ok: false, error: `El título puede tener hasta ${AGREEMENT_LIMITS.title} letras.` };
  if (number.length > AGREEMENT_LIMITS.number) return { ok: false, error: `El número puede tener hasta ${AGREEMENT_LIMITS.number} letras.` };
  if (parties.length > AGREEMENT_LIMITS.parties) return { ok: false, error: `Las partes pueden tener hasta ${AGREEMENT_LIMITS.parties} letras.` };
  if (description.length > AGREEMENT_LIMITS.description) {
    return { ok: false, error: `Los detalles pueden tener hasta ${AGREEMENT_LIMITS.description} letras.` };
  }

  const amountText = text(raw.amount);
  let amount: number | null = null;
  if (amountText) {
    amount = Number(amountText);
    if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "El monto tiene que ser un número sin signo menos." };
  }

  const startDate = text(raw.startDate) || null;
  const endDate = text(raw.endDate) || null;
  for (const d of [startDate, endDate]) {
    if (d && (!ISO_DAY.test(d) || new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) !== d)) {
      return { ok: false, error: "Revisá las fechas: alguna no es válida." };
    }
  }
  if (startDate && endDate && endDate < startDate) return { ok: false, error: "La fecha de vencimiento no puede ser anterior a la de inicio." };

  const status = text(raw.status) || "VIGENTE";
  if (!AGREEMENT_INITIAL_STATUSES.includes(status as AgreementInput["status"])) {
    return { ok: false, error: "Elegí si el convenio está vigente o en revisión." };
  }

  return {
    ok: true,
    data: {
      title,
      number: number || null,
      parties,
      description: description || null,
      amount,
      startDate,
      endDate,
      areaId: text(raw.areaId) || null,
      status: status as AgreementInput["status"],
    },
  };
}
