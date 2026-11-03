"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

/** El mapa del barrio se carga solo en el navegador (Leaflet no funciona en el servidor). */
export const BarrioMapLoader = dynamic(() => import("./barrio-map").then((m) => m.BarrioMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-2xl border border-border/60 bg-muted/20 text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Cargando el mapa…
    </div>
  ),
});

/** El mapa de todos los barrios pintados (también solo en el navegador). */
export const BarriosMapaPintadoLoader = dynamic(() => import("./barrios-mapa-pintado").then((m) => m.BarriosMapaPintado), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] items-center justify-center rounded-2xl border border-border/60 bg-muted/20 text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Cargando el mapa…
    </div>
  ),
});
