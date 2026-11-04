"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createHRRecordAction } from "../actions/hr-actions";
import { HRFormFields } from "./hr-form-fields";

/** Nuevo agente, en su propia página: los campos en dos columnas y "Crear legajo" siempre a la vista abajo. */
export function CreateHRForm({ areas }: { areas: { id: string; name: string }[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const res = await createHRRecordAction(new FormData(e.currentTarget)).catch(() => null);
    setLoading(false);
    if (res?.success) {
      toast.success(res.data ? `Listo, se creó el legajo de ${res.data.firstName} ${res.data.lastName}.` : "Listo, se creó el legajo.");
      router.push("/admin/hr");
      router.refresh();
    } else {
      toast.error((res && !res.success && res.error) || "No se pudo crear el legajo. Probá de nuevo.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <HRFormFields areas={areas} layout="page" />
      <div className="sticky bottom-0 z-20 -mx-4 flex items-center justify-end gap-2 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Button type="button" variant="outline" asChild>
          <Link href="/admin/hr">Cancelar</Link>
        </Button>
        <Button type="submit" disabled={loading} className="gap-1.5">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Creando…" : "Crear legajo"}
        </Button>
      </div>
    </form>
  );
}
