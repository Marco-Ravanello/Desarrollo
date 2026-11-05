import prisma from "@/lib/prisma";
import { createTask } from "@/services/system";
import { findBlockingReservation, requestVehicleReservation } from "@/services/vehicle-reservations";
import { conflictMessage } from "@/services/vehicle-reservations";
import { BLOCKING_STATUSES, formatReservationRange } from "@/lib/vehicle-reservations";
import { diaAR, formatFechaLarga, formatHora } from "@/lib/fechas";
import { taskTitleFromQuery, type ToolArgs } from "@/lib/assistant-tools";
import type { AIResponse } from "./types";
import { extractSchedulingDetails } from "./intent-handlers";

// Tareas y pedidos de vehículo desde el asistente: primero se muestra lo que se va a crear y se guarda recién
// cuando la persona toca "Confirmar" (app/(dashboard)/admin/assistant/actions.ts). Al confirmar se revisa todo
// de nuevo, con las mismas reglas que las pantallas de tareas y de reservas.

/** `detalle` es lo que muestra la tarjeta; al confirmar se usan los otros campos. */
type Detalle = { label: string; value: string }[];
export type TaskProposal = { kind: "tarea"; titulo: string; fecha: string | null; hora: string | null; detalle?: Detalle };
export type ReservationProposal = { kind: "reserva"; vehicleId: string; vehiculo: string; salida: string; vuelta: string; motivo: string; detalle?: Detalle };
export type Proposal = TaskProposal | ReservationProposal;

/** Horas que dura el pedido de vehículo si la pregunta no dice a qué hora vuelve. */
export const DEFAULT_RESERVATION_HOURS = 2;
const DEFAULT_REASON = "Pedido desde el Asistente de IA";

const arDate = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-03:00`);
const sinSesion: AIResponse = { intent: "command_error", answer: "Tu sesión expiró. Volvé a iniciar sesión." };
const normPlate = (s: string) => s.replace(/[^a-z0-9]/gi, "").toUpperCase();

function proposalResponse(intent: string, answer: string, proposal: Proposal): AIResponse {
  return { intent, answer, dataSummary: { hasResults: true, sources: [], actions: [], proposal } };
}

/** "Crear tarea": arma la tarea sin guardarla. */
export async function proposeTask(args: ToolArgs, query: string, userId: string | null): Promise<AIResponse> {
  if (!userId) return sinSesion;
  let titulo = typeof args.titulo === "string" ? args.titulo : "";
  let fecha = typeof args.fecha === "string" ? args.fecha : null;
  let hora = typeof args.hora === "string" ? args.hora : null;
  if (!titulo) {
    // Sin Gemini: el título y la fecha salen de la pregunta, como antes.
    const details = await extractSchedulingDetails(query);
    titulo = taskTitleFromQuery(query);
    fecha = diaAR(details.dueDate);
    hora = formatHora(details.dueDate);
  }
  titulo = titulo.trim().slice(0, 120) || "Tarea";
  const when = fecha ? `${formatFechaLarga(arDate(fecha, hora ?? "12:00"))}${hora ? `, a las ${hora}` : ""}` : "Sin fecha";
  const answer = `### Revisá la tarea\n\nTodavía no la guardé. Si está bien, tocá **Confirmar** y la vas a ver en Mis tareas.`;
  return proposalResponse("task_proposal", answer, {
    kind: "tarea",
    titulo,
    fecha,
    hora,
    detalle: [
      { label: "Tarea", value: titulo },
      { label: "Cuándo", value: when },
    ],
  });
}

type VehicleRow = { id: string; plate: string; brand: string; model: string; status: string };
const vehicleLabel = (v: VehicleRow) => `${v.brand} ${v.model} (${v.plate})`;

/**
 * "Reservar vehículo": busca un vehículo libre en ese horario y arma el pedido sin guardarlo. Sin patente,
 * elige el primero que esté disponible y no tenga reservas en ese horario (ni pendientes).
 */
