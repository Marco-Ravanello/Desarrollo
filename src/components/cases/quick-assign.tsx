"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { assignCaseAction } from "@/app/(dashboard)/cases/actions/case-actions";
import { plural } from "@/lib/formato";

type Person = { id: string; name: string; open: number };

const openLabel = (n: number) => (n === 0 ? "ningún expediente" : plural(n, "abierto"));

/** Asignar un expediente sin profesional: un toque para quien tiene menos carga, o elegir a otra persona. */
export function QuickAssign({ caseId, caseLabel, suggested, people }: { caseId: string; caseLabel: string; suggested: Person | null; people: Person[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const assign = async (person: Person) => {
    setSaving(true);
    const res = await assignCaseAction(caseId, person.id).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error((res as { error?: string } | null)?.error || "No se pudo asignar. Probá de nuevo.");
    toast.success(`${person.name} quedó a cargo. Le llega un aviso.`);
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {suggested && (
        <Button size="sm" disabled={saving} onClick={() => assign(suggested)} className="h-8 gap-1.5 rounded-lg text-xs font-bold">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
          Asignar a {suggested.name}
        </Button>
      )}
      {people.length > 0 && (
        <select
          aria-label={`Elegir quién queda a cargo de ${caseLabel}`}
          disabled={saving}
          value=""
          onChange={(e) => {
            const person = people.find((p) => p.id === e.target.value);
            if (person) assign(person);
          }}
          className="h-8 max-w-[14rem] rounded-lg border border-border/60 bg-background px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">{suggested ? "Otra persona…" : "Elegir a quién…"}</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {openLabel(p.open)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
