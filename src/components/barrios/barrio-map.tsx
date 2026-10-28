"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PenLine, RotateCcw, Save, Undo2, X } from "lucide-react";
import { MapContainer, TileLayer, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TRES_DE_FEBRERO_CENTER, TRES_DE_FEBRERO_DEFAULT_ZOOM } from "@/lib/constants/localities";
import { APPROX_COLOR, CASE_COLOR, EXACT_COLOR } from "@/lib/map-colors";
import { lugarTipoLabel } from "@/lib/barrios";
import { getAreaShortName } from "@/lib/area-theme";
import { splitCaseTitle } from "@/lib/case-summary";
import { formatNumber } from "@/lib/formato";
import type { BarrioMapData } from "@/services/barrios";
import type { Limite } from "@/lib/barrio-limites";
import { Button } from "@/components/ui/button";
import { getMapPeopleAction } from "@/app/(dashboard)/maps/actions";
import { deleteLimiteAction, saveLimiteAction } from "@/app/(dashboard)/barrios/actions";

// Mapa de un barrio: su gente (puntos chicos), los expedientes abiertos (cuadrados), los lugares de referencia
// (pines violeta) y, en una recorrida, las casas a visitar numeradas en el orden de la lista. Si el barrio tiene
// límite, se dibuja, y los puntos que caen afuera van en gris en una capa aparte (apagada de entrada).
// Los puntos se dibujan en canvas para que un barrio de miles de personas no trabe el navegador.

export const LUGAR_COLOR = "#7c3aed";
export const FUERA_COLOR = "#94a3b8";
const LIMITE_COLOR = "#163C68";
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

type Layers = { people: boolean; fuera: boolean; cases: boolean; lugares: boolean; stops: boolean };

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
function Drawing({
  data,
  stops,
  layers,
  canOpenPeople,
  editing,
}: {
  data: BarrioMapData;
  stops: MapStop[];
  layers: Layers;
  canOpenPeople: boolean;
  editing: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    const group = L.layerGroup().addTo(map);
    const renderer = L.canvas({ padding: 0.3 });
    const bounds = L.latLngBounds([]);

    if (data.limite && !editing) {
      L.polygon(data.limite, { color: LIMITE_COLOR, weight: 2.5, dashArray: "6 5", fillColor: LIMITE_COLOR, fillOpacity: 0.04, interactive: false }).addTo(group);
      if (!stops.length) for (const p of data.limite) bounds.extend(p);
    }

    for (let i = 0; i < data.dnis.length; i++) {
      const flags = data.points[i * 3 + 2];
      const fuera = (flags & 2) === 2;
      if (fuera ? !layers.fuera : !layers.people) continue;
      const lat = data.points[i * 3];
      const lng = data.points[i * 3 + 1];
      const approx = (flags & 1) === 1;
      const marker = L.circleMarker([lat, lng], {
        renderer,
        radius: 4,
        weight: 1,
        color: "#ffffff",
        fillColor: fuera ? FUERA_COLOR : approx ? APPROX_COLOR : EXACT_COLOR,
        fillOpacity: 0.85,
        interactive: !editing,
      });
      if (canOpenPeople && !editing) {
        const dni = data.dnis[i];
        marker.bindPopup(`<p style="margin:0">Cargando…</p>`);
        marker.on("popupopen", async (e) => {
          const res = await getMapPeopleAction([dni]);
          e.popup.setContent(personPopupHtml(res.success ? res.people[0] ?? null : null, dni));
        });
      }
      marker.addTo(group);
      if (!stops.length && !data.limite && !fuera) bounds.extend([lat, lng]);
    }

    if (layers.cases) {
      for (const c of data.cases) {
        if (c.fuera && !layers.fuera) continue;
        const t = splitCaseTitle(c.title);
        L.marker([c.lat, c.lng], { icon: caseIcon })
          .bindPopup(
            `<div style="min-width:180px"><a href="/cases/${encodeURIComponent(c.id)}" style="font-weight:700">${esc(t.title)}</a>
             <div style="font-size:12px;color:#64748b">${esc(c.titular ?? "Sin titular")} · ${esc(getAreaShortName(c.area))}</div>
             ${c.priority === "URGENTE" ? `<div style="font-size:12px;color:#be123c;font-weight:700">Urgente</div>` : c.priority === "ALTA" ? `<div style="font-size:12px;color:#c2410c;font-weight:700">Prioridad alta</div>` : ""}</div>`
          )
          .addTo(group);
        if (!stops.length && !data.limite && !c.fuera) bounds.extend([c.lat, c.lng]);
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
        if (!data.limite) bounds.extend([l.lat, l.lng]);
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

    if (bounds.isValid() && !editing) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 17 });
    return () => {
      group.remove();
    };
  }, [map, data, stops, layers, canOpenPeople, editing]);

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

