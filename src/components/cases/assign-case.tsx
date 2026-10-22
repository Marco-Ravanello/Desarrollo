"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Hand, Loader2, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { assignCaseAction } from "@/app/(dashboard)/cases/actions/case-actions";

type Option = { id: string; name: string; sameArea: boolean };

const selectClass =
  "flex h-10 w-full rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

/** Botones para asignar, cambiar o tomar el expediente (según lo que pueda hacer quien lo mira). */
export function AssignCaseControl({
  caseId,
  areaLabel,
  assigneeId,
  canAssign,
  canTake,
  currentUserId,
  options,
}: {
  caseId: string;
  areaLabel: string;
  assigneeId: string | null;
  canAssign: boolean;
  canTake: boolean;
  currentUserId: string;
  options: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(assigneeId ?? "");
  const [saving, setSaving] = useState(false);

  const save = async (id: string | null, okMessage: string) => {
    setSaving(true);
    const res = await assignCaseAction(caseId, id).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error((res as any)?.error || "No se pudo guardar. Probá de nuevo.");
    toast.success(okMessage);
    setOpen(false);
    router.refresh();
  };

  if (!canAssign) {
    if (!canTake || assigneeId) return null;
    return (
      <Button size="sm" variant="outline" disabled={saving} onClick={() => save(currentUserId, "Quedaste a cargo del expediente.")} className="h-7 rounded-lg px-2 text-xs font-bold gap-1">
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Hand className="h-3 w-3" />} Lo tomo yo
      </Button>
    );
  }

  const area = options.filter((o) => o.sameArea);
  const others = options.filter((o) => !o.sameArea);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setSelected(assigneeId ?? "");
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 rounded-lg px-2 text-xs font-bold gap-1">
          <UserCog className="h-3 w-3" /> {assigneeId ? "Cambiar" : "Asignar"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const id = selected || null;
            if (id === (assigneeId ?? null)) return setOpen(false);
            save(
              id,
              !id
                ? "El expediente quedó sin profesional a cargo."
                : id === currentUserId
                  ? "Quedaste a cargo del expediente."
                  : "Listo. Le llega un aviso a la persona a cargo."
            );
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>Profesional a cargo</DialogTitle>
            <DialogDescription>Elegí quién sigue el expediente. Le llega un aviso y lo ve en “Mis expedientes”.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="assignee" className="text-xs font-bold">Persona a cargo</Label>
            <select id="assignee" value={selected} onChange={(e) => setSelected(e.target.value)} className={selectClass}>
              <option value="">Sin profesional a cargo</option>
              {area.length > 0 && (
                <optgroup label={areaLabel}>
                  {area.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}{o.id === currentUserId ? " (vos)" : ""}</option>
                  ))}
                </optgroup>
              )}
              {others.length > 0 && (
                <optgroup label="Conducción">
                  {others.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}{o.id === currentUserId ? " (vos)" : ""}</option>
                  ))}
                </optgroup>
              )}
            </select>
            {area.length === 0 && (
              <p className="text-xs text-muted-foreground">No hay usuarios activos cargados en {areaLabel}.</p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving} className="rounded-xl font-bold gap-1.5">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
