"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function CaseDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Error en vista de expediente:", error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
      <div className="p-4 rounded-3xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
        <AlertTriangle className="h-10 w-10 animate-pulse" />
      </div>
      <div className="space-y-1 max-w-md">
        <h2 className="text-2xl font-bold text-foreground tracking-tight">
          No se pudo cargar el expediente
        </h2>
        <p className="text-sm text-muted-foreground">
          Ocurrió un problema temporal al recuperar la información del expediente o los datos del ciudadano.
        </p>
        {error.digest && (
          <p className="text-[10px] font-mono text-muted-foreground/60 pt-1">
            Código de diagnóstico: {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          onClick={() => reset()}
          className="rounded-xl border-border/60 font-semibold gap-2"
        >
          <RefreshCw className="h-4 w-4" /> Reintentar
        </Button>
        <Button asChild className="rounded-xl font-semibold gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
          <Link href="/cases">
            <ArrowLeft className="h-4 w-4" /> Volver a Expedientes
          </Link>
        </Button>
      </div>
    </div>
  );
}
