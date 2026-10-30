"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { updateHRRecordAction } from "../actions/hr-actions";
import { HRFormFields } from "./hr-form-fields";

export function EditHRForm({ agent, areas, onComplete }: { agent: any; areas: { id: string; name: string }[]; onComplete: () => void }) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const res = await updateHRRecordAction(agent.id, new FormData(e.currentTarget));
    if (res.success) {
      toast.success("Legajo actualizado");
      onComplete();
    } else {
      toast.error(res.error || "No se pudo guardar el legajo.");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-2">
      <HRFormFields areas={areas} agent={agent} />
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
