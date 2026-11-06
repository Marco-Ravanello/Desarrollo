import prisma from "@/lib/prisma";
import { canManageProgramEnrollment } from "@/lib/permissions";
import { todayInArgentina } from "@/lib/follow-up-dates";
import { findPadronProgram, isPadronProgramColumn, type PadronProgramColumn } from "@/lib/padron-programs";
import { BULK_MAX, parseDniList, type BulkOutcome } from "@/lib/program-bulk";
import { nombrePropio } from "@/lib/nombres";
import { programManageError } from "@/services/programs";
import { PROGRAM_NOTE_MAX, enrollInProgramTx, isInProgram, withdrawFromProgramTx } from "@/services/program-enrollment";

// Altas y bajas de varias personas juntas en un programa del padrón. Cada persona va en su propia
// transacción: si una no se puede (ya estaba, no está en el padrón), las demás se hacen igual.

type Actor = { id?: string | null; role?: string | null };
type Fail = { success: false; error: string };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayText = (day: string) => day.split("-").reverse().join("/");

async function check(user: Actor, column: string, dayRaw: string | null | undefined, kind: "altas" | "bajas"): Promise<Fail | { column: PadronProgramColumn; day: string }> {
  if (!user.id || !canManageProgramEnrollment(user.role)) return { success: false, error: `Tu rol no puede dar ${kind} en los programas.` };
  if (!isPadronProgramColumn(column)) return { success: false, error: "Elegí el programa." };
  const today = todayInArgentina();
  const day = (dayRaw ?? "").trim() || today;
  if (!ISO_DAY.test(day) || day > today || day < "1990-01-01") return { success: false, error: "Elegí una fecha válida, que no sea posterior a hoy." };
  const notAllowed = await programManageError(user, column);
  if (notAllowed) return { success: false, error: notAllowed };
  return { column, day };
}

function cleanDnis(dnis: unknown): string[] {
  if (!Array.isArray(dnis)) return [];
  return [...new Set(dnis.filter((d): d is string => typeof d === "string").map((d) => d.trim()).filter(Boolean))].slice(0, BULK_MAX);
}

async function names(dnis: string[]): Promise<Map<string, string | null>> {
  const rows = await prisma.padronUnificado.findMany({ where: { dni: { in: dnis } }, select: { dni: true, nombre_completo: true } });
  return new Map(rows.map((r) => [r.dni, nombrePropio(r.nombre_completo)]));
}

export async function bulkEnroll(
  user: Actor,
  input: { column: string; dnis: unknown; day?: string | null; note?: string | null }
): Promise<({ success: true } & BulkOutcome) | Fail> {
  const ok = await check(user, input.column, input.day, "altas");
  if ("error" in ok) return ok;
  const dnis = cleanDnis(input.dnis);
  if (!dnis.length) return { success: false, error: "Elegí al menos una persona." };
  const note = (input.note ?? "").trim().slice(0, PROGRAM_NOTE_MAX) || null;
  const fecha = new Date(`${ok.day}T00:00:00.000Z`);
  const byName = await names(dnis);
  const outcome: BulkOutcome = { done: 0, skipped: [] };
  for (const dni of dnis) {
    const res = await prisma.$transaction((tx) =>
      enrollInProgramTx(tx, {
        dni,
        column: ok.column,
        fecha,
        note,
        userId: user.id!,
        origen: "APP",
        detalle: `Alta de varias personas juntas, desde el ${dayText(ok.day)}.${note ? ` ${note}` : ""}`,
      })
    );
    if (res.success) outcome.done++;
    else outcome.skipped.push({ dni, nombre: byName.get(dni) ?? null, reason: res.error });
  }
  return { success: true, ...outcome };
}

export async function bulkWithdraw(
  user: Actor,
  input: { column: string; dnis: unknown; day?: string | null; reason?: string | null }
): Promise<({ success: true } & BulkOutcome) | Fail> {
  const ok = await check(user, input.column, input.day, "bajas");
  if ("error" in ok) return ok;
  const dnis = cleanDnis(input.dnis);
  if (!dnis.length) return { success: false, error: "Elegí al menos una persona." };
  const reason = (input.reason ?? "").trim().slice(0, PROGRAM_NOTE_MAX);
  if (!reason) return { success: false, error: "Escribí el motivo de la baja." };
  const fecha = new Date(`${ok.day}T00:00:00.000Z`);
  const byName = await names(dnis);
  const outcome: BulkOutcome = { done: 0, skipped: [] };
  for (const dni of dnis) {
    const res = await prisma.$transaction((tx) => withdrawFromProgramTx(tx, { dni, column: ok.column, fecha, reason, userId: user.id!, origen: "APP" }));
    if (res.success) outcome.done++;
    else outcome.skipped.push({ dni, nombre: byName.get(dni) ?? null, reason: res.error });
  }
  return { success: true, ...outcome };
}

export type BulkPreviewRow = { dni: string; nombre: string | null; estado: "ok" | "ya-esta" | "no-encontrada" | "marcada"; detalle: string };

/** Antes de dar las altas de una lista pegada: quiénes son, cuáles ya están y cuáles no se encontraron. */
export async function previewBulkEnroll(
  user: Actor,
  column: string,
  text: string
): Promise<{ success: true; rows: BulkPreviewRow[]; invalid: string[]; tooMany: boolean } | Fail> {
  if (!user.id || !canManageProgramEnrollment(user.role)) return { success: false, error: "Tu rol no puede dar altas en los programas." };
  if (!isPadronProgramColumn(column)) return { success: false, error: "Elegí el programa." };
  const { dnis, invalid, tooMany } = parseDniList(text);
  if (!dnis.length) return { success: false, error: "No encontré ningún DNI en lo que pegaste." };
  const program = findPadronProgram(column)!;
  const [padron, people, marks] = await Promise.all([
    prisma.padronUnificado.findMany({ where: { dni: { in: dnis } } }),
    prisma.person.findMany({ where: { dni: { in: dnis } }, select: { dni: true, firstName: true, lastName: true } }),
    prisma.personaEstado.findMany({ where: { dni: { in: dnis } }, select: { dni: true, estado: true } }),
  ]);
  const byPadron = new Map(padron.map((p) => [p.dni, p]));
  const byPerson = new Map(people.map((p) => [p.dni, p]));
  const byMark = new Map(marks.map((m) => [m.dni, m.estado]));
  const rows: BulkPreviewRow[] = dnis.map((dni) => {
    const p = byPadron.get(dni);
    const person = byPerson.get(dni);
    const nombre = p ? nombrePropio(p.nombre_completo) : person ? [person.lastName, person.firstName].filter(Boolean).join(", ") || null : null;
    const mark = byMark.get(dni);
    if (mark) return { dni, nombre, estado: "marcada", detalle: mark === "FALLECIDA" ? "Falleció" : "Se mudó fuera del distrito" };
    if (!p && !person) return { dni, nombre: null, estado: "no-encontrada", detalle: "No está en el padrón ni en el Registro Único" };
    if (p && isInProgram(p as any, column)) return { dni, nombre, estado: "ya-esta", detalle: `Ya está en ${program.label}` };
    return { dni, nombre, estado: "ok", detalle: p ? "Se da de alta" : "Se suma al padrón y se da de alta" };
  });
  return { success: true, rows, invalid, tooMany };
}
