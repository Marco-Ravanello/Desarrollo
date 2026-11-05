"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Area, AreaChart, Bar, BarChart, Cell, LabelList, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { chartColors, chartFileName, chartSheetRows, formatChartValue, horizontalBars, share, type AssistantChartData } from "@/lib/assistant-chart";

export type { AssistantChartData };

async function downloadExcel(chart: AssistantChartData) {
  const rows = chartSheetRows(chart);
  if (!rows.length) return;
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.json_to_sheet(rows);
  const nameWidth = Math.min(50, Math.max(12, ...rows.map((r) => String(Object.values(r)[0]).length + 2)));
  sheet["!cols"] = [{ wch: nameWidth }, { wch: 14 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Datos");
  XLSX.writeFile(book, chartFileName(chart.title || "Gráfico"));
  toast.success("Se descargó la planilla de Excel.");
}

/**
 * El gráfico que acompaña una respuesta (barras, torta, línea o área): cada barra con su número arriba,
 * colores con sentido (prioridad, estado) cuando los datos los traen, y la descarga en Excel.
 */
export function AssistantChart({ chart }: { chart: AssistantChartData }) {
  const { resolvedTheme } = useTheme();
  const [downloading, setDownloading] = useState(false);
  const isDark = resolvedTheme === "dark";
  const data = chart.data ?? [];
  if (data.length === 0) return null;
  const colors = chartColors(chart, isDark);
  const title = chart.title || "Gráfico";
  const fmt = (v: unknown) => formatChartValue(Number(v) || 0, chart.format);
  const valueName = chart.columns?.[1] || (chart.format === "pesos" ? "Monto" : "Cantidad");
  const tooltip = {
    formatter: (v: unknown) => [fmt(v), valueName] as [string, string],
    contentStyle: {
      backgroundColor: isDark ? "#0f172a" : "#ffffff",
      borderRadius: "10px",
      border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.12)"}`,
      color: isDark ? "#f8fafc" : "#0f172a",
      fontSize: "12px",
    },
    cursor: { fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.05)" },
  };
  const ink = isDark ? "#CBD5E1" : "#475569";
  const axis = { stroke: ink, fontSize: 11, tickLine: false, axisLine: false } as const;
  const label = { fill: isDark ? "#F1F5F9" : "#0F172A", fontSize: 11, fontWeight: 600, formatter: fmt };
  const total = data.reduce((n, d) => n + d.value, 0);
  const fewPoints = data.length <= 12;

  async function onDownload() {
    setDownloading(true);
    try {
      await downloadExcel(chart);
    } catch {
      toast.error("No se pudo descargar la planilla. Probá de nuevo.");
    } finally {
      setDownloading(false);
    }
  }

  let body: React.ReactNode;
  if (chart.type === "line" || chart.type === "area") {
    const Chart = chart.type === "line" ? LineChart : AreaChart;
    body = (
      <ResponsiveContainer width="100%" height={240}>
        <Chart data={data} margin={{ top: 22, right: 12, left: 0, bottom: 0 }}>
          <XAxis dataKey="name" {...axis} />
          <YAxis {...axis} allowDecimals={false} tickFormatter={fmt} width={chart.format === "pesos" ? 80 : 40} />
          <Tooltip {...tooltip} />
          {chart.type === "line" ? (
            <Line type="monotone" dataKey="value" name={valueName} stroke={colors[0]} strokeWidth={3} dot={{ r: 4, fill: colors[0] }}>
              {fewPoints && <LabelList dataKey="value" position="top" {...label} />}
            </Line>
          ) : (
            <Area type="monotone" dataKey="value" name={valueName} stroke={colors[0]} fill={colors[0]} fillOpacity={0.2} strokeWidth={2}>
              {fewPoints && <LabelList dataKey="value" position="top" {...label} />}
            </Area>
          )}
        </Chart>
      </ResponsiveContainer>
    );
  } else if (chart.type === "bar" && horizontalBars(data)) {
    // Acostadas: el nombre entero arriba de cada barra y el número al final, así se lee aunque sea largo.
    const max = Math.max(...data.map((d) => d.value), 1);
    body = (
      <ul className="space-y-2.5">
        {data.map((d, i) => (
          <li key={i} className="text-sm">
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-foreground/85">{d.name}</span>
              <span className="shrink-0 font-semibold tabular-nums text-foreground">{fmt(d.value)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full" style={{ width: `${Math.max(1.5, (d.value / max) * 100)}%`, backgroundColor: colors[i] }} />
            </div>
          </li>
        ))}
      </ul>
    );
  } else if (chart.type === "bar") {
    body = (
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 22, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="name" {...axis} interval={0} />
          <YAxis hide />
          <Tooltip {...tooltip} />
          <Bar dataKey="value" name={valueName} radius={[6, 6, 0, 0]} maxBarSize={64}>
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i]} />
            ))}
            <LabelList dataKey="value" position="top" {...label} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  } else {
    body = (
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="h-[200px] w-full sm:w-1/2">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={2} dataKey="value" nameKey="name" stroke={isDark ? "#0f172a" : "#ffffff"} strokeWidth={2}>
                {data.map((_, i) => (
                  <Cell key={i} fill={colors[i]} />
                ))}
              </Pie>
              <Tooltip {...tooltip} formatter={(v: unknown, n: unknown) => [fmt(v), String(n)] as [string, string]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="grid w-full gap-2 text-sm sm:w-1/2">
          {data.map((d, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[i] }} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{d.name}</span>
              <span className="font-semibold tabular-nums">{fmt(d.value)}</span>
              <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">{share(d.value, total)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <figure className="mt-3 w-full rounded-xl border border-border/70 bg-card p-4">
      <figcaption className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <Button size="sm" variant="ghost" onClick={onDownload} disabled={downloading} className="h-8 shrink-0 gap-1.5 text-xs">
          {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />}
          Descargar Excel
        </Button>
      </figcaption>
      {body}
    </figure>
  );
}
