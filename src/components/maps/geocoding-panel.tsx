"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MapPin, MapPinOff, Pause, Play, Search, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat-card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MUNICIPAL_LOCALITIES, TRES_DE_FEBRERO_CENTER } from "@/lib/constants/localities";
import type { GeocodingStatus } from "@/lib/geocoding";
import type { GeocodingReviewRow } from "@/services/geocoding";
import {
  geocodeBatchAction,
  getGeocodingStatusAction,
  listGeocodingReviewAction,
  retryAddressAction,
  setManualLocationAction,
} from "@/app/(dashboard)/maps/ubicar/actions";

const LocationPickerMap = dynamic(() => import("@/components/maps/location-picker-map").then((m) => m.LocationPickerMap), {
  ssr: false,
  loading: () => <div className="h-[360px] w-full rounded-xl bg-muted/40 animate-pulse" />,
});

const fmt = (n: number) => n.toLocaleString("es-AR");

/** Centro aproximado para empezar a marcar: la localidad o el barrio de la persona, o el partido. */
function startingPoint(row: GeocodingReviewRow): [number, number] {
  const text = `${row.barrio || ""} ${row.localidad || ""}`.toLowerCase();
  const loc = MUNICIPAL_LOCALITIES.find((l) => {
    if (l.id === "all") return false;
    const name = l.name.toLowerCase().replace(/\(.*?\)/g, "").trim();
    return text.includes(name) || text.includes(l.id.replace(/-/g, " "));
  });
  return loc?.coordinates || TRES_DE_FEBRERO_CENTER;
}

