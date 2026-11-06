"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowUp, ArrowUpRight, Copy, History, MessageSquareWarning, Loader2, Mic, MicOff, RefreshCw, Sparkles, Square, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { AssistantAnswer } from "@/components/assistant/assistant-answer";
import { AssistantChart } from "@/components/assistant/assistant-chart";
import { AssistantWelcome } from "@/components/assistant/assistant-welcome";
import { AssistantProposal, type AssistantProposalData, type ProposalResult } from "@/components/assistant/assistant-proposal";
import { AssistantHistory, type ConversationItem } from "@/components/assistant/assistant-history";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { confirmar } from "@/components/ui/confirm-dialog";
import { useSession } from "next-auth/react";
import { plainAnswer, type AnswerStat } from "@/lib/assistant-text";
import { nextReveal } from "@/lib/assistant-stream";
import {
  countUnansweredAction,
  deleteAssistantConversationAction,
  getAssistantConversationAction,
  listAssistantConversationsAction,
} from "@/app/(dashboard)/admin/actions/assistant-actions";

type Source = { type?: string; name: string; url?: string };
type Action = { label: string; actionType: string; payload?: { path?: string } };
type Message = {
  id: string;
  sender: "user" | "assistant";
  text: string;
  /** Lo que está haciendo mientras responde ("Buscando en Expedientes…"). */
  status?: string;
  stopped?: boolean;
  failed?: boolean;
  /** Con qué id quedó guardada la respuesta (para anotar si se confirmó la tarjeta). */
  savedId?: string;
  dataSummary?: {
    sources?: Source[];
    actions?: Action[];
    chart?: any;
    stats?: AnswerStat[];
    proposal?: AssistantProposalData;
    proposalResult?: ProposalResult;
    /** La consulta que respondió: se manda con la pregunta siguiente para seguir la charla. */
    call?: { tool: string; args: Record<string, unknown> };
  };
};

const newId = () => Math.random().toString(36).slice(2);

/** La conversación abierta queda en la dirección (?c=…), así sobrevive a recargar o ir y volver. */
function setConversationInUrl(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("c", id);
  else url.searchParams.delete("c");
  window.history.replaceState(window.history.state, "", url.toString());
}

