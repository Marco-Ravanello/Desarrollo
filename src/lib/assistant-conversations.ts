// Conversaciones guardadas del Asistente de IA. Cada persona ve solo las suyas y se borran solas a los
// 10 días de la última pregunta. Sin acceso a la base: se usa en el servidor y en pantalla.

/** Días que se guarda una conversación desde la última pregunta. */
export const CONVERSATION_RETENTION_DAYS = 10;
/** Conversaciones que muestra la lista de anteriores. */
export const MAX_CONVERSATIONS_LISTED = 50;
/** Preguntas y respuestas que se guardan por conversación (las más viejas dejan de guardarse). */
export const MAX_MESSAGES_PER_CONVERSATION = 200;
const MAX_TITLE = 80;
const MAX_TEXT = 20000;

/** Lo que se actualizó antes de esta fecha ya se borra. */
export function conversationCutoff(now = new Date()): Date {
  return new Date(now.getTime() - CONVERSATION_RETENTION_DAYS * 86400000);
}

/** Cuándo se borra una conversación que tuvo su última pregunta en `updatedAt`. */
export function conversationExpiresAt(updatedAt: Date): Date {
  return new Date(updatedAt.getTime() + CONVERSATION_RETENTION_DAYS * 86400000);
}

/** El nombre de la conversación en la lista: la primera pregunta, en un renglón y recortada. */
export function conversationTitle(question: string): string {
  const clean = (question ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "Conversación";
  return clean.length > MAX_TITLE ? `${clean.slice(0, MAX_TITLE - 1).trimEnd()}…` : clean;
}

export const clampMessageText = (text: string) => (text ?? "").slice(0, MAX_TEXT);

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max = 300) => (typeof v === "string" ? v.slice(0, max) : undefined);
/** Solo rutas de la app ("/cases?…"), nunca enlaces afuera. */
export const isAppPath = (v: unknown): v is string => typeof v === "string" && /^\/(?![/\\])/.test(v) && !/[\s\\]/.test(v);

/**
 * De lo que acompaña una respuesta, se guarda solo lo que se dibuja: números de arriba, gráfico, enlaces,
 * botones y la tarjeta para confirmar. Lo demás (listas de personas que arman algunas consultas) no se guarda.
 */
export function storedAnswerData(raw: unknown): Record<string, unknown> | null {
  if (!isObj(raw)) return null;
  const out: Record<string, unknown> = {};

  if (Array.isArray(raw.stats)) {
    const stats = raw.stats
      .filter(isObj)
      .slice(0, 4)
      .map((s) => ({
        label: str(s.label, 60) ?? "",
        value: str(s.value, 40) ?? "",
        ...(s.tone === "attention" ? { tone: "attention" } : {}),
        ...(isAppPath(s.href) ? { href: s.href } : {}),
      }))
      .filter((s) => s.label && s.value);
    if (stats.length) out.stats = stats;
  }

  if (isObj(raw.chart) && Array.isArray(raw.chart.data)) {
    const c = raw.chart;
    out.chart = {
      type: str(c.type, 10),
      title: str(c.title, 120),
      ...(c.format === "pesos" ? { format: "pesos" } : {}),
      ...(Array.isArray(c.columns) ? { columns: c.columns.slice(0, 2).map((x) => str(x, 40) ?? "") } : {}),
      data: (c.data as unknown[])
        .filter(isObj)
        .slice(0, 60)
        .map((d) => ({ name: str(d.name, 80) ?? "", value: typeof d.value === "number" && Number.isFinite(d.value) ? d.value : 0, ...(typeof d.tone === "string" ? { tone: str(d.tone, 10) } : {}) })),
    };
  }

  if (Array.isArray(raw.sources)) {
    const sources = raw.sources
      .filter(isObj)
      .slice(0, 12)
      .map((s) => ({ name: str(s.name, 120) ?? "", ...(isAppPath(s.url) ? { url: s.url } : {}) }))
      .filter((s) => s.name);
    if (sources.length) out.sources = sources;
  }

  if (Array.isArray(raw.actions)) {
    const actions = raw.actions
      .filter(isObj)
      .slice(0, 6)
      .map((a) => {
        const path = isObj(a.payload) && isAppPath(a.payload.path) ? a.payload.path : undefined;
        return { label: str(a.label, 60) ?? "", actionType: a.actionType === "NAVIGATE" && path ? "NAVIGATE" : "OPEN_DIALOG", ...(path ? { payload: { path } } : {}) };
      })
      .filter((a) => a.label);
    if (actions.length) out.actions = actions;
  }

  if (isObj(raw.proposal) && (raw.proposal.kind === "tarea" || raw.proposal.kind === "reserva")) {
    // Lo que hace falta para mostrarla y confirmarla (al confirmar se revisa todo de nuevo en el servidor).
    const p = raw.proposal;
    const keep = p.kind === "tarea" ? ["kind", "titulo", "fecha", "hora"] : ["kind", "vehicleId", "vehiculo", "salida", "vuelta", "motivo"];
    const proposal: Record<string, unknown> = {};
    for (const k of keep) if (typeof p[k] === "string" || p[k] === null) proposal[k] = typeof p[k] === "string" ? str(p[k], 200) : null;
    if (Array.isArray(p.detalle)) {
      proposal.detalle = p.detalle.filter(isObj).slice(0, 6).map((d) => ({ label: str(d.label, 40) ?? "", value: str(d.value, 200) ?? "" }));
    }
    out.proposal = proposal;
  }

  if (isObj(raw.proposalResult)) {
    const r = raw.proposalResult;
    if (r.step === "done") out.proposalResult = { step: "done", message: str(r.message, 300) ?? "", link: isAppPath(r.link) ? r.link : "/" };
    else if (r.step === "cancelled") out.proposalResult = { step: "cancelled" };
  }

  return Object.keys(out).length ? out : null;
}

/** "Hoy", "Ayer" o la fecha, para la lista de conversaciones. */
export function conversationDayLabel(date: Date, now = new Date()): string {
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const today = day(now);
  const yesterday = day(new Date(now.getTime() - 86400000));
  const d = day(date);
  if (d === today) return "Hoy";
  if (d === yesterday) return "Ayer";
  return date.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" }).replace(/^./, (c) => c.toUpperCase());
}
