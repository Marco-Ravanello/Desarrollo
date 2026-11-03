"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { isEmergencySurveyor } from "@/lib/permissions";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ULTIMA_NOVEDAD, fechaNovedad } from "@/lib/novedades";

const STORAGE_KEY = "muni-novedades-vistas";

/**
 * Después de una actualización, muestra una vez las novedades más nuevas. Lo que ya se vio queda
 * anotado en este navegador; si no se puede anotar (ventana privada), no se muestra para no repetirlo.
 */
export function NovedadesAviso() {
  const [open, setOpen] = useState(false);
  const novedad = ULTIMA_NOVEDAD;
  const pathname = usePathname();
  const { data: session, status } = useSession();
  // Quien solo releva la emergencia no usa el resto de la app; en la Sala de Situación
  // (que puede estar en una tele) tampoco se interrumpe.
  const skip = status !== "authenticated" || isEmergencySurveyor(session?.user?.role) || pathname.startsWith("/admin/war-room");

  useEffect(() => {
    if (!novedad || skip) return;
    try {
      if (window.localStorage.getItem(STORAGE_KEY) !== novedad.fecha) setOpen(true);
    } catch {
      // Sin acceso a la memoria del navegador: no se muestra.
    }
  }, [novedad, skip]);

  const close = () => {
    setOpen(false);
    try {
      if (novedad) window.localStorage.setItem(STORAGE_KEY, novedad.fecha);
    } catch {
      // Nada que hacer: la próxima vez se vuelve a mostrar.
    }
  };

  if (!novedad) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden">
        <div className="border-b-[3px] border-muni-orange bg-gradient-to-r from-[#0E2A49] via-[#163C68] to-[#22507F] px-6 py-5 text-white">
          <DialogHeader className="space-y-1 text-left">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-white/75">
              <Sparkles className="h-3.5 w-3.5 text-muni-orange" aria-hidden /> Novedades · {fechaNovedad(novedad.fecha)}
            </p>
            <DialogTitle className="font-heading text-xl font-bold text-white">{novedad.titulo}</DialogTitle>
            <DialogDescription className="text-sm text-white/80">Esto cambió en la app desde la última vez.</DialogDescription>
          </DialogHeader>
        </div>
        <ul className="max-h-[50vh] space-y-2.5 overflow-y-auto px-6 py-5 text-sm text-foreground">
          {novedad.cambios.map((c, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-muni-orange" aria-hidden />
              <span>{c}</span>
            </li>
          ))}
        </ul>
        <DialogFooter className="flex-row items-center justify-between gap-2 border-t border-border/60 px-6 py-4 sm:justify-between">
          <Link href="/novedades" onClick={close} className="text-sm font-semibold text-primary hover:underline">
            Ver todas las novedades
          </Link>
          <Button onClick={close} className="rounded-xl">Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
