"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canAccessPath } from "@/lib/permissions";

/** Acceso a la Sala de Situación (no lo ve el relevador de emergencia). */
export function SituationRoomButton() {
  const { data: session } = useSession();
  if (!session?.user || !canAccessPath(session.user.role, "/admin/war-room")) return null;
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="rounded-xl h-9 px-3 text-xs font-bold border-border/60 hover:bg-primary/10 hover:text-primary transition-colors hidden md:flex items-center gap-1.5"
      title="Abrir Sala de Situación Ejecutiva (Modo Proyector)"
    >
      <Link href="/admin/war-room">
        <Tv className="h-3.5 w-3.5 text-blue-500" />
        <span>Sala de Situación</span>
      </Link>
    </Button>
  );
}

/**
 * Activa el modo sin conexión (public/sw.js): la pantalla de Emergencia
 * Climática se puede abrir y usar sin internet. Solo en producción, para no
 * interferir mientras se programa.
 */
export function OfflineSupport() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
