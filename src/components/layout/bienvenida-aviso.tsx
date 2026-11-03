"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowRight, CircleHelp, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { bienvenidaPara } from "@/lib/bienvenida";
import { ABRIR_BIENVENIDA, ABRIR_GUIA } from "@/lib/atajos";
import { NOVEDADES_VISTAS_KEY, ULTIMA_NOVEDAD, claveNovedad } from "@/lib/novedades";
import { markWelcomeSeenAction } from "@/app/(dashboard)/actions/bienvenida";

/**
 * Bienvenida de la primera vez: lo básico del trabajo de cada rol, con un enlace a cada pantalla.
 * Se muestra una sola vez por persona (queda anotado en la base) y se puede volver a ver desde la guía "?".
 * No aparece mientras se cambia la clave del primer ingreso ni en la Sala de Situación.
 */
export function BienvenidaAviso({ firstTime, onDone }: { firstTime: boolean; onDone?: () => void }) {
  const pathname = usePathname() ?? "/";
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(firstTime);
  const blocked = pathname.startsWith("/cambiar-clave") || pathname.startsWith("/admin/war-room");
  const bienvenida = bienvenidaPara(session?.user?.role);

  useEffect(() => {
    if (pending && status === "authenticated" && !blocked && bienvenida) setOpen(true);
  }, [pending, status, blocked, bienvenida]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(ABRIR_BIENVENIDA, onOpen);
    return () => window.removeEventListener(ABRIR_BIENVENIDA, onOpen);
  }, []);

  const close = () => {
    setOpen(false);
    if (!pending) return;
    setPending(false);
    // Quien recién empieza no necesita las novedades de antes: quedan como vistas en este navegador.
    try {
      if (ULTIMA_NOVEDAD) window.localStorage.setItem(NOVEDADES_VISTAS_KEY, claveNovedad(ULTIMA_NOVEDAD));
    } catch {
      // Sin acceso a la memoria del navegador: las novedades se muestran después, nada más.
    }
    markWelcomeSeenAction().catch(() => {
      // Si no se pudo anotar, la bienvenida vuelve a aparecer la próxima vez: no es grave.
    });
    onDone?.();
  };

  if (!bienvenida) return null;
  const firstName = (session?.user?.name || "").trim().split(/\s+/)[0];

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogContent className="max-w-lg overflow-hidden rounded-2xl p-0">
        <div className="border-b-[3px] border-muni-orange bg-gradient-to-r from-[#0E2A49] via-[#163C68] to-[#22507F] px-6 py-5 text-white">
          <DialogHeader className="space-y-1 text-left">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-white/75">
              <Hand className="h-3.5 w-3.5 text-muni-orange" aria-hidden /> MuniGestión 3F
            </p>
            <DialogTitle className="font-heading text-xl font-bold text-white">
              {firstName ? `Te damos la bienvenida, ${firstName}` : "Te damos la bienvenida"}
            </DialogTitle>
            <DialogDescription className="text-sm text-white/80">
              Tu rol es <strong className="font-semibold text-white">{bienvenida.rol}</strong>. Esto es lo básico para empezar:
            </DialogDescription>
          </DialogHeader>
        </div>

        <ol className="max-h-[55vh] space-y-2 overflow-y-auto px-6 py-5">
          {bienvenida.pasos.map((p, i) => (
            <li key={p.titulo}>
              <Link
                href={p.href}
                onClick={close}
                className="group flex gap-3 rounded-xl border border-border/60 px-3.5 py-3 transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E0EEFF] text-xs font-bold text-[#163C68] dark:bg-white/10 dark:text-blue-100"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-sm font-semibold text-foreground">
                    {p.titulo}
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
                  </span>
                  <span className="block text-sm text-muted-foreground">{p.texto}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
        {bienvenida.cierre && <p className="-mt-2 px-6 pb-4 text-xs text-muted-foreground">{bienvenida.cierre}</p>}

        <DialogFooter className="flex-row items-center justify-between gap-2 border-t border-border/60 px-6 py-4 sm:justify-between">
          {bienvenida.cierre ? (
            <button
              type="button"
              onClick={() => {
                close();
                window.dispatchEvent(new Event(ABRIR_GUIA));
              }}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <CircleHelp className="h-4 w-4" aria-hidden /> Guía de esta pantalla
            </button>
          ) : (
            <span />
          )}
          <Button onClick={close} className="rounded-xl">Empezar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
