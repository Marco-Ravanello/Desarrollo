"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Mensaje común cuando una pantalla no se pudo cargar. */
export default function SectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Error al cargar la pantalla:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-700 dark:text-rose-400">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <div className="max-w-md space-y-1">
        <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">No se pudo cargar esta pantalla</h2>
        <p className="text-sm text-muted-foreground">
          Puede ser un problema momentáneo de conexión. Probá de nuevo en unos segundos.
        </p>
        {error.digest && (
          <p className="pt-1 font-mono text-xs text-muted-foreground">Código: {error.digest}</p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2 pt-1">
        <Button variant="outline" onClick={() => reset()} className="gap-2 rounded-xl">
          <RefreshCw className="h-4 w-4" /> Reintentar
        </Button>
        <Button asChild className="gap-2 rounded-xl">
          <Link href="/dashboard">
            <Home className="h-4 w-4" /> Ir al inicio
          </Link>
        </Button>
      </div>
    </div>
  );
}
