"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createHRRecordAction } from "../actions/hr-actions";
import { HRFormFields } from "./hr-form-fields";

export function CreateHRForm({ areas }: { areas: { id: string; name: string }[] }) {
  const [loading, setLoading] = useState(false);
  // Cambiar la clave vacía los campos después de guardar.
  const [formKey, setFormKey] = useState(0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const res = await createHRRecordAction(new FormData(e.currentTarget));
    if (res.success) {
      toast.success("Legajo creado");
      setFormKey((k) => k + 1);
    } else {
      toast.error(res.error || "No se pudo crear el legajo.");
    }
    setLoading(false);
  }

  return (
    <form key={formKey} onSubmit={handleSubmit} className="space-y-6 pb-2">
      <HRFormFields areas={areas} />
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Creando legajo…" : "Crear legajo"}
      </Button>
    </form>
  );
}
