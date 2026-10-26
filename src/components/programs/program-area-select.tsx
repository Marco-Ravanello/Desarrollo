"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { setProgramAreaAction } from "@/app/(dashboard)/people/actions/program-area-actions";
import { getAreaShortName } from "@/lib/area-theme";

/** Elegir el área a cargo directo desde la lista de Programas (solo la conducción la ve). Se guarda al elegir. */
export function ProgramAreaSelect({
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
  const [value, setValue] = useState(currentAreaId ?? "");
  const [saving, setSaving] = useState(false);

  const change = async (areaId: string) => {
    const previous = value;
    setValue(areaId);
    setSaving(true);
    const res = await setProgramAreaAction(column, areaId || null).catch(() => null);
    setSaving(false);
    if (!res?.success) {
      setValue(previous);
      return toast.error(res?.error || "No se pudo guardar. Probá de nuevo.");
    }
    const area = areas.find((a) => a.id === areaId);
    toast.success(area ? `${label} quedó a cargo de ${getAreaShortName(area.name)}.` : `${label} quedó sin área a cargo.`);
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label={`Área a cargo de ${label}`}
        value={value}
        disabled={saving}
        onChange={(e) => change(e.target.value)}
        className={`h-9 w-full min-w-[12rem] max-w-[18rem] rounded-xl border border-input bg-background px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary ${
          value ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        <option value="">Sin área a cargo</option>
        {areas.map((a) => (
          <option key={a.id} value={a.id} title={a.name}>{getAreaShortName(a.name)}</option>
        ))}
      </select>
      {saving && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-label="Guardando" />}
    </div>
  );
}
