"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { closeCaseAction } from "../actions/close-case";
import { CheckCircle2 } from "lucide-react";

export function CloseCaseButton({ caseId }: { caseId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClose() {
    if (!confirm("¿Está seguro de que desea cerrar este caso?")) return;

    setLoading(true);
    const res = await closeCaseAction(caseId);
    if (res.success) {
      toast.success("Caso cerrado correctamente");
    } else {
      toast.error(res.error);
    }
    setLoading(false);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClose}
      disabled={loading}
      className="h-7 text-xs border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700"
    >
      <CheckCircle2 className="h-3 w-3 mr-1" /> Cerrar
    </Button>
  );
}
