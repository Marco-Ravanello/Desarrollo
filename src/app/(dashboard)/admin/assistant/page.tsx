"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  RefreshCw,
  Package,
  BookOpen,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  MapPin,
  FileSpreadsheet,
  CheckCircle2,
  ArrowUpRight,
  ExternalLink,
  ShieldAlert
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip, Cell, Pie, PieChart } from "recharts";

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: Date;
  dataSummary?: any;
}

const COLORS = ['#3b82f6', '#10b981', '#f5a623', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AssistantPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: "### Sistema de Asistencia Inteligente Municipal\n\nEste canal automatizado facilita la consulta y auditoría de la base de datos de MuniGestión en tiempo real. Puede formular preguntas o solicitar reportes estructurados sobre los módulos de **Recursos Humanos, Presupuesto, Vehículos, Casos Sociales, Convenios e Inventario**.\n\nPor favor, detalle la consulta administrativa o el análisis que desea realizar.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false; // Stop automatically when user stops speaking
        recognition.interimResults = false;
        recognition.lang = "es-AR"; // Argentina Spanish

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setInput(prev => {
              const cleanedPrev = prev.trim();
              return cleanedPrev ? `${cleanedPrev} ${transcript}` : transcript;
            });
          }
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          if (event.error !== "no-speech") {
            toast.error(`Error de reconocimiento de voz: ${event.error}`);
          }
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error("El dictado por voz no es soportado por este navegador.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
      }
    }
  };

  // Clean speaking on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speakText = (text: string, msgId: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      toast.error("Tu navegador no soporta síntesis de voz (Text-to-Speech).");
      return;
    }

    if (currentlySpeakingId === msgId) {
      window.speechSynthesis.cancel();
      setCurrentlySpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel(); // Stop any active reading first

    const cleanText = cleanMarkdownForSpeech(text);
    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Get Spanish voice
    const voices = window.speechSynthesis.getVoices();
    const esVoice = voices.find(v => v.lang.includes("es-AR")) ||
                    voices.find(v => v.lang.startsWith("es"));
    if (esVoice) {
      utterance.voice = esVoice;
    }

    utterance.rate = 1.0; // Normal rate
    utterance.pitch = 1.0;

    utterance.onend = () => {
      setCurrentlySpeakingId(null);
    };

    utterance.onerror = (e) => {
      console.error("Speech error:", e);
      setCurrentlySpeakingId(null);
    };

    setCurrentlySpeakingId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const cleanMarkdownForSpeech = (markdown: string) => {
    let clean = markdown;
    // Strip tables first (lines starting with pipes)
    clean = clean.split("\n")
      .filter(line => {
        const trimmed = line.trim();
        // Remove lines with only hyphens/pipes used as table separators
        if (trimmed.startsWith("|") && trimmed.includes("-")) return false;
        return true;
      })
      .join("\n");

    clean = clean.replace(/\|/g, " ") // replace table dividers with spaces
      .replace(/#{1,6}\s+/g, "") // remove markdown headers
      .replace(/\*\*/g, "") // remove bold markers
      .replace(/\*/g, "") // remove italic markers
      .replace(/`/g, "") // remove inline code
      .replace(/\[([^\]]+)\]\((.*?)\)/g, "$1") // convert markdown links [text](url) to just "text"
      .replace(/\s+/g, " "); // collapse whitespace
    return clean.trim();
  };

  const handleActionButton = (act: { label: string; actionType: string; payload?: any }) => {
    if (act.actionType === "NAVIGATE" && act.payload?.path) {
      router.push(act.payload.path);
      toast.success(`Navegando a: ${act.label}`);
    } else if (act.actionType === "OPEN_DIALOG") {
      router.push("/tasks");
      toast.info("Por favor, crea una nueva tarea para asignar este caso.");
    }
  };

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

    // Prepare history to send (excluding the welcome message to keep prompt focused)
    const historyToSend = messages
      .filter(m => m.id !== "welcome")
      .map(m => ({
        role: m.sender,
        content: m.text
      }));

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    // Insert an empty assistant message which we will populate in real-time
    const assistantMessage: Message = {
      id: assistantMsgId,
      sender: "assistant",
      text: "",
      timestamp: new Date(),
      dataSummary: { sources: [], actions: [] }
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      const response = await fetch("/api/assistant/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: text, history: historyToSend }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("ReadableStream not supported in this browser.");

      let currentText = "";
      let dataSummary: any = { sources: [], actions: [] };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value);
        const lines = chunkText.split("\n");

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === "") continue;

          if (trimmed.startsWith("data: ")) {
            try {
              const payloadStr = trimmed.substring(6);
              // Safely handle if it's the metadata or completion event
              if (payloadStr.startsWith("{")) {
                const parsed = JSON.parse(payloadStr);
                if (parsed.chunk) {
                  currentText += parsed.chunk;
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === assistantMsgId
                        ? { ...m, text: currentText }
                        : m
                    )
                  );
                } else if (parsed.done) {
                  dataSummary = parsed.dataSummary || { sources: [], actions: [] };
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === assistantMsgId
                        ? { ...m, dataSummary }
                        : m
                    )
                  );
                }
              }
            } catch (err) {}
          } else if (trimmed.startsWith("event: metadata")) {
            // metadata follows
          }
        }
      }
    } catch (err: any) {
      toast.error("Error al procesar la consulta", {
        description: err.message || "Inténtalo de nuevo en unos momentos."
      });
      // Fallback or show error in message
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsgId
            ? { ...m, text: "⚠️ Ocurrió un error al procesar la consulta por streaming. Por favor, intenta de nuevo." }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleQuery(input);
  };

  const clearChat = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setCurrentlySpeakingId(null);
    setMessages([
      {
        id: "welcome",
        sender: "assistant",
        text: "### Sistema de Asistencia Inteligente Municipal\n\nEste canal automatizado facilita la consulta y auditoría de la base de datos de MuniGestión en tiempo real. Puede formular preguntas o solicitar reportes estructurados sobre los módulos de **Recursos Humanos, Presupuesto, Vehículos, Casos Sociales, Convenios e Inventario**.\n\nPor favor, detalle la consulta administrativa o el análisis que desea realizar.",
        timestamp: new Date()
      }
    ]);
  };

  const suggestions = [
    { label: "Nómina de Personal y RRHH", query: "presupuesto total sueldos personal activo", icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Ejecución Presupuestaria", query: "gasto total ordenes de compra presupuestos", icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Estado de la Flota Vehicular", query: "estado vehiculos taller nafta combustible", icon: Car, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Casos por Edad", query: "mostrar un gráfico de casos por edad", icon: TrendingUp, color: "text-rose-500", bg: "bg-rose-500/10" },
    { label: "Casos por Género", query: "dibujar gráfico de casos por género", icon: Users, color: "text-indigo-500", bg: "bg-indigo-500/10" },
    { label: "Casos por Prioridad", query: "mostrar gráfico de casos por prioridad", icon: FileText, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Gráfico de Casos por Área", query: "mostrar gráfico de casos por área municipal", icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-500/10" },
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

  // Helper to render responsive Recharts charts inside the bubble
  const renderChart = (chart: any) => {
    if (!chart || !chart.data || chart.data.length === 0) return null;

    return (
      <div className="mt-4 p-5 rounded-2xl border border-border/40 shadow-sm bg-background/60 backdrop-blur-sm w-full min-h-[220px]">
        <p className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-4">{chart.title || "Gráfico de datos"}</p>

        {chart.type === "bar" ? (
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart.data}>
                <XAxis
                  dataKey="name"
                  fontSize={8}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: isDark ? '#94a3b8' : '#64748b' }}
                />
                <YAxis
                  fontSize={8}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: isDark ? '#94a3b8' : '#64748b' }}
                />
                <RechartsTooltip
                  cursor={{fill: isDark ? '#1e293b' : '#f8fafc'}}
                  contentStyle={{
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderRadius: '8px',
                    border: isDark ? '1px solid #1e293b' : 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    color: isDark ? '#f8fafc' : '#0f172a',
                    fontSize: '10px'
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={24}>
                  {chart.data.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[180px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chart.data}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {chart.data.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderRadius: '8px',
                    border: isDark ? '1px solid #1e293b' : 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    color: isDark ? '#f8fafc' : '#0f172a',
                    fontSize: '10px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="hidden sm:flex flex-col gap-1.5 ml-4 shrink-0 text-[10px] text-muted-foreground font-semibold">
              {chart.data.map((entry: any, index: number) => (
                <div key={index} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="truncate max-w-[120px]">{entry.name}: **{entry.value}**</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
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
                      : "bg-background/45 border border-border/30 rounded-tl-none w-full pr-12"
                  }`}>
                    {m.sender === "user" ? (
                      <p className="text-sm font-semibold leading-relaxed">{m.text}</p>
                    ) : (
                      <div className="space-y-1 select-text">
                        {parseMarkdown(m.text)}

                        {/* Interactive Recharts Chart rendering */}
                        {m.dataSummary?.chart && renderChart(m.dataSummary.chart)}

                        {/* Verified Sources rendering */}
                        {m.dataSummary?.sources && m.dataSummary.sources.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-border/20 space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1 select-none">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              Fuentes Verificadas de la BD Municipal
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {m.dataSummary.sources.map((src: any, idx: number) => (
                                <button
                                  key={idx}
                                  onClick={() => src.url && router.push(src.url)}
                                  className="text-xs bg-muted/65 hover:bg-muted/80 border border-border/30 rounded-xl px-2.5 py-1.5 font-bold transition-all text-foreground/85 hover:text-foreground flex items-center gap-1.5"
                                  title={src.url ? "Ver ficha de origen" : undefined}
                                >
                                  {src.type === "Ciudadano" && <User className="h-3 w-3 text-blue-500" />}
                                  {src.type === "Caso Social" && <FileText className="h-3 w-3 text-rose-500" />}
                                  {src.type === "Orden de Compra" && <FileSpreadsheet className="h-3 w-3 text-emerald-500" />}
                                  {src.type === "Vehículo" && <Car className="h-3 w-3 text-amber-500" />}
                                  {src.type === "Recursos Humanos" && <Users className="h-3 w-3 text-indigo-500" />}
                                  {src.name}
                                  {src.url && <ArrowUpRight className="h-2.5 w-2.5 text-muted-foreground" />}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Interactive Action buttons */}
                        {m.dataSummary?.actions && m.dataSummary.actions.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2 select-none">
                            {m.dataSummary.actions.map((act: any, idx: number) => (
                              <Button
                                key={idx}
                                size="sm"
                                variant="outline"
                                onClick={() => handleActionButton(act)}
                                className="h-8 rounded-xl text-xs font-bold border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 text-blue-600 hover:text-blue-700 flex items-center gap-1.5"
                              >
                                {act.label === "Ver en Mapa Social" && <MapPin className="h-3.5 w-3.5" />}
                                {act.label === "Asignar Tarea" && <CheckCircle2 className="h-3.5 w-3.5" />}
                                {act.label}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {m.sender === "assistant" && (
                      <button
                        onClick={() => speakText(m.text, m.id)}
                        className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-muted/60 transition-all text-muted-foreground hover:text-blue-500"
                        title={currentlySpeakingId === m.id ? "Detener voz" : "Escuchar respuesta"}
                      >
                        {currentlySpeakingId === m.id ? (
                          <VolumeX className="h-4 w-4 text-blue-500 animate-pulse" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </button>
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
                  type="button"
                  onClick={toggleListening}
                  variant="outline"
                  disabled={loading}
                  className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 border-border/40 transition-all ${
                    isListening
                      ? "bg-red-500 text-white border-red-500 animate-pulse hover:bg-red-600"
                      : "bg-background/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                  title={isListening ? "Detener dictado" : "Dictar por voz (Speech-to-Text)"}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
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