export async function proposeReservation(args: ToolArgs, query: string, userId: string | null, now = new Date()): Promise<AIResponse> {
  if (!userId) return sinSesion;
  let start: Date | null = null;
  let end: Date | null = null;
  let plate = typeof args.patente === "string" ? normPlate(args.patente) : "";
  const fecha = typeof args.fecha === "string" ? args.fecha : null;
  const salida = typeof args.hora_salida === "string" ? args.hora_salida : null;
  if (fecha && salida) {
    start = arDate(fecha, salida);
    end = typeof args.hora_vuelta === "string" ? arDate(fecha, args.hora_vuelta) : new Date(start.getTime() + DEFAULT_RESERVATION_HOURS * 3600000);
  } else if (Object.keys(args).length === 0) {
    // Sin Gemini: la fecha sale de la pregunta (al mediodía si no dice la hora).
    start = (await extractSchedulingDetails(query)).dueDate;
    end = new Date(start.getTime() + DEFAULT_RESERVATION_HOURS * 3600000);
    // "de 9 a 12" o "de 9:30 a 13 hs"
    const range = query.toLowerCase().match(/\bde\s+(\d{1,2})(?::(\d{2}))?\s*(?:hs?\.?)?\s+a\s+(\d{1,2})(?::(\d{2}))?/);
    if (range && Number(range[1]) <= 23 && Number(range[3]) <= 23) {
      const day = diaAR(start);
      const hhmm = (h: string, m?: string) => `${h.padStart(2, "0")}:${m ?? "00"}`;
      start = arDate(day, hhmm(range[1], range[2]));
      end = arDate(day, hhmm(range[3], range[4]));
    }
    const m = query.toLowerCase().replace(/[^a-z0-9]/g, "").match(/[a-z]{3}\d{3}|[a-z]{2}\d{3}[a-z]{2}/);
    if (m) plate = m[0].toUpperCase();
  }
  if (!start || !end) {
    return { intent: "reservation_question", answer: 'Decime para qué día y a qué hora necesitás el vehículo, por ejemplo: "Reservame un auto el jueves de 9 a 12".' };
  }
  if (end <= start) return { intent: "reservation_question", answer: "La vuelta tiene que ser después de la salida. Decime de nuevo el horario." };
  if (start < now) return { intent: "reservation_question", answer: "Ese horario ya pasó. Decime otro día u otra hora." };

  const motivo = (typeof args.motivo === "string" && args.motivo.trim()) || DEFAULT_REASON;
  const vehicles: VehicleRow[] = await prisma.vehicle.findMany({
    select: { id: true, plate: true, brand: true, model: true, status: true },
    orderBy: { plate: "asc" },
  });
  let chosen: VehicleRow | undefined;

  if (plate) {
    chosen = vehicles.find((v) => normPlate(v.plate) === plate);
    if (!chosen) return { intent: "reservation_error", answer: `No encontré un vehículo con la patente ${plate}.` };
    if (chosen.status !== "DISPONIBLE") {
      return { intent: "reservation_error", answer: `El ${vehicleLabel(chosen)} no se puede reservar: está ${chosen.status === "EN_TALLER" ? "en el taller" : "fuera de servicio"}.` };
    }
    const blocking = await findBlockingReservation(chosen.id, start, end);
    if (blocking) return { intent: "reservation_error", answer: `${conflictMessage(blocking)} Probá con otro horario o pedime otro vehículo.` };
  } else {
    const available = vehicles.filter((v) => v.status === "DISPONIBLE");
    if (available.length === 0) return { intent: "reservation_error", answer: "No hay vehículos disponibles: todos están en el taller o fuera de servicio." };
    const taken = await prisma.vehicleReservation.findMany({
      where: { vehicleId: { in: available.map((v) => v.id) }, status: { in: [...BLOCKING_STATUSES, "PENDIENTE"] }, startDate: { lt: end }, endDate: { gt: start } },
      select: { vehicleId: true, status: true },
    });
    const blocked = new Set(taken.filter((t) => BLOCKING_STATUSES.includes(t.status)).map((t) => t.vehicleId));
    const pending = new Set(taken.map((t) => t.vehicleId));
    chosen = available.find((v) => !pending.has(v.id)) ?? available.find((v) => !blocked.has(v.id));
    if (!chosen) return { intent: "reservation_error", answer: `No hay vehículos libres el ${formatReservationRange(start, end)}. Probá con otro horario.` };
  }

  const answer = [
    "### Revisá el pedido de vehículo",
    "",
    "Todavía no lo pedí. Si está bien, tocá **Confirmar**. Queda pendiente hasta que lo apruebe quien administra la flota.",
  ].join("\n");
  return proposalResponse("reservation_proposal", answer, {
    kind: "reserva",
    vehicleId: chosen.id,
    vehiculo: vehicleLabel(chosen),
    salida: start.toISOString(),
    vuelta: end.toISOString(),
    motivo,
    detalle: [
      { label: "Vehículo", value: vehicleLabel(chosen) },
      { label: "Cuándo", value: formatReservationRange(start, end) },
      { label: "Motivo", value: motivo },
    ],
  });
}

export type ConfirmResult = { ok: true; message: string; link: string } | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Guarda la tarea que la persona confirmó, a su nombre. */
export async function confirmTaskProposal(user: { id: string }, raw: unknown): Promise<ConfirmResult> {
  const p = (raw ?? {}) as Partial<TaskProposal>;
  const titulo = typeof p.titulo === "string" ? p.titulo.trim().slice(0, 120) : "";
  if (!titulo) return { ok: false, error: "La tarea necesita un título." };
  const fecha = typeof p.fecha === "string" && DATE_RE.test(p.fecha) ? p.fecha : null;
  const hora = typeof p.hora === "string" && TIME_RE.test(p.hora) ? p.hora : null;
  const dueDate = fecha ? arDate(fecha, hora ?? "12:00") : null;
  if (dueDate && isNaN(dueDate.getTime())) return { ok: false, error: "Revisá la fecha de la tarea." };
  await createTask(user.id, titulo, undefined, dueDate);
  return { ok: true, message: "Listo, guardé la tarea. La vas a ver en Mis tareas.", link: "/tasks" };
}

/** Pide el vehículo que la persona confirmó. Se revisa de nuevo que esté libre (pudo cambiar mientras tanto). */
export async function confirmReservationProposal(user: { id: string; name?: string | null; areaId?: string | null }, raw: unknown): Promise<ConfirmResult> {
  const p = (raw ?? {}) as Partial<ReservationProposal>;
  if (typeof p.vehicleId !== "string" || typeof p.salida !== "string" || typeof p.vuelta !== "string") {
    return { ok: false, error: "Faltan datos del pedido. Pedímelo de nuevo." };
  }
  const startDate = new Date(p.salida);
  const endDate = new Date(p.vuelta);
  if (startDate < new Date()) return { ok: false, error: "Ese horario ya pasó. Pedime el vehículo para otro horario." };
  const result = await requestVehicleReservation({
    vehicleId: p.vehicleId,
    user,
    startDate,
    endDate,
    reason: typeof p.motivo === "string" && p.motivo.trim() ? p.motivo : DEFAULT_REASON,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    message: `Listo, pedí el ${result.vehicle.brand} ${result.vehicle.model} (${result.vehicle.plate}) para el ${formatReservationRange(startDate, endDate)}. Queda pendiente hasta que lo aprueben.`,
    link: "/admin/vehicles",
  };
}
