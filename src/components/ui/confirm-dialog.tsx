"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Confirmaciones con la ventana de la app (en lugar de la ventana gris del navegador).
 *
 *   if (!(await confirmar({ title: "¿Borrar esta fila?", confirmLabel: "Borrar", danger: true }))) return;
 *
 * Necesita <ConfirmHost /> una sola vez en la página (está en el layout principal).
 */
export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Para lo que borra o da de baja: el botón va en rojo. */
  danger?: boolean;
}

type Request = ConfirmOptions & { resolve: (ok: boolean) => void };

let showRequest: ((req: Request) => void) | null = null;

export function confirmar(options: ConfirmOptions | string): Promise<boolean> {
  const opts = typeof options === "string" ? { title: options } : options;
  // Si por algún motivo la ventana de la app no está montada, se usa la del navegador.
  if (!showRequest) return Promise.resolve(typeof window !== "undefined" && window.confirm(opts.title));
  return new Promise((resolve) => showRequest!({ ...opts, resolve }));
}

export function ConfirmHost() {
  const [request, setRequest] = useState<Request | null>(null);
  const [open, setOpen] = useState(false);
  const pending = useRef<Request | null>(null);

  useEffect(() => {
    showRequest = (req) => {
      // Si quedó otra pregunta abierta, se la toma como "Cancelar".
      pending.current?.resolve(false);
      pending.current = req;
      setRequest(req);
      setOpen(true);
    };
    return () => {
      showRequest = null;
    };
  }, []);

  const finish = (ok: boolean) => {
    pending.current?.resolve(ok);
    pending.current = null;
    setOpen(false);
  };

  const Icon = request?.danger ? AlertTriangle : HelpCircle;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) finish(false); }}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader className="flex-row items-start gap-3 space-y-0 text-left">
          <span
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              request?.danger ? "bg-destructive/10 text-destructive" : "bg-secondary text-primary"
            }`}
            aria-hidden="true"
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="space-y-1.5 pr-6">
            <DialogTitle className="text-base leading-snug">{request?.title}</DialogTitle>
            {request?.description ? (
              <DialogDescription>{request.description}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">Confirmá para seguir.</DialogDescription>
            )}
          </div>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => finish(false)}>
            {request?.cancelLabel ?? "Cancelar"}
          </Button>
          <Button
            type="button"
            variant={request?.danger ? "destructive" : "default"}
            onClick={() => finish(true)}
            autoFocus
          >
            {request?.confirmLabel ?? "Aceptar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
