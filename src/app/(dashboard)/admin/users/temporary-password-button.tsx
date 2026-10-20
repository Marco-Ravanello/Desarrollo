"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { resetTemporaryPasswordAction } from "../actions/user-actions";

/** Genera una clave temporal para otra persona y la muestra una sola vez (solo Superadmin). */
export function TemporaryPasswordButton({
  userId,
  userName,
  isActive = true,
  className,
}: {
  userId: string;
  userName: string;
  isActive?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState<string | null>(null);

  const generate = async () => {
    setSaving(true);
    const res = await resetTemporaryPasswordAction(userId).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error((res as any)?.error || "No se pudo generar la clave. Probá de nuevo.");
    setPassword(res.password);
  };

  const copy = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Clave copiada");
    } catch {
      toast.error("No se pudo copiar. Seleccionala y copiala a mano.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        // Al cerrar se borra: la clave no se vuelve a mostrar.
        if (!v) setPassword(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className={className ?? "h-8 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 rounded-xl gap-1"}>
          <KeyRound className="h-3.5 w-3.5" />
          <span>Clave temporal</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Clave temporal para {userName}</DialogTitle>
          <DialogDescription>
            {password
              ? "Pasásela a la persona en mano o por teléfono. Al ingresar le va a pedir que elija una propia."
              : "Se genera una clave nueva. La que tiene ahora deja de funcionar y, al ingresar, le va a pedir que elija una propia."}
          </DialogDescription>
        </DialogHeader>

        {password ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/30 p-3">
              <code className="flex-1 select-all break-all text-center font-mono text-xl font-bold tracking-wider text-foreground">{password}</code>
              <Button type="button" variant="outline" size="sm" onClick={copy} className="shrink-0 rounded-xl gap-1.5 font-bold">
                <Copy className="h-3.5 w-3.5" /> Copiar
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">No se guarda en ningún lado y no se vuelve a mostrar. Si se pierde, generá otra.</p>
          </div>
        ) : (
          !isActive && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
              La cuenta está suspendida: para que pueda ingresar, también hay que activarla.
            </p>
          )
        )}

        <DialogFooter>
          {password ? (
            <Button type="button" onClick={() => setOpen(false)} className="rounded-xl font-bold">Listo</Button>
          ) : (
            <Button type="button" onClick={generate} disabled={saving} className="rounded-xl font-bold gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />} Generar clave temporal
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