export default function AssistantPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[] | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  /** Preguntas sin respuesta que esperan (solo se pide si es Superadmin). */
  const [unanswered, setUnanswered] = useState<number | null>(null);
  const isSuperadmin = session?.user?.role === "SUPERADMIN";
  const recognitionRef = useRef<any>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Muestra de golpe lo que ya llegó (al frenar).
  const revealRef = useRef<(() => void) | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function refreshConversations() {
    try {
      setConversations(await listAssistantConversationsAction());
    } catch {
      setConversations((prev) => prev ?? []);
    }
  }

  async function openConversation(id: string) {
    setHistoryOpen(false);
    if (id === conversationId && messages.length) return;
    abortRef.current?.abort();
    window.speechSynthesis?.cancel();
    setSpeakingId(null);
    setOpening(true);
    try {
      const conv = await getAssistantConversationAction(id);
      if (!conv) {
        toast.error("Esa conversación ya no está: se borró o pasaron más de 10 días.");
        setConversationInUrl(null);
        refreshConversations();
        return;
      }
      setConversationId(conv.id);
      setConversationInUrl(conv.id);
      setMessages(
        conv.messages.map((m) => ({
          id: m.id,
          sender: m.sender,
          text: m.text,
          savedId: m.sender === "assistant" ? m.id : undefined,
          dataSummary: (m.data ?? undefined) as Message["dataSummary"],
        })),
      );
    } catch {
      toast.error("No se pudo abrir la conversación. Probá de nuevo.");
    } finally {
      setOpening(false);
    }
  }

  async function removeConversation(item: ConversationItem) {
    const ok = await confirmar({
      title: "¿Borrar esta conversación?",
      description: `"${item.title}" se borra para siempre. Lo que hayas guardado desde ahí (tareas, pedidos de vehículo) no se borra.`,
      confirmLabel: "Borrar",
      danger: true,
    });
    if (!ok) return;
    const res = await deleteAssistantConversationAction(item.id);
    if (!res.ok) {
      toast.error("No se pudo borrar la conversación.");
      return;
    }
    setConversations((prev) => (prev ?? []).filter((c) => c.id !== item.id));
    if (item.id === conversationId) newConversation();
    toast.success("Se borró la conversación.");
  }

  // Al entrar: la lista de conversaciones y, si la dirección trae una, esa conversación.
  useEffect(() => {
    refreshConversations();
    const params = new URLSearchParams(window.location.search);
    const id = params.get("c");
    if (id) openConversation(id);
    // "Probar de nuevo" desde Preguntas sin respuesta: deja la pregunta escrita, lista para mandar.
    const pregunta = params.get("pregunta");
    if (pregunta && !id) {
      setInput(pregunta.slice(0, 500));
      const url = new URL(window.location.href);
      url.searchParams.delete("pregunta");
      window.history.replaceState(window.history.state, "", url.toString());
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isSuperadmin) return;
    countUnansweredAction().then(setUnanswered).catch(() => setUnanswered(null));
  }, [isSuperadmin]);

  // Baja hasta lo último a medida que llega la respuesta. La bienvenida se ve desde arriba.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (messages.length === 0) el.scrollTo({ top: 0 });
    else el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // El campo crece con el texto, hasta unos 6 renglones.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "es-AR";
    recognition.onstart = () => setListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) setInput((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    return () => window.speechSynthesis?.cancel();
  }, []);

  const update = (id: string, change: Partial<Message> | ((m: Message) => Partial<Message>)) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...(typeof change === "function" ? change(m) : change) } : m)));

  function toggleVoice() {
    if (!recognitionRef.current) {
      toast.error("Este navegador no permite dictar por voz.");
      return;
    }
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      try {
        recognitionRef.current.start();
      } catch {
        setListening(false);
      }
    }
  }

  function speak(m: Message) {
    if (!("speechSynthesis" in window)) {
      toast.error("Este navegador no puede leer en voz alta.");
      return;
    }
    window.speechSynthesis.cancel();
    if (speakingId === m.id) {
      setSpeakingId(null);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(plainAnswer(m.text));
    utterance.lang = "es-AR";
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(m.id);
    window.speechSynthesis.speak(utterance);
  }

  async function copy(m: Message) {
    try {
      await navigator.clipboard.writeText(plainAnswer(m.text));
      toast.success("Se copió la respuesta.");
    } catch {
      toast.error("No se pudo copiar. Probá seleccionando el texto.");
    }
  }

  function runAction(act: Action) {
    if (act.actionType === "NAVIGATE" && act.payload?.path) router.push(act.payload.path);
    else if (act.actionType === "OPEN_DIALOG") router.push("/tasks");
  }

  async function ask(raw: string) {
    const text = raw.trim();
    if (!text || loading) return;
    const history = messages.filter((m) => m.text).map((m) => ({ role: m.sender, content: m.text }));
    // La consulta de la última respuesta, para seguir la charla ("¿y cuáles?").
    const previousCall = [...messages].reverse().find((m) => m.sender === "assistant" && m.dataSummary?.call)?.dataSummary?.call ?? null;
    const answerId = newId();
    setMessages((prev) => [...prev, { id: newId(), sender: "user", text }, { id: answerId, sender: "assistant", text: "", status: "Leyendo tu pregunta…" }]);
    setInput("");
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/assistant/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text, history, conversationId, previousCall }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "No se pudo responder la consulta. Probá de nuevo.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      // La respuesta se va mostrando de a poco: `received` es lo que llegó y `shown`, cuánto se ve.
      let received = "";
      let shown = 0;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let finished: any = null;
      const instant = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const paint = () => update(answerId, { text: received.slice(0, shown), status: undefined });
      const tick = () => {
        shown = nextReveal(shown, received);
        paint();
        timer = shown < received.length ? setTimeout(tick, 30) : null;
      };
      const receive = (text: string, restart = false) => {
        received = text;
        if (restart || shown > received.length) shown = 0;
        if (instant || controller.signal.aborted) {
          shown = received.length;
          paint();
        } else if (timer === null) tick();
      };
      revealRef.current = () => {
        if (timer) clearTimeout(timer);
        timer = null;
        shown = received.length;
        if (received) paint();
      };
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const event of events) {
            const line = event.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            let payload: any;
            try {
              payload = JSON.parse(line.slice(6));
            } catch {
              continue;
            }
            if (payload.status && !received) update(answerId, { status: payload.status });
            if (typeof payload.replace === "string") receive(payload.replace, true);
            if (payload.chunk) receive(received + payload.chunk);
            if (payload.done) finished = payload;
            if (payload.error) throw new Error(payload.error);
          }
        }
        // Se termina de escribir y recién ahí aparecen el gráfico, los datos y los botones.
        await new Promise<void>((resolve) => {
          const wait = () => (timer === null ? resolve() : setTimeout(wait, 30));
          wait();
        });
      } finally {
        if (timer) clearTimeout(timer);
        revealRef.current = null;
      }
      if (finished) {
        update(answerId, { text: received, dataSummary: finished.dataSummary, status: undefined, savedId: finished.messageId });
        if (finished.conversationId) {
          setConversationId(finished.conversationId);
          setConversationInUrl(finished.conversationId);
          refreshConversations();
        }
      }
      update(answerId, (m) => (m.text ? { status: undefined } : { text: "No encontré datos para esa pregunta. Probá con otras palabras.", status: undefined }));
    } catch (err: any) {
      if (controller.signal.aborted) {
        update(answerId, { stopped: true, status: undefined });
      } else {
        update(answerId, { failed: true, status: undefined, text: err?.message || "No se pudo responder la consulta. Probá de nuevo." });
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function stop() {
    abortRef.current?.abort();
    // Lo que ya llegó se muestra entero, sin seguir la animación.
    revealRef.current?.();
  }

  function newConversation() {
    stop();
    window.speechSynthesis?.cancel();
    setSpeakingId(null);
    setMessages([]);
    setInput("");
    setConversationId(null);
    setConversationInUrl(null);
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-9rem)] max-h-[calc(100vh-9rem)] flex-col gap-3 overflow-hidden">
      <PageHeader
        className="shrink-0"
        title="Asistente de IA"
        description="Preguntale por los datos de la Secretaría y te responde con números, tablas y gráficos."
        icon={Sparkles}
        actions={
          <div className="flex flex-wrap gap-2">
            {isSuperadmin && (
              <Button asChild variant="outline" className="gap-2">
                <Link href="/admin/assistant/sin-respuesta">
                  <MessageSquareWarning className="h-4 w-4" aria-hidden /> Sin respuesta
                  {unanswered ? (
                    <span className="rounded-full bg-[#C2410C] px-1.5 text-xs font-semibold tabular-nums text-white" aria-label={`${unanswered} pendientes`}>
                      {unanswered}
                    </span>
                  ) : null}
                </Link>
              </Button>
            )}
            <Button variant="outline" onClick={() => setHistoryOpen(true)} className="gap-2 lg:hidden">
              <History className="h-4 w-4" /> Anteriores
            </Button>
            {!empty && (
              <Button variant="outline" onClick={newConversation} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Nueva conversación
              </Button>
            )}
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 gap-4">
        <aside className="hidden w-64 shrink-0 flex-col rounded-2xl border border-border/70 bg-card p-2 lg:flex" aria-label="Conversaciones anteriores">
          <h2 className="flex items-center gap-2 px-2 pb-2 pt-1 text-sm font-semibold text-foreground">
            <History className="h-4 w-4 text-muted-foreground" aria-hidden /> Conversaciones anteriores
          </h2>
          <AssistantHistory
            className="flex-1"
            conversations={conversations}
            activeId={conversationId}
            onOpen={openConversation}
            onDelete={removeConversation}
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-1 sm:px-4">
              {opening ? (
                <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground" role="status">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Abriendo la conversación…
                </p>
              ) : empty ? (
                <AssistantWelcome onAsk={ask} disabled={loading} role={session?.user?.role} />
              ) : (
                <ol className="space-y-6 py-4" aria-live="polite">
                  {messages.map((m) =>
                    m.sender === "user" ? (
                      <li key={m.id} className="flex justify-end">
                        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground sm:text-[15px]">
                          {m.text}
                        </p>
                      </li>
                    ) : (
                      <li key={m.id} className="flex gap-3">
                        <span
                          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-500 dark:bg-orange-500/10"
                          aria-hidden
                        >
                          <Sparkles className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1 text-sm leading-relaxed text-foreground sm:text-[15px]">
                          {m.status && (
                            <p className="flex items-center gap-2 py-1.5 text-muted-foreground" role="status">
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              {m.status}
                            </p>
                          )}
                          {m.text &&
                            (m.failed ? (
                              <p className="text-rose-700 dark:text-rose-300">{m.text}</p>
                            ) : (
                              <AssistantAnswer text={m.text} stats={m.dataSummary?.stats} />
                            ))}
                          {m.stopped && (
                            <p className="mt-1 text-xs text-muted-foreground">{m.text ? "Frenaste la respuesta acá." : "Frenaste la respuesta."}</p>
                          )}
                          {m.dataSummary?.chart && <AssistantChart chart={m.dataSummary.chart} />}
                          {m.dataSummary?.proposal && (
                            <AssistantProposal proposal={m.dataSummary.proposal} messageId={m.savedId} initialResult={m.dataSummary.proposalResult} />
                          )}

                          {!!m.dataSummary?.sources?.length && (
                            <div className="mt-3">
                              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Sale de estos datos</p>
                              <div className="flex flex-wrap gap-1.5">
                                {m.dataSummary.sources.map((src, i) =>
                                  src.url ? (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => router.push(src.url!)}
                                      className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card px-2.5 py-1 text-xs font-medium text-foreground/85 hover:bg-muted hover:text-foreground"
                                    >
                                      {src.name}
                                      <ArrowUpRight className="h-3 w-3 text-muted-foreground" aria-hidden />
                                    </button>
                                  ) : (
                                    <span
                                      key={i}
                                      className="inline-flex items-center rounded-full border border-border/70 bg-card px-2.5 py-1 text-xs font-medium text-foreground/85"
                                    >
                                      {src.name}
                                    </span>
                                  ),
                                )}
                              </div>
                            </div>
                          )}

                          {!!m.dataSummary?.actions?.length && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {m.dataSummary.actions.map((act, i) => (
                                <Button key={i} size="sm" variant="outline" onClick={() => runAction(act)} className="h-8 gap-1.5">
                                  {act.label}
                                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                                </Button>
                              ))}
                            </div>
                          )}

                          {m.text && !m.status && !m.failed && !(loading && m.id === messages[messages.length - 1]?.id) && (
                            <div className="mt-2 flex gap-1 text-muted-foreground">
                              <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs" onClick={() => copy(m)}>
                                <Copy className="h-3.5 w-3.5" /> Copiar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 gap-1.5 px-2 text-xs"
                                onClick={() => speak(m)}
                                aria-pressed={speakingId === m.id}
                              >
                                {speakingId === m.id ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                                {speakingId === m.id ? "Dejar de leer" : "Escuchar"}
                              </Button>
                            </div>
                          )}
                        </div>
                      </li>
                    ),
                  )}
                </ol>
              )}
            </div>
          </div>

          <div className="mx-auto w-full max-w-3xl shrink-0 px-1 sm:px-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
              className="flex items-end gap-2 rounded-2xl border border-border/80 bg-card p-2 shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15"
            >
              <label htmlFor="assistant-question" className="sr-only">
                Tu pregunta
              </label>
              <textarea
                id="assistant-question"
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask(input);
                  }
                }}
                placeholder={listening ? "Te escucho…" : "Escribí tu pregunta"}
                className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground sm:text-[15px]"
              />
              <Button
                type="button"
                variant={listening ? "destructive" : "ghost"}
                size="icon"
                onClick={toggleVoice}
                className="h-10 w-10 shrink-0 rounded-xl"
                aria-label={listening ? "Dejar de dictar" : "Dictar la pregunta"}
                title={listening ? "Dejar de dictar" : "Dictar la pregunta"}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              {loading ? (
                <Button type="button" onClick={stop} className="h-10 shrink-0 gap-1.5 rounded-xl px-3" aria-label="Frenar la respuesta">
                  <Square className="h-3.5 w-3.5 fill-current" /> Frenar
                </Button>
              ) : (
                <Button type="submit" size="icon" disabled={!input.trim()} className="h-10 w-10 shrink-0 rounded-xl" aria-label="Enviar la pregunta">
                  <ArrowUp className="h-4 w-4" />
                </Button>
              )}
            </form>
            <p className="mt-1.5 text-center text-xs text-muted-foreground">
              Responde con los datos de la app. Revisá los números importantes antes de usarlos en un informe.
            </p>
          </div>
        </div>
      </div>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="left" className="flex w-[20rem] max-w-[88vw] flex-col gap-0 p-3">
          <SheetHeader className="px-2 pb-3 text-left">
            <SheetTitle>Conversaciones anteriores</SheetTitle>
            <SheetDescription className="sr-only">Tus conversaciones con el asistente de los últimos 10 días.</SheetDescription>
          </SheetHeader>
          <AssistantHistory
            className="min-h-0 flex-1"
            conversations={conversations}
            activeId={conversationId}
            onOpen={openConversation}
            onDelete={removeConversation}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
