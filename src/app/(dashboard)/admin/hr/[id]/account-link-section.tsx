"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FormSection, fieldSelectClass } from "@/components/ui/form-section";
import { linkHRUserAction } from "@/app/(dashboard)/admin/actions/hr-actions";

type Option = { id: string; name: string; detail: string; linkedTo: string | null };

/**
 * "Cuenta en la app" en el legajo (idea 127): con qué usuario se une. Así, cuando la persona está de
 * licencia o de vacaciones, se ve al asignarle expedientes y en Carga del equipo.
 */
export function AccountLinkSection({
  agentId,
  linkedUserId,
  options,
  suggestedId,
  canEdit,
}: {
  agentId: string;
  linkedUserId: string | null;
  options: Option[];
  suggestedId: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(linkedUserId ?? "");
  const [saving, setSaving] = useState(false);
  const linked = options.find((o) => o.id === linkedUserId) ?? null;
  const suggested = !linkedUserId && suggestedId ? options.find((o) => o.id === suggestedId) ?? null : null;

  const save = async (userId: string | null) => {
    setSaving(true);
    const res = await linkHRUserAction(agentId, userId).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error((res as any)?.error || "No se pudo guardar. Probá de nuevo.");
    toast.success(userId ? "Listo. El legajo quedó unido con ese usuario." : "El legajo ya no está unido a ningún usuario.");
    router.refresh();
  };

  return (
    <FormSection
      icon={KeyRound}
      title="Cuenta en la app"
      description="Si la persona usa la app, uní su usuario con este legajo. Así sus licencias y vacaciones se ven al asignar expedientes, sin mostrar el tipo de licencia."
    >
      {!canEdit ? (
        <p className="text-sm font-semibold text-foreground">
          {linked ? linked.name : <span className="font-normal text-muted-foreground">Sin unir</span>}
        </p>
      ) : (
        <form
          className="space-y-2 print:hidden"
          onSubmit={(e) => {
            e.preventDefault();
            save(selected || null);
          }}
        >
          <Label htmlFor="hr-account" className="text-xs font-bold">Usuario de la app</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select id="hr-account" value={selected} onChange={(e) => setSelected(e.target.value)} className={fieldSelectClass}>
              <option value="">Sin unir</option>
              {options.map((o) => (
                <option key={o.id} value={o.id} disabled={Boolean(o.linkedTo)}>
                  {o.name}
                  {o.detail ? ` (${o.detail})` : ""}
                  {o.linkedTo ? ` · ya unido a ${o.linkedTo}` : ""}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={saving || selected === (linkedUserId ?? "")} className="shrink-0 rounded-xl font-bold gap-1.5">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar
            </Button>
          </div>
          {suggested && selected !== suggested.id && (
            <p className="text-xs text-muted-foreground">
              Parece ser <span className="font-semibold text-foreground">{suggested.name}</span>
              {suggested.detail ? ` (${suggested.detail})` : ""}.{" "}
              <button type="button" onClick={() => setSelected(suggested.id)} className="font-semibold text-primary hover:underline">
                Elegir
              </button>
            </p>
          )}
        </form>
      )}
    </FormSection>
  );
}
