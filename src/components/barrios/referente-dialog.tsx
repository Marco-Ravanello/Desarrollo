"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { setReferenteAction } from "@/app/(dashboard)/barrios/actions";

type Option = { id: string; name: string; area: string | null };

const selectClass =
  "w-full h-10 px-3 rounded-xl bg-background border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

/** La conducción elige a qué persona del equipo le toca el barrio. */
export function ReferenteDialog({ barrio, current, options }: { barrio: string; current: string | null; options: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState(current ?? "");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await setReferenteAction(barrio, userId || null).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error(res && !res.success ? res.error : "No se pudo guardar. Probá de nuevo.");
    toast.success(userId ? "Referente guardado. Le llegó un aviso." : "El barrio quedó sin referente.");
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setUserId(current ?? "");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 rounded-xl px-2 text-xs font-bold text-primary">
          <UserCog className="mr-1 h-3.5 w-3.5" aria-hidden />
          {current ? "Cambiar" : "Elegir referente"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Referente de {barrio}</DialogTitle>
            <DialogDescription>
              La persona del equipo a la que le toca el barrio: aparece en la página del barrio y se suma sola a las recorridas que se armen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="referente-usuario">Referente</Label>
            <select id="referente-usuario" className={selectClass} value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Sin referente</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}{o.area ? ` · ${o.area}` : ""}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button type="submit" disabled={saving} className="rounded-xl font-bold">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
