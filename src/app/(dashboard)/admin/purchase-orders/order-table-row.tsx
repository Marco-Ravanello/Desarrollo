"use client";

import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { OrderStatusActions } from "./order-status-actions";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { getOrderStatusConfig } from "@/lib/status-styles";

export function OrderTableRow({ o }: { o: any }) {
  const router = useRouter();
  const statusCfg = getOrderStatusConfig(o.status);

  return (
    <TableRow
      key={o.id}
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        router.push(`/admin/purchase-orders/${o.id}`);
      }}
    >
      <TableCell className="font-mono">
        <div className="flex flex-col">
          <span className="font-bold text-foreground">{o.number}</span>
          {o.expediente && <span className="text-[10px] text-muted-foreground uppercase">Exp: {o.expediente}</span>}
        </div>
      </TableCell>
      <TableCell className="font-medium">
        <div className="flex flex-col">
          <span>{o.provider?.name || o.providerName || "No especificado"}</span>
          {(o.provider?.cuit || o.providerCuit) && (
            <span className="text-[10px] text-muted-foreground font-mono">CUIT: {o.provider?.cuit || o.providerCuit}</span>
          )}
        </div>
      </TableCell>
      <TableCell className="font-bold text-foreground">
        ${Number(o.amount).toLocaleString('es-AR')}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={statusCfg.badgeClass}>
          {statusCfg.label}
        </Badge>
      </TableCell>
      <TableCell className="text-right flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => router.push(`/admin/purchase-orders/${o.id}`)}>
          <Eye className="h-4 w-4" />
        </Button>
        <OrderStatusActions orderId={o.id} currentStatus={o.status} />
      </TableCell>
    </TableRow>
  );
}
