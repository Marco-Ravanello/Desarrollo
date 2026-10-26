"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
// Colores probados para que se distingan también con daltonismo, en modo claro y oscuro.
const ALTAS = "#0284c7";
const BAJAS = "#ea580c";

const monthLabel = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(2, 4)}`;

/** Altas y bajas de cada mes del último año, con la misma tabla en texto para lectores de pantalla. */
export function ProgramMonthsChart({ data }: { data: { month: string; altas: number; bajas: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: monthLabel(d.month) }));
  return (
    <>
      <div className="h-64 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.1} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.5} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.5} />
            <Tooltip
              cursor={{ fill: "currentColor", fillOpacity: 0.06 }}
              contentStyle={{ borderRadius: 12, fontSize: 12, background: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="altas" name="Altas" fill={ALTAS} radius={[4, 4, 0, 0]} maxBarSize={18} />
            <Bar dataKey="bajas" name="Bajas" fill={BAJAS} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Altas y bajas por mes</caption>
        <thead>
          <tr><th>Mes</th><th>Altas</th><th>Bajas</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month}><td>{r.label}</td><td>{r.altas}</td><td>{r.bajas}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