/** Mientras se dibuja: cada toque en el mapa suma un punto; los puntos se pueden arrastrar. */
function LimiteEditor({ puntos, onChange }: { puntos: Limite; onChange: (p: Limite) => void }) {
  const map = useMap();
  useMapEvents({
    click(e) {
      onChange([...puntos, [Math.round(e.latlng.lat * 1e5) / 1e5, Math.round(e.latlng.lng * 1e5) / 1e5]]);
    },
  });

  useEffect(() => {
    const group = L.layerGroup().addTo(map);
    if (puntos.length >= 2) {
      const shape = puntos.length >= 3 ? L.polygon(puntos, { color: LIMITE_COLOR, weight: 2.5, fillOpacity: 0.08, interactive: false }) : L.polyline(puntos, { color: LIMITE_COLOR, weight: 2.5, interactive: false });
      shape.addTo(group);
    }
    puntos.forEach((p, i) => {
      const last = i === puntos.length - 1;
      const icon = L.divIcon({
        className: "",
        html: `<span style="display:block;width:${last ? 16 : 12}px;height:${last ? 16 : 12}px;border-radius:999px;background:${last ? "#F69321" : "#fff"};border:2.5px solid ${LIMITE_COLOR};box-shadow:0 1px 3px rgba(0,0,0,.35)"></span>`,
        iconSize: last ? [16, 16] : [12, 12],
        iconAnchor: last ? [8, 8] : [6, 6],
      });
      const m = L.marker(p, { icon, draggable: true, zIndexOffset: 2000, title: `Punto ${i + 1}` });
      m.on("dragend", () => {
        const ll = m.getLatLng();
        onChange(puntos.map((q, j) => (j === i ? [Math.round(ll.lat * 1e5) / 1e5, Math.round(ll.lng * 1e5) / 1e5] : q)));
      });
      m.addTo(group);
    });
    return () => {
      group.remove();
    };
  }, [map, puntos, onChange]);

  return null;
}

const NO_STOPS: MapStop[] = [];

