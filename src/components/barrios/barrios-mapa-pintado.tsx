"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapContainer, Polygon, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TRES_DE_FEBRERO_CENTER } from "@/lib/constants/localities";
import { formatNumber, plural } from "@/lib/formato";
import type { Limite } from "@/lib/barrio-limites";
import { CASE_LABELS, caseLabelName } from "@/lib/case-labels";
import { labelTotals, topLabels } from "@/lib/barrio-comparison";

// Los 29 barrios pintados según cuánta gente o cuántos expedientes abiertos tienen, o según una etiqueta
// de sus expedientes abiertos: el mapa de necesidades (idea 43).
// Un solo color (azul institucional), de claro a oscuro; en cero, gris. Tocar un barrio abre su página.

export type BarrioPintado = {
  barrio: string;
  slug: string;
  people: number;
  openCases: number;
  /** Expedientes abiertos por etiqueta (sin Violencia de Género para quien no puede verlos). */
  labels: Record<string, number>;
  limite: Limite | null;
};

type Medida = "people" | "openCases" | "etiqueta";

const MEDIDAS: { id: Medida; label: string; corto: string; unidad: [string, string] }[] = [
  { id: "people", label: "Personas del padrón", corto: "Personas", unidad: ["persona", "personas"] },
  { id: "openCases", label: "Expedientes abiertos", corto: "Expedientes", unidad: ["expediente abierto", "expedientes abiertos"] },
  { id: "etiqueta", label: "Necesidades", corto: "Necesidades", unidad: ["expediente abierto", "expedientes abiertos"] },
];

/** De claro a oscuro. */
const ESCALA = ["#D6E4F3", "#9DBCE0", "#5E8FC6", "#2E5F9A", "#163C68"];
const CERO = "#E5E7EB";

/**
 * Dónde empieza cada tramo, con una cantidad parecida de barrios en cada uno (los que están en cero van aparte).
 * El primer tramo empieza en 1; los demás, en el valor de corte.
 */
function tramos(valores: number[]): number[] {
  const v = valores.filter((n) => n > 0).sort((a, b) => a - b);
  if (v.length === 0) return [];
  const cortes: number[] = [];
  for (let i = 1; i < ESCALA.length; i++) {
    const c = v[Math.floor((i * v.length) / ESCALA.length)];
    if (c > v[0] && c > (cortes[cortes.length - 1] ?? 0)) cortes.push(c);
  }
  return cortes;
}

/** Si hay menos tramos que colores, se usan los más oscuros (así un solo tramo no queda casi blanco). */
const colorDelTramo = (i: number, cortes: number[]) => ESCALA[ESCALA.length - 1 - cortes.length + i];

function colorDe(n: number, cortes: number[]): string {
  if (n <= 0) return CERO;
  return colorDelTramo(cortes.filter((c) => n >= c).length, cortes);
}

/** Encuadra el mapa para que entren todos los barrios con límite. */
function Encuadrar({ limites }: { limites: Limite[] }) {
  const map = useMap();
  useEffect(() => {
    const puntos = limites.flat();
    if (puntos.length) map.fitBounds(L.latLngBounds(puntos), { padding: [12, 12] });
  }, [map, limites]);
  return null;
}

