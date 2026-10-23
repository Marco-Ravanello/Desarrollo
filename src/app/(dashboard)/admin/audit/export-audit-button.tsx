"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportToExcel } from "@/lib/export-utils";
import { exportAuditAction } from "./actions";

export function ExportAuditButton({ params, disabled }: { params: Record<string, string | undefined>; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const onClick = async () => {
    setLoading(true);
    const res = await exportAuditAction(params);
    setLoading(false);
    if (!res.success) return toast.error(res.error);
    if (res.rows.length === 0) return toast.info("No hay movimientos para descargar con esos filtros.");
    exportToExcel(res.rows, "auditoria", "Auditoría");
  };
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={disabled || loading} className="h-9 rounded-xl gap-1.5">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Descargar Excel
    </Button>
  );
}