export function BarrioMap({
  data,
  stops = NO_STOPS,
  canOpenPeople,
  height = 560,
  peopleOnByDefault = true,
  barrio,
  canEditLimite = false,
  fueraHref,
}: {
  data: BarrioMapData;
  stops?: MapStop[];
  canOpenPeople: boolean;
  height?: number;
  peopleOnByDefault?: boolean;
  /** Para dibujar el límite (solo en la pestaña Mapa del barrio). */
  barrio?: string;
  canEditLimite?: boolean;
  /** Adónde lleva "Revisarlas" (la lista de puntos fuera del límite). */
  fueraHref?: string;
}) {
  const router = useRouter();
  const [layers, setLayers] = useState<Layers>({ people: peopleOnByDefault, fuera: false, cases: true, lugares: true, stops: true });
  const set = (k: keyof Layers) => (v: boolean) => setLayers((l) => ({ ...l, [k]: v }));
  const approx = useMemo(() => data.points.filter((v, i) => i % 3 === 2 && (v & 1) === 1 && (v & 2) === 0).length, [data.points]);
  const [editing, setEditing] = useState(false);
  const [puntos, setPuntos] = useState<Limite>([]);
  const [saving, setSaving] = useState(false);
  const enLimite = data.dnis.length - data.fuera;
  const casosFuera = data.cases.filter((c) => c.fuera).length;

  const startEditing = () => {
    setPuntos(data.limite ?? []);
    setEditing(true);
  };
  const save = async () => {
    if (!barrio) return;
    setSaving(true);
    const res = await saveLimiteAction(barrio, puntos).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error(res && !res.success ? res.error : "No se pudo guardar. Probá de nuevo.");
    toast.success("Límite guardado. Los puntos de afuera ya se cuentan con el nuevo límite.");
    setEditing(false);
    router.refresh();
  };
  const backToOsm = async () => {
    if (!barrio) return;
    if (!window.confirm("¿Borrar el límite dibujado? Vuelve el de OpenStreetMap, si hay uno.")) return;
    setSaving(true);
    const res = await deleteLimiteAction(barrio).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error(res && !res.success ? res.error : "No se pudo borrar. Probá de nuevo.");
    toast.success("Listo, se borró el límite dibujado.");
    setEditing(false);
    router.refresh();
  };

  return (
    <div className="space-y-3">
      {!editing && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Qué mostrar en el mapa">
            {stops.length > 0 && <Toggle on={layers.stops} onChange={set("stops")} color={STOP_COLORS.PENDIENTE} shape="num" label={`Casas a visitar (${formatNumber(stops.length)})`} />}
            <Toggle
              on={layers.people}
              onChange={set("people")}
              color={EXACT_COLOR}
              shape="dot"
              label={data.limite ? `Personas dentro del límite (${formatNumber(enLimite)})` : `Personas del padrón (${formatNumber(data.dnis.length)})`}
            />
            {data.fuera + casosFuera > 0 && (
              <Toggle on={layers.fuera} onChange={set("fuera")} color={FUERA_COLOR} shape="dot" label={`Fuera del límite (${formatNumber(data.fuera)})`} />
            )}
            <Toggle on={layers.cases} onChange={set("cases")} color={CASE_COLOR} shape="square" label={`Expedientes abiertos (${formatNumber(data.cases.length - (layers.fuera ? 0 : casosFuera))})`} />
            <Toggle on={layers.lugares} onChange={set("lugares")} color={LUGAR_COLOR} shape="pin" label={`Lugares de referencia (${formatNumber(data.lugares.length)})`} />
          </div>
          {canEditLimite && barrio && (
            <Button variant="outline" size="sm" onClick={startEditing} className="h-9 rounded-xl text-xs font-bold gap-1.5">
              <PenLine className="h-4 w-4" /> {data.limite ? "Corregir el límite" : "Dibujar el límite"}
            </Button>
          )}
        </div>
      )}
      {editing && (
        <div className="space-y-2 rounded-2xl border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm text-foreground">
            <strong>Tocá el mapa para marcar el borde del barrio</strong>, punto por punto y siguiendo el contorno. El límite se cierra solo
            entre el último punto (naranja) y el primero. Para corregir, arrastrá un punto.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={save} disabled={saving || puntos.length < 3} className="h-9 rounded-xl text-xs font-bold gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar el límite
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPuntos((p) => p.slice(0, -1))} disabled={saving || !puntos.length} className="h-9 rounded-xl text-xs font-bold gap-1.5">
              <Undo2 className="h-4 w-4" /> Sacar el último punto
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPuntos([])} disabled={saving || !puntos.length} className="h-9 rounded-xl text-xs font-bold gap-1.5">
              <RotateCcw className="h-4 w-4" /> Empezar de nuevo
            </Button>
            {data.limiteOrigen === "DIBUJADO" && (
              <Button size="sm" variant="ghost" onClick={backToOsm} disabled={saving} className="h-9 rounded-xl text-xs font-bold text-destructive hover:text-destructive">
                Borrar el límite dibujado
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving} className="h-9 rounded-xl text-xs font-bold gap-1.5">
              <X className="h-4 w-4" /> Cancelar
            </Button>
            <span className="text-xs text-muted-foreground">{puntos.length} {puntos.length === 1 ? "punto" : "puntos"}</span>
          </div>
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-border/60" style={{ height }}>
        <MapContainer
          center={TRES_DE_FEBRERO_CENTER}
          zoom={TRES_DE_FEBRERO_DEFAULT_ZOOM}
          maxZoom={18}
          zoomControl={false}
          preferCanvas
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
          className={editing ? "z-0 cursor-crosshair" : "z-0"}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={18}
          />
          <ZoomControl position="bottomleft" />
          <Drawing data={data} stops={stops} layers={layers} canOpenPeople={canOpenPeople} editing={editing} />
          {editing && <LimiteEditor puntos={puntos} onChange={setPuntos} />}
        </MapContainer>
      </div>
      {!editing && (
        <div className="space-y-1 text-xs text-muted-foreground">
          {data.limite && (
            <p className="flex items-center gap-2">
              <span className="h-0 w-4 shrink-0 border-t-2 border-dashed" style={{ borderColor: LIMITE_COLOR }} aria-hidden />
              {data.limiteOrigen === "DIBUJADO" ? "Límite dibujado en la app." : "Límite de OpenStreetMap."}
              {data.fuera > 0 && (
                <>
                  {" "}
                  {formatNumber(data.fuera)} {data.fuera === 1 ? "persona tiene" : "personas tienen"} el punto fuera del límite (en gris, apagadas de entrada).
                  {fueraHref && (
                    <a href={fueraHref} className="font-semibold text-primary hover:underline">Revisarlas</a>
                  )}
                </>
              )}
            </p>
          )}
          {!data.limite && barrio && (
            <p>Este barrio todavía no tiene límite en el mapa{canEditLimite ? ": dibujalo con “Dibujar el límite”." : "."}</p>
          )}
          {layers.people && approx > 0 && (
            <p className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: APPROX_COLOR }} aria-hidden />
              {formatNumber(approx)} de las personas tienen un punto aproximado (solo el barrio, sin la altura de la calle).
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default BarrioMap;
