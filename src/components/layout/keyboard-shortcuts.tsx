"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Keyboard } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ABRIR_ATAJOS, ABRIR_BUSCADOR, ABRIR_GUIA, ATAJOS, accionDeTecla, estaEscribiendo } from "@/lib/atajos";
import { canAccessPath } from "@/lib/permissions";

/**
 * Atajos de teclado para toda la app: / busca, N abre un expediente nuevo, G la guía de la pantalla
 * y ? muestra esta lista. No hacen nada mientras se escribe en un campo o hay una ventana abierta.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const { data: session } = useSession();
  const puedeCargar = canAccessPath(session?.user?.role, "/cases/new");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (estaEscribiendo(document.activeElement)) return;
      // Con una ventana abierta (un diálogo, el buscador, un menú), las teclas son de esa ventana.
      if (document.querySelector('[role="dialog"], [role="menu"]')) return;
      const accion = accionDeTecla(e.key, puedeCargar);
      if (!accion) return;
      e.preventDefault();
      if (accion === "buscar") window.dispatchEvent(new Event(ABRIR_BUSCADOR));
      else if (accion === "guia") window.dispatchEvent(new Event(ABRIR_GUIA));
      else if (accion === "atajos") setOpen(true);
      else router.push("/cases/new");
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener(ABRIR_ATAJOS, onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(ABRIR_ATAJOS, onOpen);
    };
  }, [puedeCargar, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" /> Atajos de teclado
          </DialogTitle>
          <DialogDescription>Funcionan en cualquier pantalla, mientras no estés escribiendo en un campo.</DialogDescription>
        </DialogHeader>
        <dl className="divide-y divide-border/50">
          {ATAJOS.filter((a) => !a.soloCarga || puedeCargar).map((a) => (
            <div key={a.que} className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-sm text-foreground">{a.que}</dt>
              <dd className="flex shrink-0 items-center gap-1">
                {a.teclas.map((t) => (
                  <kbd
                    key={t}
                    className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-border bg-muted px-2 font-sans text-xs font-bold text-foreground shadow-[inset_0_-1px_0_hsl(var(--border))]"
                  >
                    {t}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            setOpen(false);
            window.dispatchEvent(new Event(ABRIR_GUIA));
          }}
        >
          Ver la guía de esta pantalla
        </Button>
      </DialogContent>
    </Dialog>
  );
}
