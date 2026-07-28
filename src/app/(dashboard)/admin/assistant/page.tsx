"use client";

import { useState, useRef, useEffect } from "react";
import { queryAssistantAction } from "../actions/assistant-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  Send,
  Bot,
  User,
  TrendingUp,
  Users,
  Car,
  FileText,
  ArrowRight,
  RefreshCw,
  Package,
  BookOpen
} from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: Date;
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: "### 👋 ¡Hola! Soy tu Asistente Inteligente Municipal\n\nEstoy conectado en tiempo real a la base de datos de MuniGestión. Puedo responder tus preguntas sobre **Recursos Humanos, Presupuesto, Vehículos, Casos Sociales, Convenios e Inventario**.\n\n¿En qué puedo ayudarte hoy?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleQuery = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsgId = Math.random().toString();
    const assistantMsgId = Math.random().toString();

    const userMessage: Message = {
      id: userMsgId,
      sender: "user",
      text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await queryAssistantAction(text);

      const assistantMessage: Message = {
        id: assistantMsgId,
        sender: "assistant",
        text: response.answer,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      toast.error("Error al procesar la consulta", {
        description: err.message || "Inténtalo de nuevo en unos momentos."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleQuery(input);
  };

  const clearChat = () => {
    setMessages([
      {
        id: "welcome",
        sender: "assistant",
        text: "### 👋 ¡Hola! Soy tu Asistente Inteligente Municipal\n\nEstoy conectado en tiempo real a la base de datos de MuniGestión. Puedo responder tus preguntas sobre **Recursos Humanos, Presupuesto, Vehículos, Casos Sociales, Convenios e Inventario**.\n\n¿En qué puedo ayudarte hoy?",
        timestamp: new Date()
      }
    ]);
  };

  const suggestions = [
    { label: "Nómina de Personal y RRHH", query: "presupuesto total sueldos personal activo", icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Ejecución Presupuestaria", query: "gasto total ordenes de compra presupuestos", icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Estado de la Flota Vehicular", query: "estado vehiculos taller nafta combustible", icon: Car, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Casos Sociales y Vulnerabilidad", query: "casos urgentes abiertos familias personas registradas", icon: FileText, color: "text-rose-500", bg: "bg-rose-500/10" },
    { label: "Convenios Institucionales", query: "convenios vigentes monto de acuerdos", icon: BookOpen, color: "text-indigo-500", bg: "bg-indigo-500/10" },
    { label: "Stock Crítico de Insumos", query: "insumos stock bajo deposito agotados", icon: Package, color: "text-teal-500", bg: "bg-teal-500/10" },
  ];

  // A ultra-lightweight markdown parser to render basic markdown elements (tables, headers, bold, list items) beautifully
  const parseMarkdown = (text: string) => {
    const lines = text.split("\n");
    let inTable = false;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];

    const elements: React.ReactNode[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Check for table structure
      if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        const parts = trimmed.split("|").map(p => p.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);

        // Skip separator lines like |---|---|
        if (parts.every(p => p.startsWith(":") || p.startsWith("-") || p === "")) {
          return;
        }

        if (!inTable) {
          inTable = true;
          tableHeaders = parts;
        } else {
          tableRows.push(parts);
        }
        return;
      } else if (inTable) {
        // Table finished, render it
        elements.push(
          <div key={`table-${index}`} className="my-4 overflow-x-auto rounded-2xl border border-border/40 shadow-sm bg-background/50 backdrop-blur-sm">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-muted/70 text-muted-foreground uppercase font-bold tracking-wider border-b border-border/40">
                  {tableHeaders.map((header, hIdx) => (
                    <th key={hIdx} className="px-4 py-3 font-black">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/45">
                {tableRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-muted/20 transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-4 py-3 font-medium" dangerouslySetInnerHTML={{ __html: inlineMarkdown(cell) }} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        inTable = false;
        tableHeaders = [];
        tableRows = [];
      }

      // Headers
      if (trimmed.startsWith("###")) {
        elements.push(
          <h3 key={index} className="text-lg font-extrabold tracking-tight mt-5 mb-2 text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-500 animate-pulse" />
            {trimmed.replace("###", "").trim()}
          </h3>
        );
      } else if (trimmed.startsWith("####")) {
        elements.push(
          <h4 key={index} className="text-sm font-black uppercase tracking-wider text-muted-foreground mt-4 mb-2">
            {trimmed.replace("####", "").trim()}
          </h4>
        );
      } else if (trimmed.startsWith("*   ") || trimmed.startsWith("-   ")) {
        elements.push(
          <li key={index} className="ml-5 list-disc text-sm text-foreground/90 my-1 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineMarkdown(trimmed.substring(4)) }} />
        );
      } else if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
        elements.push(
          <li key={index} className="ml-5 list-disc text-sm text-foreground/90 my-1 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineMarkdown(trimmed.substring(2)) }} />
        );
      } else if (trimmed.match(/^\d+\.\s/)) {
        const textContent = trimmed.replace(/^\d+\.\s/, "");
        elements.push(
          <li key={index} className="ml-5 list-decimal text-sm text-foreground/90 my-1 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineMarkdown(textContent) }} />
        );
      } else if (trimmed !== "") {
        elements.push(
          <p key={index} className="text-sm text-foreground/90 leading-relaxed my-2.5 font-medium" dangerouslySetInnerHTML={{ __html: inlineMarkdown(trimmed) }} />
        );
      }
    });

    // In case query ended inside a table
    if (inTable && tableHeaders.length > 0) {
      elements.push(
        <div key="table-final" className="my-4 overflow-x-auto rounded-2xl border border-border/40 shadow-sm bg-background/50 backdrop-blur-sm">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-muted/70 text-muted-foreground uppercase font-bold tracking-wider border-b border-border/40">
                {tableHeaders.map((header, hIdx) => (
                  <th key={hIdx} className="px-4 py-3 font-black">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/45">
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-muted/20 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-4 py-3 font-medium" dangerouslySetInnerHTML={{ __html: inlineMarkdown(cell) }} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return elements;
  };

  // Basic inline formatting: **bold**, *italics*, `code`
  const inlineMarkdown = (text: string) => {
    let html = text;
    // Bold **text**
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong class='font-black text-foreground'>$1</strong>");
    // Italics *text*
    html = html.replace(/\*(.*?)\*/g, "<em class='text-muted-foreground font-medium'>$1</em>");
    // Code `text`
    html = html.replace(/`(.*?)`/g, "<code class='bg-muted px-1.5 py-0.5 rounded text-rose-500 font-bold font-mono text-xs'>$1</code>");
    return html;
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 h-[calc(100vh-8rem)] flex flex-col">

      {/* Header section */}
      <div className="flex justify-between items-center shrink-0">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl animate-pulse">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="text-3xl font-black tracking-tight text-foreground">Asistente de IA</h2>
          </div>
          <p className="text-muted-foreground text-sm">Consultas en lenguaje natural de la gestión municipal.</p>
        </div>

        <Button
          variant="outline"
          onClick={clearChat}
          className="rounded-xl text-xs font-bold uppercase tracking-wider h-9 flex items-center gap-2 border-border/40 hover:bg-muted/50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Limpiar Conversación
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">

        {/* Left Side: Suggestions panel */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <Card className="bg-white/75 dark:bg-card/75 backdrop-blur-md border border-border/40 shadow-municipal h-full flex flex-col overflow-hidden">
            <CardHeader className="pb-3 shrink-0">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-foreground">Consultas Frecuentes</CardTitle>
              <CardDescription className="text-xs">Selecciona un tema para consultar los datos reales al instante.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 overflow-y-auto flex-1 pr-2">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuery(s.query)}
                  disabled={loading}
                  className="w-full text-left p-3 rounded-2xl border border-border/30 hover:border-border/60 bg-muted/20 hover:bg-muted/40 transition-all duration-300 group flex items-start gap-3 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <div className={`p-2 rounded-xl ${s.bg} ${s.color} shrink-0 group-hover:scale-110 transition-transform`}>
                    <s.icon className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-foreground leading-tight">{s.label}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">Ej: "{s.query.substring(0, 45)}..."</p>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Conversation Area */}
        <div className="lg:col-span-3 flex flex-col h-full">
          <Card className="bg-white/75 dark:bg-card/75 backdrop-blur-md border border-border/40 shadow-municipal flex-1 flex flex-col overflow-hidden rounded-[2rem]">

            {/* Conversation Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-4 max-w-[85%] ${
                    m.sender === "user" ? "ml-auto flex-row-reverse" : ""
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                    m.sender === "user"
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-muted border-border/40 text-blue-500"
                  }`}>
                    {m.sender === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>

                  {/* Bubble */}
                  <div className={`rounded-3xl p-5 shadow-sm text-foreground relative ${
                    m.sender === "user"
                      ? "bg-blue-600/10 border border-blue-500/20 rounded-tr-none"
                      : "bg-background/45 border border-border/30 rounded-tl-none"
                  }`}>
                    {m.sender === "user" ? (
                      <p className="text-sm font-semibold leading-relaxed">{m.text}</p>
                    ) : (
                      <div className="space-y-1 select-text">
                        {parseMarkdown(m.text)}
                      </div>
                    )}

                    <span className="text-[9px] text-muted-foreground font-bold tracking-wider uppercase block mt-2.5 text-right">
                      {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}

              {/* Typing loader */}
              {loading && (
                <div className="flex gap-4 max-w-[85%]">
                  <div className="w-8 h-8 rounded-full bg-muted border border-border/40 flex items-center justify-center shrink-0 text-blue-500 animate-bounce">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-3xl p-5 bg-background/45 border border-border/30 rounded-tl-none shadow-sm flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input form */}
            <div className="p-4 bg-background/30 border-t border-border/30 shrink-0">
              <form onSubmit={handleFormSubmit} className="flex gap-2 items-center">
                <Input
                  placeholder="Haz una pregunta sobre el municipio (ej: ¿Cuál es el presupuesto total de sueldos?)..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={loading}
                  className="flex-1 h-12 rounded-2xl bg-background/50 border-border/40 text-foreground text-sm font-medium focus-visible:ring-blue-500 px-4"
                />
                <Button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="h-12 w-12 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all shrink-0 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>

          </Card>
        </div>

      </div>

    </div>
  );
}
