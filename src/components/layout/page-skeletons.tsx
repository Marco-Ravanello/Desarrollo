import { MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Pantallas de carga con la forma de cada página: mientras llegan los datos se
// ven los bloques donde va a aparecer cada cosa, en lugar de una página en blanco.

const card = "rounded-2xl border border-border/60 bg-card shadow-xs";
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
// Anchos que varían un poco entre filas, para que no parezca una grilla rígida.
const widths = ["w-3/4", "w-2/3", "w-4/5", "w-1/2", "w-3/5"];

export function LoadingPage({ children, label = "Cargando…" }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function SkeletonHeader({ actions = 1, badge = false }: { actions?: number; badge?: boolean }) {
  return (
    <div className="flex flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3.5">
        <Skeleton className="hidden h-11 w-11 shrink-0 rounded-xl sm:block" />
        <div className="space-y-2.5">
          <Skeleton className="h-8 w-64 max-w-[70vw]" />
          {badge && <Skeleton className="h-5 w-28 rounded-full" />}
          <Skeleton className="h-4 w-80 max-w-[75vw]" />
        </div>
      </div>
      {actions > 0 && (
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {range(actions).map((i) => (
            <Skeleton key={i} className={cn("h-10 rounded-xl", i === actions - 1 ? "w-36" : "w-28")} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:gap-4", count === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4")}>
      {range(count).map((i) => (
        <div key={i} className={cn(card, "p-4 sm:p-5")}>
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <Skeleton className="mt-4 h-8 w-20" />
          <Skeleton className="mt-3 h-3 w-32 max-w-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonFilters({ count = 3 }: { count?: number }) {
  return (
    <div className={cn(card, "flex flex-col gap-3 p-4 sm:flex-row sm:items-center")}>
      <Skeleton className="h-10 w-full rounded-xl sm:w-64" />
      {range(count).map((i) => (
        <Skeleton key={i} className="hidden h-10 w-36 rounded-xl sm:block" />
      ))}
      <Skeleton className="h-10 w-full rounded-xl sm:ml-auto sm:w-24" />
    </div>
  );
}

/** Tabla en pantallas anchas; en el celular, tarjetas (como las tablas reales). */
export function SkeletonTable({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className={cn(card, "overflow-hidden")}>
      <div className="hidden md:block">
        <div className="flex gap-6 border-b border-border/40 bg-muted/40 px-5 py-4">
          {range(columns).map((c) => (
            <Skeleton key={c} className={cn("h-3 bg-muted-foreground/15", c === 0 ? "w-40" : "w-20", c === columns - 1 && "ml-auto w-14")} />
          ))}
        </div>
        <div className="divide-y divide-border/30">
          {range(rows).map((r) => (
            <div key={r} className="flex items-center gap-6 px-5 py-4">
              <div className="w-40 space-y-2">
                <Skeleton className={cn("h-3.5", widths[r % widths.length])} />
                <Skeleton className="h-3 w-1/2 bg-muted-foreground/[0.07]" />
              </div>
              {range(Math.max(columns - 2, 0)).map((c) => (
                <Skeleton key={c} className={cn("h-3.5", c % 2 ? "w-16 rounded-full" : "w-24")} />
              ))}
              <Skeleton className="ml-auto h-7 w-14 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
      <div className="divide-y divide-border/30 md:hidden">
        {range(Math.min(rows, 4)).map((r) => (
          <div key={r} className="space-y-2.5 p-4">
            <Skeleton className={cn("h-4", widths[r % widths.length])} />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Tarjeta con título y algunas líneas (paneles del inicio, datos de un expediente). */
export function SkeletonPanel({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn(card, "space-y-4 p-5", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="space-y-3.5">
        {range(lines).map((i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className={cn("h-3.5", widths[i % widths.length])} />
            <Skeleton className="h-3 w-1/2 bg-muted-foreground/[0.07]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonTabs({ count = 3 }: { count?: number }) {
  return (
    <div className={cn(card, "inline-flex gap-1 rounded-2xl bg-muted/40 p-1 shadow-none")}>
      {range(count).map((i) => (
        <Skeleton key={i} className={cn("h-8 rounded-xl", i === 0 ? "w-28 bg-muted-foreground/15" : "w-24")} />
      ))}
    </div>
  );
}

/** Lugar del mapa mientras se descarga (los mapas tardan más que el resto). */
export function MapPlaceholder({ height = 620, label = "Cargando el mapa…", className }: { height?: number; label?: string; className?: string }) {
  return (
    <div
      className={cn("skeleton-shimmer relative flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-border/50 bg-muted-foreground/[0.06]", className)}
      style={{ height }}
      role="status"
      aria-live="polite"
    >
      {/* Calles dibujadas de fondo, para que se lea como un mapa. */}
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full text-muted-foreground/15" preserveAspectRatio="none" viewBox="0 0 400 300">
        <path d="M-10 80 L410 40 M-10 190 L410 230 M90 -10 L130 310 M260 -10 L230 310 M-10 260 L180 -10" stroke="currentColor" strokeWidth="6" fill="none" />
        <path d="M-10 130 L410 120 M330 -10 L350 310 M30 -10 L60 310" stroke="currentColor" strokeWidth="2.5" fill="none" />
      </svg>
      <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-sm">
        <MapPin className="h-5 w-5 text-primary" />
      </div>
      <p className="relative rounded-full bg-card/90 px-3 py-1 text-xs font-semibold text-muted-foreground shadow-xs">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Páginas completas
// ---------------------------------------------------------------------------

/** Listados: encabezado, indicadores, filtros y tabla (la forma de casi todas las secciones). */
export function ListPageSkeleton({
  stats = 4,
  filters = 3,
  columns = 5,
  actions = 1,
}: {
  stats?: number;
  filters?: number;
  columns?: number;
  actions?: number;
}) {
  return (
    <LoadingPage>
      <SkeletonHeader actions={actions} />
      {stats > 0 && <SkeletonStats count={stats} />}
      <SkeletonFilters count={filters} />
      <SkeletonTable columns={columns} />
    </LoadingPage>
  );
}

export function DashboardSkeleton() {
  return (
    <LoadingPage label="Cargando el inicio…">
      <SkeletonHeader actions={3} />
      <SkeletonStats count={4} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SkeletonPanel lines={3} className="min-h-[340px]" />
        <SkeletonPanel lines={2} className="min-h-[340px]" />
        <div className={cn(card, "space-y-4 p-5")}>
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-16" />
          </div>
          <MapPlaceholder height={220} label="Cargando el mapa…" className="rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
        <SkeletonPanel lines={3} />
        <SkeletonPanel lines={2} />
        <SkeletonPanel lines={2} />
      </div>
    </LoadingPage>
  );
}

/** Página de un expediente: encabezado, titular, cuatro datos, pestañas e historia. */
export function CaseSkeleton() {
  return (
    <LoadingPage label="Cargando el expediente…">
      <SkeletonHeader actions={2} />
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {range(4).map((i) => (
          <div key={i} className={cn(card, "space-y-3 p-4")}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-3 w-32 max-w-full" />
          </div>
        ))}
      </div>
      <SkeletonTabs count={3} />
      <div className={cn(card, "space-y-5 p-5 sm:p-6")}>
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3.5 w-80 max-w-full" />
        </div>
        <Skeleton className="h-11 w-full rounded-xl" />
        {range(3).map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2 rounded-2xl border border-border/50 p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className={cn("h-4", widths[i % widths.length])} />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </LoadingPage>
  );
}

/** Ficha de una persona: encabezado, pestañas y datos. */
export function PersonSkeleton() {
  return (
    <LoadingPage label="Cargando la ficha…">
      <SkeletonHeader actions={1} />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-5 w-28 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-32 rounded-full" />
      </div>
      <div className={cn(card, "space-y-6 p-5")}>
        <SkeletonTabs count={6} />
        <div className="grid gap-6 lg:grid-cols-2">
          <SkeletonPanel lines={4} />
          <SkeletonPanel lines={3} />
        </div>
      </div>
    </LoadingPage>
  );
}

/** Mapa Social: encabezado, filtros, indicadores y el mapa. */
export function MapPageSkeleton() {
  return (
    <LoadingPage label="Cargando el Mapa Social…">
      <SkeletonHeader actions={2} />
      <SkeletonFilters count={2} />
      <SkeletonStats count={4} />
      <MapPlaceholder height={520} />
    </LoadingPage>
  );
}

/** Formularios de alta (nuevo expediente, nueva persona). */
export function FormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <LoadingPage label="Cargando el formulario…">
      <SkeletonHeader actions={0} />
      <div className={cn(card, "max-w-3xl space-y-5 p-5 sm:p-6")}>
        <div className="grid gap-5 sm:grid-cols-2">
          {range(fields).map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
        <Skeleton className="ml-auto h-11 w-40 rounded-xl" />
      </div>
    </LoadingPage>
  );
}
