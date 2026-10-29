"use client";

import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { OrderStatusActions } from "./order-status-actions";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getOrderStatusConfig } from "@/lib/status-styles";
import { getAreaShortName } from "@/lib/area-theme";
import { formatPesos } from "@/lib/formato";

// En la lista solo van los pasos para adelante. Rechazar, cancelar o devolver se hace desde la orden, viendo el detalle.
const LIST_ACTIONS = new Set(["PENDIENTE_APROBACION", "APROBADA"]);

export type OrderRow = {
  id: string;
  number: string;
  expediente: string | null;
  status: string;
  amount: number;
  provider: string | null;
  cuit: string | null;
  area: string | null;
};

export function OrderTableRow({ o, allowed }: { o: OrderRow; allowed: string[] }) {
  const router = useRouter();
  const statusCfg = getOrderStatusConfig(o.status);
  const forward = allowed.filter((s) => LIST_ACTIONS.has(s));

  return (
    <TableRow
      className="cursor-pointer"
      onClick={(e) => {
        // Los clics en botones, y en la ventana de confirmar (que React hace llegar hasta acá), no abren la orden.
        if ((e.target as HTMLElement).closest("button") || !e.currentTarget.contains(e.target as Node)) return;
        router.push(`/admin/purchase-orders/${o.id}`);
      }}
    >
      <TableCell className="px-4 py-3">
        <p className="font-semibold text-foreground">{o.number}</p>
        {o.expediente && <p className="text-xs text-muted-foreground">Expediente {o.expediente}</p>}
      </TableCell>
      <TableCell className="px-4 py-3">
        <p className="font-medium text-foreground">{o.provider || "Sin proveedor"}</p>
        {o.cuit && <p className="text-xs text-muted-foreground">CUIT {o.cuit}</p>}
      </TableCell>
      <TableCell className="px-4 py-3 text-sm text-muted-foreground">{o.area ? getAreaShortName(o.area) : "Sin área"}</TableCell>
      <TableCell className="px-4 py-3 font-semibold tabular-nums text-foreground">{formatPesos(o.amount)}</TableCell>
      <TableCell className="px-4 py-3">
        <Badge variant="outline" className={statusCfg.badgeClass}>
          {statusCfg.label}
        </Badge>
      </TableCell>
      {/* En el celular la fila es una tarjeta: sin pasos para hacer, no se muestra el renglón vacío. */}
      <TableCell className={forward.length > 0 ? "px-4 py-3" : "hidden px-4 py-3 md:table-cell"}>
        <div className="flex items-center justify-end gap-2">
          <OrderStatusActions orderId={o.id} currentStatus={o.status} allowed={forward} />
          <ChevronRight className="hidden h-4 w-4 text-muted-foreground md:block" aria-hidden />
        </div>
      </TableCell>
    </TableRow>
  );
}
