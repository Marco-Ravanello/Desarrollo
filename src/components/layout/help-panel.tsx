"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, CircleHelp, Hand, Keyboard, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMunicipalSettings } from "@/components/providers/municipal-settings";
import { guiaPara } from "@/lib/ayuda";
import { ABRIR_ATAJOS, ABRIR_BIENVENIDA, ABRIR_GUIA } from "@/lib/atajos";

/**
 * Botón "?" del encabezado: abre al costado la guía "¿Cómo hago para…?" de la pantalla en la que se está.
 * No aparece solo: se abre únicamente con el botón, la tecla G o desde el menú del usuario
 * (en el celular el botón no entra en el encabezado: queda en el menú del usuario).
 */
export function HelpPanel() {
  const pathname = usePathname() ?? "/";
  const settings = useMunicipalSettings();
  const [open, setOpen] = useState(false);
  const guia = guiaPara(pathname);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(ABRIR_GUIA, onOpen);
    return () => window.removeEventListener(ABRIR_GUIA, onOpen);
  }, []);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="hidden h-9 w-9 rounded-xl text-white/90 hover:bg-white/10 hover:text-white sm:inline-flex"
        aria-label="¿Cómo hago para…? Guía de esta pantalla"
        title="¿Cómo hago para…? (tecla G)"
      >
        <CircleHelp className="h-5 w-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-[22rem] max-w-[90vw] flex-col gap-0 overflow-y-auto border-l border-border/60 bg-card p-0">
          <SheetHeader className="border-b-[3px] border-muni-orange bg-gradient-to-r from-[#0E2A49] to-[#163C68] px-5 py-4 text-left text-white">
            <SheetTitle className="font-heading text-lg text-white">¿Cómo hago para…?</SheetTitle>
            <SheetDescription className="text-sm text-white/75">{guia.pantalla}</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-2 px-4 py-4">
            {guia.preguntas.map((q, i) => (
              <details key={q.p} open={i === 0} className="group rounded-xl border border-border/60 bg-background/60 open:bg-card">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-2 px-3.5 py-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                  {q.p}
                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                </summary>
                <ol className="list-decimal space-y-1.5 px-3.5 pb-3.5 pl-8 text-sm leading-relaxed text-muted-foreground marker:font-semibold marker:text-[#C2410C] dark:marker:text-muni-orange">
                  {q.r.map((paso) => (
                    <li key={paso}>{paso}</li>
                  ))}
                </ol>
              </details>
            ))}
          </div>

          <div className="space-y-2 border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <button
                type="button"
                className="hidden items-center gap-1.5 font-semibold text-primary hover:underline md:inline-flex"
                onClick={() => {
                  setOpen(false);
                  window.dispatchEvent(new Event(ABRIR_ATAJOS));
                }}
              >
                <Keyboard className="h-3.5 w-3.5" /> Atajos de teclado
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
                onClick={() => {
                  setOpen(false);
                  window.dispatchEvent(new Event(ABRIR_BIENVENIDA));
                }}
              >
                <Hand className="h-3.5 w-3.5" /> Ver la bienvenida otra vez
              </button>
            </div>
            {settings.helpdeskPhone.trim() && (
              <p className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 shrink-0" /> ¿No encontrás lo que buscás? Mesa de ayuda:{" "}
                <span className="font-semibold text-foreground">{settings.helpdeskPhone}</span>
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
