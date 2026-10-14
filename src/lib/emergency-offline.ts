// Fichas de emergencia cargadas sin conexión: quedan guardadas en el
// navegador del dispositivo (por usuario) y se envían solas cuando vuelve
// internet. Cada ficha lleva un `clientId`, así que reenviarla no la duplica.

import type { StormVictimItem } from "@/types/emergency";

export interface PendingFicha {
  clientId: string;
  payload: Partial<StormVictimItem>;
  savedAt: string;
  /** Motivo por el que el servidor no la aceptó la última vez (si hubo). */
  lastError?: string;
}

export type SaveFichaOutcome =
  | { status: "saved"; record: StormVictimItem }
  | { status: "queued"; sessionExpired?: boolean }
  | { status: "error"; error: string };

/** Se emite cuando cambia la lista de fichas pendientes. */
export const PENDING_FICHAS_EVENT = "muni-fichas-pendientes";

const REQUEST_TIMEOUT_MS = 20000;

function storageKey(userId: string) {
  return `muni-fichas-pendientes:${userId}`;
}

export function newClientId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function readPendingFichas(userId: string): PendingFicha[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writePendingFichas(userId: string, list: PendingFicha[]) {
  localStorage.setItem(storageKey(userId), JSON.stringify(list));
  try {
    window.dispatchEvent(new Event(PENDING_FICHAS_EVENT));
  } catch {}
}

/** Guarda (o reemplaza, si ya estaba) una ficha en el dispositivo. */
export function queueFicha(userId: string, payload: Partial<StormVictimItem>, lastError?: string): PendingFicha {
  const clientId = payload.clientId || newClientId();
  const item: PendingFicha = { clientId, payload: { ...payload, clientId }, savedAt: new Date().toISOString(), lastError };
  const list = readPendingFichas(userId).filter((p) => p.clientId !== clientId);
  writePendingFichas(userId, [...list, item]);
  return item;
}

export function removePendingFicha(userId: string, clientId: string) {
  const list = readPendingFichas(userId);
  if (!list.some((p) => p.clientId === clientId)) return;
  writePendingFichas(userId, list.filter((p) => p.clientId !== clientId));
}

type SendResult =
  | { ok: true; record: StormVictimItem }
  | { ok: false; network: true }
  | { ok: false; network: false; status: number; error: string };

async function sendFicha(payload: Partial<StormVictimItem>): Promise<SendResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch("/api/emergency/fichas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: "manual",
    });
    // Una redirección (al login) o una respuesta que no es JSON se tratan como sesión vencida.
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success) return { ok: true, record: data.record };
    const status = res.type === "opaqueredirect" || !data ? 401 : res.status;
    return { ok: false, network: false, status, error: data?.error || "No se pudo guardar la ficha." };
  } catch {
    return { ok: false, network: true };
  } finally {
    clearTimeout(timer);
  }
}

function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * Guarda una ficha: si hay conexión la envía; si no (o se corta en el medio),
 * la deja en el dispositivo para enviarla después.
 */
export async function saveFichaOrQueue(userId: string, payload: Partial<StormVictimItem>): Promise<SaveFichaOutcome> {
  const withId: Partial<StormVictimItem> = { ...payload, clientId: payload.clientId || newClientId() };

  if (isOffline()) {
    queueFicha(userId, withId);
    return { status: "queued" };
  }

  const result = await sendFicha(withId);
  if (result.ok) {
    removePendingFicha(userId, withId.clientId!);
    return { status: "saved", record: result.record };
  }
  if (result.network) {
    queueFicha(userId, withId);
    return { status: "queued" };
  }
  if (result.status === 401) {
    queueFicha(userId, withId, "Tu sesión venció. Volvé a iniciar sesión para enviarla.");
    return { status: "queued", sessionExpired: true };
  }
  return { status: "error", error: result.error };
}

let syncing: Promise<SyncSummary> | null = null;

export interface SyncSummary {
  sent: number;
  remaining: number;
  sessionExpired: boolean;
  rejected: number;
}

/** Envía las fichas guardadas en el dispositivo, de a una. */
export function syncPendingFichas(userId: string): Promise<SyncSummary> {
  if (syncing) return syncing;
  syncing = (async () => {
    let sent = 0;
    let rejected = 0;
    let sessionExpired = false;
    for (const item of readPendingFichas(userId)) {
      if (isOffline()) break;
      const result = await sendFicha(item.payload);
      if (result.ok) {
        removePendingFicha(userId, item.clientId);
        sent++;
        continue;
      }
      if (result.network) break;
      if (result.status === 401) {
        sessionExpired = true;
        queueFicha(userId, item.payload, "Tu sesión venció. Volvé a iniciar sesión para enviarla.");
        break;
      }
      // El servidor la rechazó (por ejemplo, un dato inválido): queda guardada con el motivo.
      rejected++;
      queueFicha(userId, item.payload, result.error);
    }
    return { sent, rejected, sessionExpired, remaining: readPendingFichas(userId).length };
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}

/** Borra la pantalla guardada para usar sin conexión (al cerrar sesión). */
export async function clearOfflineCache() {
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("muni-")).map((k) => caches.delete(k)));
    }
  } catch {}
}