export function BarriosMapaPintado({ barrios }: { barrios: BarrioPintado[] }) {
  const router = useRouter();
  const [medida, setMedida] = useState<Medida>("people");
  const totals = useMemo(() => labelTotals(barrios.map((b) => b.labels)), [barrios]);
  // Arranca con la etiqueta que más aparece, así el mapa no queda vacío.
  const [etiqueta, setEtiqueta] = useState<string>(() => topLabels(totals, 1)[0]?.key ?? CASE_LABELS[0].key);
  const [activo, setActivo] = useState<string | null>(null);
  const info = MEDIDAS.find((m) => m.id === medida)!;
  const valor = (b: BarrioPintado) => (medida === "etiqueta" ? b.labels[etiqueta] ?? 0 : b[medida]);
  const etiquetaNombre = (caseLabelName(etiqueta) ?? etiqueta).toLowerCase();

  const cortes = useMemo(
    () => tramos(barrios.map((b) => (medida === "etiqueta" ? b.labels[etiqueta] ?? 0 : b[medida]))),
    [barrios, medida, etiqueta]
  );
  const conLimite = useMemo(() => barrios.filter((b) => b.limite), [barrios]);
  const limites = useMemo(() => conLimite.map((b) => b.limite!), [conLimite]);
  const sinLimite = barrios.filter((b) => !b.limite);
  const leyenda = [
    { color: CERO, texto: "Ninguno" },
    ...[1, ...cortes].map((desde, i) => {
      const hasta = cortes[i] !== undefined ? cortes[i] - 1 : null;
      return {
        color: colorDelTramo(i, cortes),
        texto: hasta === null ? `${formatNumber(desde)} o más` : desde === hasta ? formatNumber(desde) : `${formatNumber(desde)} a ${formatNumber(hasta)}`,
      };
    }),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Pintar los barrios según" className="inline-grid grid-cols-3 gap-1 rounded-xl border border-border/60 bg-muted/30 p-1">
          {MEDIDAS.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={medida === m.id}
              onClick={() => setMedida(m.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                medida === m.id ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="sm:hidden">{m.corto}</span>
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          ))}
        </div>
        {medida === "etiqueta" && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Etiqueta</span>
            <select
              value={etiqueta}
              onChange={(e) => setEtiqueta(e.target.value)}
              className="h-9 rounded-xl border border-border/60 bg-card px-2 text-sm font-semibold"
            >
              {CASE_LABELS.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label} ({formatNumber(totals[l.key] ?? 0)})
                </option>
              ))}
            </select>
          </label>
        )}
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label={`Referencias: ${info.label.toLowerCase()}`}>
          {leyenda.map((l) => (
            <li key={l.texto} className="flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-[3px] border border-black/10" style={{ background: l.color }} aria-hidden />
              <span className="tabular-nums">{l.texto}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60">
        <MapContainer
          center={TRES_DE_FEBRERO_CENTER}
          zoom={13}
          zoomControl={false}
          zoomSnap={0.25}
          zoomDelta={0.5}
          scrollWheelZoom={false}
          style={{ height: 560, width: "100%" }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            className="grayscale opacity-60"
          />
          <ZoomControl position="bottomleft" />
          <Encuadrar limites={limites} />
          {conLimite.map((b) => {
            const n = valor(b);
            const encima = activo === b.barrio;
            return (
              <Polygon
                key={`${b.barrio}-${medida}-${etiqueta}`}
                positions={b.limite!}
                pathOptions={{
                  color: encima ? "#F28C28" : "#ffffff",
                  weight: encima ? 3 : 1.5,
                  fillColor: colorDe(n, cortes),
                  fillOpacity: 0.85,
                }}
                eventHandlers={{
                  click: () => router.push(`/barrios/${b.slug}`),
                  mouseover: () => setActivo(b.barrio),
                  mouseout: () => setActivo((a) => (a === b.barrio ? null : a)),
                }}
              >
                <Tooltip sticky direction="top" offset={[0, -6]}>
                  <span className="block text-sm font-semibold">{b.barrio}</span>
                  <span className="block text-xs tabular-nums">
                    {plural(n, info.unidad[0], info.unidad[1])}
                    {medida === "etiqueta" && ` de ${etiquetaNombre}`}
                  </span>
                  {medida === "etiqueta" && topLabels(b.labels, 3).length > 0 && (
                    <span className="block text-[11px] text-slate-600">
                      Lo que más aparece: {topLabels(b.labels, 3).map((t) => `${caseLabelName(t.key) ?? t.key} (${formatNumber(t.total)})`).join(", ")}
                    </span>
                  )}
                  <span className="block text-[11px] text-slate-500">Tocá para ver el barrio</span>
                </Tooltip>
              </Polygon>
            );
          })}
        </MapContainer>
      </div>

      {sinLimite.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Todavía sin límite en el mapa:{" "}
          {sinLimite.map((b, i) => (
            <span key={b.barrio}>
              {i > 0 && (i === sinLimite.length - 1 ? " y " : ", ")}
              <Link href={`/barrios/${b.slug}`} className="font-semibold text-primary hover:underline">{b.barrio}</Link>{" "}
              <span className="tabular-nums">({valor(b) ? formatNumber(valor(b)) : "—"})</span>
            </span>
          ))}
          . La conducción puede dibujarlo desde la página de cada barrio.
        </p>
      )}
    </div>
  );
}