export function GeocodingPanel({ initialStatus }: { initialStatus: GeocodingStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [running, setRunning] = useState<null | "georef" | "osm">(null);
  const [runTotal, setRunTotal] = useState(0);
  const [runDone, setRunDone] = useState(0);
  const [runLocated, setRunLocated] = useState(0);
  const stopRef = useRef(false);

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [review, setReview] = useState<{ total: number; rows: GeocodingReviewRow[] } | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [editing, setEditing] = useState<{ dni: string; direccion: string } | null>(null);
  const [savingDni, setSavingDni] = useState<string | null>(null);
  const [picking, setPicking] = useState<GeocodingReviewRow | null>(null);
  const [picked, setPicked] = useState<[number, number] | null>(null);

  const toSearch = status.pending + status.pendingOsm;
  const toReview = status.notFound + status.unusableAddress;

  const refreshStatus = useCallback(async () => {
    const res = await getGeocodingStatusAction();
    if (res.success) setStatus(res.status);
  }, []);

  const loadReview = useCallback(async (q: string, p: number) => {
    setLoadingReview(true);
    try {
      const res = await listGeocodingReviewAction(q, p);
      if (res.success) setReview({ total: res.total, rows: res.rows });
      else toast.error(res.error);
    } finally {
      setLoadingReview(false);
    }
  }, []);

  useEffect(() => {
    loadReview("", 1);
  }, [loadReview]);

  const start = async () => {
    stopRef.current = false;
    setRunTotal(toSearch);
    setRunDone(0);
    setRunLocated(0);
    let current = status;
    try {
      for (const phase of ["georef", "osm"] as const) {
        while (!stopRef.current && (phase === "georef" ? current.pending : current.pendingOsm) > 0) {
          setRunning(phase);
          const res = await geocodeBatchAction(phase);
          if (!res.success) {
            toast.error(res.error);
            return;
          }
          current = res.status;
          setStatus(res.status);
          setRunDone((d) => d + res.result.processed);
          setRunLocated((n) => n + res.result.located);
          if (res.result.processed === 0) break;
        }
      }
      if (!stopRef.current) toast.success("Listo: se buscaron todas las direcciones pendientes.");
    } finally {
      setRunning(null);
      loadReview(query, 1);
      setPage(1);
    }
  };

  const retry = async (row: GeocodingReviewRow) => {
    if (!editing) return;
    setSavingDni(row.dni);
    try {
      const res = await retryAddressAction(row.dni, editing.direccion);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast[res.located ? "success" : "warning"](res.located ? "Dirección encontrada y ubicada en el mapa." : "Tampoco se encontró esa dirección. Podés marcar el punto a mano.");
      setEditing(null);
      await Promise.all([refreshStatus(), loadReview(query, page)]);
    } finally {
      setSavingDni(null);
    }
  };

  const saveManual = async () => {
    if (!picking || !picked) return;
    setSavingDni(picking.dni);
    try {
      const res = await setManualLocationAction(picking.dni, picked[0], picked[1]);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Ubicación guardada.");
      setPicking(null);
      setPicked(null);
      await Promise.all([refreshStatus(), loadReview(query, page)]);
    } finally {
      setSavingDni(null);
    }
  };

  const pages = review ? Math.max(1, Math.ceil(review.total / 20)) : 1;
  const progress = runTotal > 0 ? Math.min(100, Math.round(((runTotal - (status.pending + status.pendingOsm)) / runTotal) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Ubicadas en el mapa" value={fmt(status.located)} icon={MapPin} tone="green" />
        <StatCard label="Por buscar" value={fmt(toSearch)} icon={Search} tone="blue" hint={status.pendingOsm > 0 ? `${fmt(status.pendingOsm)} se prueban con OpenStreetMap` : undefined} />
        <StatCard label="Para revisar" value={fmt(toReview)} icon={SearchX} tone="orange" hint="No se encontraron o la dirección está incompleta" />
        <StatCard label="Sin dirección cargada" value={fmt(status.withoutAddress)} icon={MapPinOff} tone="slate" />
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 space-y-4">
        <div className="space-y-1">
          <h2 className="font-heading text-lg font-bold">Buscar las direcciones</h2>
          <p className="text-sm text-muted-foreground">
            Primero se buscan en Georef, el servicio oficial de direcciones del Estado, de a muchas por vez. Las que Georef no encuentra se
            prueban con OpenStreetMap, de a una por segundo. Podés pausar cuando quieras: la próxima vez sigue donde quedó.
          </p>
        </div>

        {running && (
          <div className="space-y-2" aria-live="polite">
            <p className="text-sm font-medium">
              {running === "georef"
                ? "Buscando en Georef…"
                : `Probando con OpenStreetMap: faltan ${fmt(status.pendingOsm)} (cerca de ${Math.max(1, Math.ceil((status.pendingOsm * 1.3) / 60))} min).`}
            </p>
            <Progress value={progress} aria-label="Avance de la búsqueda" />
            <p className="text-xs text-muted-foreground">
              Ubicadas en esta búsqueda: {fmt(runLocated)}. No cierres esta pantalla mientras busca.
            </p>
          </div>
        )}
        {!running && runDone > 0 && (
          <p className="text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {runLocated === 1 ? "En esta búsqueda se ubicó 1 dirección." : `En esta búsqueda se ubicaron ${fmt(runLocated)} direcciones.`}
          </p>
        )}

        {running ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              stopRef.current = true;
              toast.info("Se pausa al terminar la tanda en curso.");
            }}
          >
            <Pause className="mr-2 h-4 w-4" /> Pausar
          </Button>
        ) : (
          <Button type="button" onClick={start} disabled={toSearch === 0}>
            <Play className="mr-2 h-4 w-4" />
            {toSearch === 0 ? "No hay direcciones por buscar" : toSearch === 1 ? "Ubicar 1 dirección" : `Ubicar ${fmt(toSearch)} direcciones`}
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 space-y-4">
        <div className="space-y-1">
          <h2 className="font-heading text-lg font-bold">Para revisar</h2>
          <p className="text-sm text-muted-foreground">Corregí la dirección y volvé a buscarla, o marcá el punto a mano en el mapa.</p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            loadReview(query, 1);
          }}
        >
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, DNI o dirección" aria-label="Buscar en la lista para revisar" />
          <Button type="submit" variant="outline" disabled={loadingReview}>
            {loadingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="sr-only sm:not-sr-only sm:ml-2">Buscar</span>
          </Button>
        </form>

        {review && review.rows.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">{query ? "No hay resultados para esa búsqueda." : "No hay direcciones para revisar."}</p>
        )}

        <ul className="divide-y divide-border">
          {review?.rows.map((row) => (
            <li key={row.dni} className="py-3 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{row.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    DNI {row.dni} · {row.direccion || "Sin dirección"}
                    {row.barrio ? ` · ${row.barrio}` : ""}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {row.motivo === "SIN_DIRECCION" ? "La dirección no tiene calle y altura" : "No se encontró la dirección"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(editing?.dni === row.dni ? null : { dni: row.dni, direccion: row.direccion || "" })}
                  >
                    Corregir dirección
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPicking(row);
                      setPicked(null);
                    }}
                  >
                    <MapPin className="mr-1 h-4 w-4" /> Marcar en el mapa
                  </Button>
                </div>
              </div>
              {editing?.dni === row.dni && (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    retry(row);
                  }}
                >
                  <Input
                    autoFocus
                    value={editing.direccion}
                    onChange={(e) => setEditing({ dni: row.dni, direccion: e.target.value })}
                    placeholder="Calle y altura, por ejemplo: Valentín Gómez 4752"
                    aria-label={`Dirección de ${row.nombre}`}
                  />
                  <Button type="submit" disabled={savingDni === row.dni}>
                    {savingDni === row.dni ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>

        {review && review.total > 20 && (
          <div className="flex items-center justify-between text-sm">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1 || loadingReview} onClick={() => { setPage(page - 1); loadReview(query, page - 1); }}>
              Anterior
            </Button>
            <span className="text-muted-foreground">Página {page} de {pages}</span>
            <Button type="button" variant="outline" size="sm" disabled={page >= pages || loadingReview} onClick={() => { setPage(page + 1); loadReview(query, page + 1); }}>
              Siguiente
            </Button>
          </div>
        )}
      </div>

      <Dialog open={Boolean(picking)} onOpenChange={(open) => !open && setPicking(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Marcar en el mapa</DialogTitle>
            <DialogDescription>
              {picking?.nombre} · {picking?.direccion || "Sin dirección"}. Tocá en el mapa el lugar donde vive y guardá.
            </DialogDescription>
          </DialogHeader>
          {picking && <LocationPickerMap center={startingPoint(picking)} value={picked} onPick={(lat, lon) => setPicked([lat, lon])} />}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPicking(null)}>Cancelar</Button>
            <Button type="button" onClick={saveManual} disabled={!picked || savingDni === picking?.dni}>
              {savingDni === picking?.dni ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar ubicación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
