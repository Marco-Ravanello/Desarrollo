"use client";

import { Download } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Area, AreaChart, Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { chartPalette } from "@/lib/chart-colors";

export type AssistantChartData = { type?: string; title?: string; data?: { name: string; value: number }[] };

function downloadCsv(title: string, data: Record<string, unknown>[]) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const csv = [keys.join(","), ...data.map((row) => keys.map((k) => `"${String(row[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/\s+/g, "_")}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast.success("Se descargaron los datos del gráfico.");
}

/** El gráfico que acompaña una respuesta (barras, torta, línea o área), con la descarga de sus datos. */
export function AssistantChart({ chart }: { chart: AssistantChartData }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const colors = chartPalette(isDark);
  const data = chart.data ?? [];
  if (data.length === 0) return null;
  const title = chart.title || "Gráfico";
  const tooltip = {
    contentStyle: {
      backgroundColor: isDark ? "#0f172a" : "#ffffff",
      borderRadius: "10px",
      border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.12)"}`,
      color: isDark ? "#f8fafc" : "#0f172a",
      fontSize: "12px",
    },
  };
  const axis = { stroke: "#888888", fontSize: 11, tickLine: false, axisLine: false } as const;

  return (
    <div className="mt-3 w-full rounded-xl border border-border/70 bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <Button size="sm" variant="ghost" onClick={() => downloadCsv(title, data)} className="h-8 gap-1.5 text-xs">
          <Download className="h-3.5 w-3.5" /> Descargar datos
        </Button>
      </div>
      {chart.type === "line" ? (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data}>
            <XAxis dataKey="name" {...axis} />
            <YAxis {...axis} allowDecimals={false} />
            <Tooltip {...tooltip} />
            <Line type="monotone" dataKey="value" name="Cantidad" stroke={colors[0]} strokeWidth={3} dot={{ r: 4, fill: colors[0] }} />
          </LineChart>
        </ResponsiveContainer>
      ) : chart.type === "area" ? (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data}>
            <XAxis dataKey="name" {...axis} />
            <YAxis {...axis} allowDecimals={false} />
            <Tooltip {...tooltip} />
            <Area type="monotone" dataKey="value" name="Cantidad" stroke={colors[0]} fill={colors[0]} fillOpacity={0.2} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      ) : chart.type === "bar" ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data}>
            <XAxis dataKey="name" {...axis} />
            <YAxis {...axis} allowDecimals={false} />
            <Tooltip {...tooltip} cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.05)" }} />
            <Bar dataKey="value" name="Cantidad" radius={[6, 6, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="h-[200px] w-full sm:w-3/5">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value" stroke="none">
                  {data.map((_, i) => (
                    <Cell key={i} fill={colors[i % colors.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="grid w-full gap-1.5 text-sm sm:w-2/5">
            {data.map((d, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{d.name}</span>
                <span className="font-semibold tabular-nums">{d.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
