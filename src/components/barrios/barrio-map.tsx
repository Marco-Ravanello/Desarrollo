"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TRES_DE_FEBRERO_CENTER, TRES_DE_FEBRERO_DEFAULT_ZOOM } from "@/lib/constants/localities";
import { APPROX_COLOR, CASE_COLOR, EXACT_COLOR } from "@/lib/map-colors";
import { lugarTipoLabel } from "@/lib/barrios";
import { getAreaShortName } from "@/lib/area-theme";
import { splitCaseTitle } from "@/lib/case-summary";
import { formatNumber } from "@/lib/formato";
import type { BarrioMapData } from "@/services/barrios";
import { getMapPeopleAction } from "@/app/(dashboard)/maps/actions";

// Mapa de un barrio: su gente (puntos chicos), los expedientes abiertos (cuadrados), los lugares de referencia
// (pines violeta) y, en una recorrida, las casas a visitar numeradas en el orden de la lista.
// Los puntos se dibujan en canvas para que un barrio de miles de personas no trabe el navegador.

export const LUGAR_COLOR = "#7c3aed";
const STOP_COLORS: Record<string, string> = {
  PENDIENTE: "#163C68",
  VISITADA: "#15803d",
  NO_ESTABA: "#d97706",
  NO_QUISO: "#d97706",
  SE_MUDO: "#be123c",
  OTRO: "#475569",
};

export type MapStop = {
  n: number;
  lat: number;
  lng: number;
  nombre: string | null;
  direccion: string | null;
  resultado: string;
  resultadoLabel: string;
  dni: string;
};

type Layers = { people: boolean; cases: boolean; lugares: boolean; stops: boolean };

const esc = (s: string | null | undefined) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const caseIcon = L.divIcon({
  className: "",
  html: `<span style="display:block;width:14px;height:14px;border-radius:4px;background:${CASE_COLOR};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)"></span>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const lugarIcon = L.divIcon({
  className: "",
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 34" width="24" height="34"><path fill="${LUGAR_COLOR}" stroke="#fff" stroke-width="1.6" d="M12 1C6 1 1 6 1 12c0 8.4 11 21 11 21s11-12.6 11-21C23 6 18 1 12 1z"/><circle cx="12" cy="12" r="4.2" fill="#fff"/></svg>`,
  iconSize: [24, 34],
  iconAnchor: [12, 33],
  popupAnchor: [0, -28],
});

const stopIcon = (n: number, resultado: string) =>
  L.divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:999px;background:${STOP_COLORS[resultado] ?? STOP_COLORS.PENDIENTE};color:#fff;font:700 12px/1 system-ui,sans-serif;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${n}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -12],
  });

function personPopupHtml(p: { dni: string; nombre: string; direccion: string | null; telefono: string | null; programas: string[] } | null, dni: string) {
  if (!p) return `<p style="margin:0">No se pudieron cargar los datos de esta persona.</p>`;
  return `<div style="min-width:180px">
    <a href="/people/${encodeURIComponent(dni)}" style="font-weight:700">${esc(p.nombre)}</a>
    <div style="font-size:12px;color:#64748b">DNI ${esc(dni)}</div>
    ${p.direccion ? `<div style="font-size:12px;margin-top:4px">${esc(p.direccion)}</div>` : ""}
    ${p.telefono ? `<div style="font-size:12px">Tel. ${esc(p.telefono)}</div>` : ""}
    ${p.programas.length ? `<div style="font-size:12px;margin-top:4px">${p.programas.map(esc).join(", ")}</div>` : ""}
  </div>`;
}

