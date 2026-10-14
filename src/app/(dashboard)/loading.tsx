import { Skeleton } from "@/components/ui/skeleton";

/** Pantalla de carga común a todas las secciones mientras llegan los datos. */
export default function SectionLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className="flex items-start gap-3.5 border-b border-border/60 pb-5">
        <Skeleton className="hidden h-11 w-11 rounded-xl sm:block" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72 max-w-[70vw]" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="mt-3 h-7 w-16" />
            <Skeleton className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-4 sm:p-6 space-y-3">
        <Skeleton className="h-9 w-full max-w-sm rounded-xl" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">Cargando información…</p>
    </div>
  );
}
