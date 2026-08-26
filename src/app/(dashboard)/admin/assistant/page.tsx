"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sparkles, Send, Bot, User, TrendingUp, Users, Car, FileText,
  RefreshCw, Package, Volume2, VolumeX, Mic, MicOff, MapPin,
  FileSpreadsheet, CheckCircle2, ArrowUpRight, Copy, Download
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import {
  Bar, BarChart, ResponsiveContainer, XAxis, YAxis,
  Tooltip as RechartsTooltip, Cell, Pie, PieChart,
  Line, LineChart, Area, AreaChart
} from "recharts";

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "es-AR";

        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setInput(prev => {
              const cleanedPrev = prev.trim();
              return cleanedPrev ? `${cleanedPrev} ${transcript}` : transcript;
            });
          }
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      toast.error("El reconocimiento de voz no está soportado en este navegador.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        setIsListening(false);
      }
    }
  };

  const handleSpeakText = (msgId: string, text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("La síntesis de voz no está soportada en este navegador.");
      return;
    }

    if (currentlySpeakingId === msgId) {
      window.speechSynthesis.cancel();
      setCurrentlySpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text
      .replace(/###/g, "")
      .replace(/####/g, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/`/g, "")
      .replace(/\[([^\]]+)\]\((.*?)\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "es-AR";
    utterance.rate = 1.0;

    utterance.onend = () => setCurrentlySpeakingId(null);
    utterance.onerror = () => setCurrentlySpeakingId(null);

    setCurrentlySpeakingId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const copyToClipboard = (text: string) => {
    const cleanText = text
      .replace(/###/g, "")
      .replace(/####/g, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/`/g, "")
      .replace(/\[([^\]]+)\]\((.*?)\)/g, "$1")
      .trim();

    navigator.clipboard.writeText(cleanText);
    toast.success("Respuesta copiada al portapapeles");
  };

  const exportToCSV = (title: string, data: any[]) => {
    if (!data || data.length === 0) return;
    const keys = Object.keys(data[0]);
    const csvContent = "data:text/csv;charset=utf-8,"
      + keys.join(",") + "\n"
      + data.map(row => keys.map(k => `"${row[k]}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${title.replace(/\s+/g, "_")}_datos.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Datos exportados a CSV correctamente");
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

    const userMessage: Message = { id: userMsgId, sender: "user", text, timestamp: new Date() };
    const historyToSend = messages
      .filter(m => m.id !== "welcome")
      .map(m => ({ role: m.sender, content: m.text }));

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text, history: historyToSend }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("ReadableStream not supported");

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
              if (payloadStr.startsWith("{")) {
                const parsed = JSON.parse(payloadStr);
                if (parsed.chunk) {
                  currentText += parsed.chunk;
                  setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, text: currentText } : m));
                } else if (parsed.done) {
                  dataSummary = parsed.dataSummary || { sources: [], actions: [] };
                  setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, dataSummary } : m));
                }
              }
            } catch (err) {}
          }
        }
      }
    } catch (err: any) {
      toast.error("Error al procesar la consulta");
      setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, text: "⚠️ Ocurrió un error al procesar la consulta. Por favor, intenta de nuevo." } : m));
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleQuery(input);
  };

  const clearChat = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    setCurrentlySpeakingId(null);
    setMessages([{
      id: "welcome",
      sender: "assistant",
      text: "### Sistema de Asistencia Inteligente Municipal\n\nEste canal automatizado facilita la consulta y auditoría de la base de datos de MuniGestión en tiempo real. Puede formular preguntas o solicitar reportes estructurados sobre los módulos de **Recursos Humanos, Presupuesto, Vehículos, Casos Sociales, Convenios e Inventario**.\n\nPor favor, detalle la consulta administrativa o el análisis que desea realizar.",
      timestamp: new Date()
    }]);
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

  const parseMarkdown = (text: string) => {
    const lines = text.split("\n");
    let inTable = false;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];
    const elements: React.ReactNode[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        const parts = trimmed.split("|").map(p => p.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
        if (parts.every(p => p.startsWith(":") || p.startsWith("-") || p === "")) return;
        if (!inTable) { inTable = true; tableHeaders = parts; } else { tableRows.push(parts); }
        return;
      } else if (inTable) {
        elements.push(
          <div key={`table-${index}`} className="my-4 overflow-x-auto rounded-2xl border border-border/40 shadow-sm bg-card/60 backdrop-blur-sm">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-muted/70 text-muted-foreground uppercase font-bold tracking-wider border-b border-border/40">
                  {tableHeaders.map((header, hIdx) => <th key={hIdx} className="px-4 py-3 font-black">{header}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {tableRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-muted/20 transition-colors">
                    {row.map((cell, cIdx) => <td key={cIdx} className="px-4 py-3 font-medium" dangerouslySetInnerHTML={{ __html: inlineMarkdown(cell) }} />)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        inTable = false; tableHeaders = []; tableRows = [];
      }

      if (trimmed.startsWith("###")) {
        elements.push(<h3 key={index} className="text-lg font-black tracking-tight mt-5 mb-2 text-foreground flex items-center gap-2">{trimmed.replace("###", "").trim()}</h3>);
      } else if (trimmed.startsWith("####")) {
        elements.push(<h4 key={index} className="text-xs font-black uppercase tracking-wider text-muted-foreground mt-4 mb-2">{trimmed.replace("####", "").trim()}</h4>);
      } else if (trimmed.startsWith("*   ") || trimmed.startsWith("-   ")) {
        elements.push(<li key={index} className="ml-5 list-disc text-xs text-foreground/90 my-1 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineMarkdown(trimmed.substring(4)) }} />);
      } else if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
        elements.push(<li key={index} className="ml-5 list-disc text-xs text-foreground/90 my-1 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineMarkdown(trimmed.substring(2)) }} />);
      } else if (trimmed.match(/^\d+\.\s/)) {
        elements.push(<li key={index} className="ml-5 list-decimal text-xs text-foreground/90 my-1 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineMarkdown(trimmed.replace(/^\d+\.\s/, "")) }} />);
      } else if (trimmed !== "") {
        elements.push(<p key={index} className="text-xs text-foreground/90 leading-relaxed my-2 font-medium" dangerouslySetInnerHTML={{ __html: inlineMarkdown(trimmed) }} />);
      }
    });

    if (inTable && tableHeaders.length > 0) {
      elements.push(
        <div key="table-final" className="my-4 overflow-x-auto rounded-2xl border border-border/40 shadow-sm bg-card/60 backdrop-blur-sm">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-muted/70 text-muted-foreground uppercase font-bold tracking-wider border-b border-border/40">
                {tableHeaders.map((header, hIdx) => <th key={hIdx} className="px-4 py-3 font-black">{header}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-muted/20 transition-colors">
                  {row.map((cell, cIdx) => <td key={cIdx} className="px-4 py-3 font-medium" dangerouslySetInnerHTML={{ __html: inlineMarkdown(cell) }} />)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return elements;
  };

  const inlineMarkdown = (text: string) => {
    let html = text;
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong class='font-black text-foreground'>$1</strong>");
    html = html.replace(/\*(.*?)\*/g, "<em class='text-muted-foreground font-medium'>$1</em>");
    html = html.replace(/`(.*?)`/g, "<code class='bg-muted px-1.5 py-0.5 rounded text-rose-500 font-bold font-mono text-xs'>$1</code>");
    return html;
  };

  const renderChart = (chart: any) => {
    if (!chart || !chart.data || chart.data.length === 0) return null;
    const chartTitle = chart.title || "Gráfico de Análisis de Datos";

    return (
      <div className="mt-4 p-5 rounded-2xl border border-border/40 shadow-sm bg-card/60 backdrop-blur-sm w-full min-h-[220px]">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">{chartTitle}</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => exportToCSV(chartTitle, chart.data)}
            className="h-7 text-[10px] font-bold gap-1 text-primary hover:bg-primary/10 rounded-lg"
            title="Exportar datos del gráfico a CSV / Excel"
          >
            <Download className="h-3 w-3" /> Exportar CSV
          </Button>
        </div>

        {chart.type === "line" ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chart.data}>
              <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: isDark ? '#f8fafc' : '#0f172a',
                  fontSize: '11px'
                }}
              />
              <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} />
            </LineChart>
          </ResponsiveContainer>
        ) : chart.type === "area" ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chart.data}>
              <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: isDark ? '#f8fafc' : '#0f172a',
                  fontSize: '11px'
                }}
              />
              <Area type="monotone" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : chart.type === "bar" ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chart.data}>
              <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: isDark ? '#f8fafc' : '#0f172a',
                  fontSize: '11px'
                }}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]}>
                {chart.data.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-between">
            <ResponsiveContainer width="60%" height={200}>
              <PieChart>
                <Pie data={chart.data} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value" stroke="none">
                  {chart.data.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
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
                  <span className="truncate max-w-[120px]">{entry.name}: <b>{entry.value}</b></span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl animate-pulse">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="text-3xl font-black tracking-tight text-foreground">Asistente de IA (Data Analytics)</h2>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm">Consultas y análisis dinámico de la base de datos municipal en tiempo real.</p>
        </div>
        <Button
          variant="outline"
          onClick={clearChat}
          className="rounded-xl text-xs font-bold uppercase tracking-wider h-9 flex items-center gap-2 border-border/60 hover:bg-muted/50 text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Limpiar Conversación
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-1 flex flex-col gap-4">
          <Card className="bg-card text-card-foreground border border-border/60 shadow-sm h-full flex flex-col overflow-hidden rounded-3xl">
            <CardHeader className="pb-3 shrink-0">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-foreground">Consultas Frecuentes</CardTitle>
              <CardDescription className="text-[11px] text-muted-foreground">Selecciona un tema para consultar los datos reales al instante.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 overflow-y-auto flex-1 pr-2">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuery(s.query)}
                  disabled={loading}
                  className="w-full text-left p-3 rounded-2xl border border-border/40 hover:border-primary/50 bg-muted/30 hover:bg-muted/60 transition-all duration-300 group flex items-start gap-3 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <div className={`p-2 rounded-xl ${s.bg} ${s.color} shrink-0 group-hover:scale-110 transition-transform`}>
                    <s.icon className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-foreground leading-tight">{s.label}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">Ej: "{s.query.substring(0, 40)}..."</p>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 flex flex-col h-full">
          <Card className="bg-card text-card-foreground border border-border/60 shadow-sm flex-1 flex flex-col overflow-hidden rounded-[2rem]">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-4 max-w-[85%] ${
                    m.sender === "user" ? "ml-auto flex-row-reverse" : ""
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                    m.sender === "user"
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-muted border-border/60 text-primary"
                  }`}>
                    {m.sender === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div className={`rounded-3xl p-5 shadow-xs text-foreground relative ${
                    m.sender === "user"
                      ? "bg-primary/10 border border-primary/20 rounded-tr-none text-foreground font-semibold"
                      : "bg-muted/40 border border-border/40 rounded-tl-none w-full pr-16 text-foreground"
                  }`}>
                    {m.sender === "user" ? (
                      <p className="text-xs font-semibold leading-relaxed">{m.text}</p>
                    ) : (
                      <div className="space-y-1 select-text">
                        {parseMarkdown(m.text)}
                        {m.dataSummary?.chart && renderChart(m.dataSummary.chart)}
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
                    {m.sender === "assistant" && m.text && (
                      <div className="absolute top-4 right-4 flex items-center gap-1">
                        <button
                          onClick={() => copyToClipboard(m.text)}
                          className="p-1.5 rounded-xl bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                          title="Copiar respuesta al portapapeles"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleSpeakText(m.id, m.text)}
                          className={`p-1.5 rounded-xl transition-all ${
                            currentlySpeakingId === m.id
                              ? "bg-rose-500/20 text-rose-500 animate-pulse"
                              : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                          title={currentlySpeakingId === m.id ? "Detener lectura" : "Escuchar respuesta en voz alta"}
                        >
                          {currentlySpeakingId === m.id ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-4 max-w-[80%]">
                  <div className="w-8 h-8 rounded-full bg-muted border border-border/40 text-primary flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 animate-spin" />
                  </div>
                  <div className="bg-muted/40 border border-border/40 rounded-3xl rounded-tl-none p-4 flex items-center gap-3">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    <p className="text-xs font-semibold text-muted-foreground animate-pulse">
                      Analizando datos municipales y generando visualizaciones...
                    </p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-border/40 bg-muted/20">
              <form onSubmit={handleFormSubmit} className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isListening ? "Escuchando voz..." : "Formule una consulta de datos o pida un gráfico..."}
                  className="rounded-2xl h-11 bg-background text-foreground border-border/60 text-xs shadow-xs focus-visible:ring-primary"
                  disabled={loading}
                />
                <Button
                  type="button"
                  onClick={toggleVoiceInput}
                  variant={isListening ? "destructive" : "outline"}
                  size="icon"
                  className={`rounded-2xl h-11 w-11 shrink-0 ${isListening ? "animate-pulse" : "border-border/60 text-foreground"}`}
                  title={isListening ? "Detener dictado por voz" : "Dictar consulta por voz (Micrófono)"}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="rounded-2xl h-11 px-5 font-bold text-xs uppercase tracking-wider bg-primary text-primary-foreground shadow-md shrink-0"
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