/** Dibuja las capas y encuadra el mapa en lo que hay. */
function Drawing({ data, stops, layers, canOpenPeople }: { data: BarrioMapData; stops: MapStop[]; layers: Layers; canOpenPeople: boolean }) {
  const map = useMap();

  useEffect(() => {
    const group = L.layerGroup().addTo(map);
    const renderer = L.canvas({ padding: 0.3 });
    const bounds = L.latLngBounds([]);

    if (layers.people) {
      for (let i = 0; i < data.dnis.length; i++) {
        const lat = data.points[i * 3];
        const lng = data.points[i * 3 + 1];
        const approx = data.points[i * 3 + 2] === 1;
        const marker = L.circleMarker([lat, lng], {
          renderer,
          radius: 4,
          weight: 1,
          color: "#ffffff",
          fillColor: approx ? APPROX_COLOR : EXACT_COLOR,
          fillOpacity: 0.85,
        });
        if (canOpenPeople) {
          const dni = data.dnis[i];
          marker.bindPopup(`<p style="margin:0">Cargando…</p>`);
          marker.on("popupopen", async (e) => {
            const res = await getMapPeopleAction([dni]);
            e.popup.setContent(personPopupHtml(res.success ? res.people[0] ?? null : null, dni));
          });
        }
        marker.addTo(group);
        if (!stops.length) bounds.extend([lat, lng]);
      }
    }

    if (layers.cases) {
      for (const c of data.cases) {
        const t = splitCaseTitle(c.title);
        L.marker([c.lat, c.lng], { icon: caseIcon })
          .bindPopup(
            `<div style="min-width:180px"><a href="/cases/${encodeURIComponent(c.id)}" style="font-weight:700">${esc(t.title)}</a>
             <div style="font-size:12px;color:#64748b">${esc(c.titular ?? "Sin titular")} · ${esc(getAreaShortName(c.area))}</div>
             ${c.priority === "URGENTE" ? `<div style="font-size:12px;color:#be123c;font-weight:700">Urgente</div>` : c.priority === "ALTA" ? `<div style="font-size:12px;color:#c2410c;font-weight:700">Prioridad alta</div>` : ""}</div>`
          )
          .addTo(group);
        if (!stops.length) bounds.extend([c.lat, c.lng]);
      }
    }

    if (layers.lugares) {
      for (const l of data.lugares) {
        L.marker([l.lat, l.lng], { icon: lugarIcon, zIndexOffset: 500 })
          .bindPopup(
            `<div style="min-width:160px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;color:${LUGAR_COLOR}">${esc(lugarTipoLabel(l.tipo))}</div>
             <div style="font-weight:700">${esc(l.nombre)}</div>${l.direccion ? `<div style="font-size:12px">${esc(l.direccion)}</div>` : ""}</div>`
          )
          .addTo(group);
        bounds.extend([l.lat, l.lng]);
      }
    }

    if (layers.stops) {
      for (const s of stops) {
        L.marker([s.lat, s.lng], { icon: stopIcon(s.n, s.resultado), zIndexOffset: 1000 })
          .bindPopup(
            `<div style="min-width:180px"><div style="font-size:12px;color:#64748b">Parada ${s.n} · ${esc(s.resultadoLabel)}</div>
             <a href="/people/${encodeURIComponent(s.dni)}" style="font-weight:700">${esc(s.nombre ?? "Sin nombre")}</a>
             ${s.direccion ? `<div style="font-size:12px">${esc(s.direccion)}</div>` : ""}</div>`
          )
          .addTo(group);
        bounds.extend([s.lat, s.lng]);
      }
    }

    if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 17 });
    return () => {
      group.remove();
    };
  }, [map, data, stops, layers, canOpenPeople]);

  return null;
}

function Toggle({ on, onChange, color, shape, label }: { on: boolean; onChange: (v: boolean) => void; color: string; shape: "dot" | "square" | "pin" | "num"; label: string }) {
  const mark =
    shape === "square" ? "h-3 w-3 rounded-[3px]" : shape === "num" ? "h-3.5 w-3.5 rounded-full" : shape === "pin" ? "h-3.5 w-3 rounded-t-full rounded-b-sm" : "h-2.5 w-2.5 rounded-full";
  return (
    <label className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${on ? "border-border bg-card text-foreground" : "border-dashed border-border/60 text-muted-foreground"}`}>
      <input type="checkbox" className="sr-only" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span className={`${mark} shrink-0 ${on ? "" : "opacity-40"}`} style={{ background: color }} aria-hidden />
      {label}
    </label>
  );
}

const NO_STOPS: MapStop[] = [];

export function BarrioMap({
  data,
  stops = NO_STOPS,
  canOpenPeople,
  height = 560,
  peopleOnByDefault = true,
}: {
  data: BarrioMapData;
  stops?: MapStop[];
  canOpenPeople: boolean;
  height?: number;
  peopleOnByDefault?: boolean;
}) {
  const [layers, setLayers] = useState<Layers>({ people: peopleOnByDefault, cases: true, lugares: true, stops: true });
  const set = (k: keyof Layers) => (v: boolean) => setLayers((l) => ({ ...l, [k]: v }));
  const approx = useMemo(() => data.points.filter((_, i) => i % 3 === 2 && data.points[i] === 1).length, [data.points]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Qué mostrar en el mapa">
        {stops.length > 0 && <Toggle on={layers.stops} onChange={set("stops")} color={STOP_COLORS.PENDIENTE} shape="num" label={`Casas a visitar (${formatNumber(stops.length)})`} />}
        <Toggle on={layers.people} onChange={set("people")} color={EXACT_COLOR} shape="dot" label={`Personas del padrón (${formatNumber(data.dnis.length)})`} />
        <Toggle on={layers.cases} onChange={set("cases")} color={CASE_COLOR} shape="square" label={`Expedientes abiertos (${formatNumber(data.cases.length)})`} />
        <Toggle on={layers.lugares} onChange={set("lugares")} color={LUGAR_COLOR} shape="pin" label={`Lugares de referencia (${formatNumber(data.lugares.length)})`} />
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/60" style={{ height }}>
        <MapContainer
          center={TRES_DE_FEBRERO_CENTER}
          zoom={TRES_DE_FEBRERO_DEFAULT_ZOOM}
          maxZoom={18}
          zoomControl={false}
          preferCanvas
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={18}
          />
          <ZoomControl position="bottomleft" />
          <Drawing data={data} stops={stops} layers={layers} canOpenPeople={canOpenPeople} />
        </MapContainer>
      </div>
      {layers.people && approx > 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: APPROX_COLOR }} aria-hidden />
          {formatNumber(approx)} de las personas tienen un punto aproximado (solo el barrio, sin la altura de la calle).
        </p>
      )}
    </div>
  );
}

export default BarrioMap;
