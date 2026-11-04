"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createHRRecordAction, updateHRRecordAction } from "../actions/hr-actions";
import { HRFormFields } from "./hr-form-fields";

/**
 * Nuevo agente y Editar legajo, cada uno en su página: los campos en dos columnas y el botón de guardar
 * siempre a la vista abajo. Sin `agent` crea el legajo; con `agent` guarda los cambios y vuelve a su legajo.
 */
export function HRRecordForm({ areas, agent }: { areas: { id: string; name: string }[]; agent?: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const editing = Boolean(agent?.id);
  const back = editing ? `/admin/hr/${agent.id}` : "/admin/hr";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await (editing ? updateHRRecordAction(agent.id, form) : createHRRecordAction(form)).catch(() => null);
    setLoading(false);
    if (res?.success) {
      const name = res.data ? `${res.data.firstName} ${res.data.lastName}` : "";
      toast.success(editing ? "Se guardaron los cambios del legajo." : name ? `Se creó el legajo de ${name}.` : "Se creó el legajo.");
      router.push(editing ? back : res.data ? `/admin/hr/${res.data.id}` : "/admin/hr");
      router.refresh();
    } else {
      toast.error((res && !res.success && res.error) || "No se pudo guardar el legajo. Probá de nuevo.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <HRFormFields areas={areas} agent={agent} />
      <div className="sticky bottom-0 z-20 -mx-4 flex items-center justify-end gap-2 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Button type="button" variant="outline" asChild>
          <Link href={back}>Cancelar</Link>
        </Button>
        <Button type="submit" disabled={loading} className="gap-1.5">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Guardando…" : editing ? "Guardar cambios" : "Crear legajo"}
        </Button>
      </div>
    </form>
  );
}
