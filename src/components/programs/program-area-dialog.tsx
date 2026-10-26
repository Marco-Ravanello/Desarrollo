"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { setProgramAreaAction } from "@/app/(dashboard)/people/actions/program-area-actions";

const selectClass =
  "w-full h-10 px-3 rounded-xl bg-background border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

/** "Cambiar área a cargo" de un programa (solo la conducción ve el botón). */
export function ProgramAreaDialog({
  column,
  label,
  currentAreaId,
  areas,
}: {
  column: string;
  label: string;
  currentAreaId: string | null;
  areas: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [areaId, setAreaId] = useState(currentAreaId ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await setProgramAreaAction(column, areaId || null).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error(res?.error || "No se pudo guardar. Probá de nuevo.");
    toast.success(areaId ? "Área a cargo guardada." : "El programa quedó sin área a cargo.");
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setAreaId(currentAreaId ?? "");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl font-bold gap-1.5">
          <Building2 className="h-4 w-4" /> {currentAreaId ? "Cambiar área a cargo" : "Elegir área a cargo"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Área a cargo de {label}</DialogTitle>
            <DialogDescription>
              Esa área y la conducción dan las altas y bajas del programa. Sin área, las puede dar cualquiera que carga datos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="programa-area">Área</Label>
            <select id="programa-area" value={areaId} onChange={(e) => setAreaId(e.target.value)} className={selectClass}>
              <option value="">Sin área a cargo</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
