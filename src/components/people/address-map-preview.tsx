"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { CheckCircle2, Loader2, MapPin, MousePointerClick, RotateCcw, SearchX, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { previewAddressAction } from "@/app/(dashboard)/people/actions/address-preview";
import { ADDRESS_PREVIEW_DEBOUNCE_MS, addressPreviewKey, startingPointFor, type AddressPreview, type PickedPoint } from "@/lib/address-preview";

const LocationPickerMap = dynamic(() => import("@/components/maps/location-picker-map").then((m) => m.LocationPickerMap), {
  ssr: false,
  loading: () => <div className="h-[220px] w-full animate-pulse rounded-xl bg-muted/50" />,
});

type State = { kind: "idle" } | { kind: "searching" } | ({ kind: "done" } & AddressPreview);

/**
 * El mapa que aparece debajo de la dirección mientras se escribe (idea 157): busca la dirección y
 * muestra dónde cae. Si el punto no está bien o no se encontró, se toca el lugar correcto y se guarda ese.
 */
export function AddressMapPreview({
  direccion,
  localidad,
  barrio,
  picked,
  onPickedChange,
}: {
  direccion: string;
  localidad: string;
  barrio: string;
  picked: PickedPoint | null;
  onPickedChange: (p: PickedPoint | null) => void;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const cache = useRef(new Map<string, AddressPreview>());
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!direccion.trim()) {
      setState({ kind: "idle" });
      lastKey.current = null;
      return;
    }
    const key = addressPreviewKey(direccion, localidad, barrio);
    if (key === lastKey.current) return;
    const cached = cache.current.get(key);
    if (cached) {
      lastKey.current = key;
      setState({ kind: "done", ...cached });
      return;
    }
    setState({ kind: "searching" });
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await previewAddressAction(direccion, localidad, barrio).catch((): AddressPreview => ({ status: "SIN_SERVICIO" }));
      if (cancelled) return;
      if (res.status !== "SIN_SERVICIO") cache.current.set(key, res);
      lastKey.current = key;
      setState({ kind: "done", ...res });
    }, ADDRESS_PREVIEW_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [direccion, localidad, barrio]);

  if (state.kind === "idle") return null;

  const found = state.kind === "done" && state.status === "UBICADA" ? ([state.lat, state.lon] as [number, number]) : null;
  const shown: [number, number] | null = picked ? [picked.lat, picked.lon] : found;
  const showMap = state.kind === "done" && state.status !== "SIN_ALTURA";

  let icon = <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />;
  let text = "Buscando la dirección en el mapa…";
  let tone = "text-muted-foreground";
  if (picked) {
    icon = <MousePointerClick className="h-3.5 w-3.5 shrink-0" />;
    text = "Se va a guardar el punto que marcaste en el mapa.";
    tone = "text-primary";
  } else if (state.kind === "done") {
    if (state.status === "UBICADA") {
      icon = <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />;
      text = "Dirección encontrada. Si el punto no es exacto, tocá el lugar correcto en el mapa.";
      tone = "text-emerald-700 dark:text-emerald-400";
    } else if (state.status === "NO_ENCONTRADA") {
      icon = <SearchX className="h-3.5 w-3.5 shrink-0" />;
      text = "No se encontró esta dirección. Revisá la calle y la altura, o tocá en el mapa dónde vive.";
      tone = "text-amber-800 dark:text-amber-300";
    } else if (state.status === "SIN_ALTURA") {
      icon = <MapPin className="h-3.5 w-3.5 shrink-0" />;
      text = "Escribí la calle con la altura para verla en el mapa.";
    } else {
      icon = <WifiOff className="h-3.5 w-3.5 shrink-0" />;
      text = "El servicio de mapas no responde en este momento. Al guardar se vuelve a intentar, o podés marcar el lugar en el mapa.";
      tone = "text-amber-800 dark:text-amber-300";
    }
  }

  return (
    <div className="space-y-2" data-testid="vista-previa-mapa">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`flex items-start gap-1.5 text-xs font-semibold ${tone}`} role="status" aria-live="polite">
          <span className="mt-0.5">{icon}</span>
          {text}
        </p>
        {picked && (
          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 rounded-lg px-2 text-xs font-bold" onClick={() => onPickedChange(null)}>
            <RotateCcw className="h-3 w-3" /> {found ? "Usar el punto encontrado" : "Quitar el punto"}
          </Button>
        )}
      </div>
      {(showMap || picked) && (
        <div className="overflow-hidden rounded-xl border border-border/60">
          <LocationPickerMap
            center={startingPointFor(localidad, barrio)}
            value={shown}
            onPick={(lat, lon) => onPickedChange({ lat, lon })}
            className="h-[220px]"
            follow
          />
        </div>
      )}
      {picked && <input type="hidden" name="punto_lat" value={picked.lat} />}
      {picked && <input type="hidden" name="punto_lon" value={picked.lon} />}
    </div>
  );
}
