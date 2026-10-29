"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPesos, formatPesosCorto } from "@/lib/formato";

// Colores probados para que se distingan también con daltonismo, en modo claro y oscuro.
const GASTADO = "#0284c7";
const PROYECCION = "#ea580c";
const TOPE = "#e11d48";

const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * Gasto acumulado de cada día del período contra el tope, y la proyección hasta el cierre
 * (si sigue como el último día cargado). Con la misma tabla en texto para lectores de pantalla.
 */
export function GastoChart({
  desde,
  hasta,
  porDia,
  tope,
  proyeccion,
}: {
  desde: string;
  hasta: string;
  porDia: { fecha: string; acumulado: number }[];
  tope: number | null;
  proyeccion: number | null;
}) {
  const ultimo = porDia[porDia.length - 1];
  const rows: { fecha: string; label: string; gastado?: number; proyeccion?: number }[] = [];
  let acumulado = 0;
  for (let dia = desde, i = 0; dia <= hasta && i < 40; dia = addDays(dia, 1), i++) {
    const d = porDia.find((x) => x.fecha === dia);
    if (d) acumulado = d.acumulado;
    const row: (typeof rows)[number] = { fecha: dia, label: dm(dia) };
    if (ultimo && dia <= ultimo.fecha) row.gastado = acumulado;
    rows.push(row);
  }
  // La proyección: una recta desde el último día cargado hasta el cierre.
  if (ultimo && proyeccion !== null && ultimo.fecha < hasta) {
    const start = rows.findIndex((r) => r.fecha === ultimo.fecha);
    const steps = rows.length - 1 - start;
    for (let k = 0; k <= steps; k++) {
      rows[start + k].proyeccion = Math.round(ultimo.acumulado + ((proyeccion - ultimo.acumulado) * k) / steps);
    }
  }

  // Que el tope entre siempre en el gráfico, aunque todavía se haya gastado poco.
  const max = Math.max(tope ?? 0, proyeccion ?? 0, ultimo?.acumulado ?? 0);

  return (
    <>
      <div className="h-64 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.1} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.5} interval="preserveStartEnd" minTickGap={24} />
            <YAxis domain={[0, Math.ceil(max * 1.08) || 1]} tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.5} tickFormatter={(v) => formatPesosCorto(Number(v))} width={78} />
            <Tooltip
              formatter={(v, name) => [formatPesos(Number(v)), name === "gastado" ? "Gastado" : "Proyección"]}
              contentStyle={{ borderRadius: 12, fontSize: 12, background: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
            />
            {tope !== null && (
              <ReferenceLine y={tope} stroke={TOPE} strokeDasharray="6 4" label={{ value: "Tope", position: "insideTopLeft", fontSize: 11, fill: TOPE }} />
            )}
            <Line type="monotone" dataKey="gastado" stroke={GASTADO} strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
            <Line type="linear" dataKey="proyeccion" stroke={PROYECCION} strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 rounded" style={{ background: GASTADO }} /> Gastado</span>
        {proyeccion !== null && ultimo && ultimo.fecha < hasta && (
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 border-t-2 border-dashed" style={{ borderColor: PROYECCION }} /> Proyección</span>
        )}
        {tope !== null && (
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 border-t-2 border-dashed" style={{ borderColor: TOPE }} /> Tope</span>
        )}
      </div>
      <table className="sr-only">
        <caption>Gasto acumulado por día</caption>
        <thead>
          <tr><th>Día</th><th>Gastado</th></tr>
        </thead>
        <tbody>
          {porDia.map((d) => (
            <tr key={d.fecha}><td>{dm(d.fecha)}</td><td>{formatPesos(d.acumulado)}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
