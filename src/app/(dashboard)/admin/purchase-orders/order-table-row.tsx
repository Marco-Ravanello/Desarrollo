"use client";

import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { OrderStatusActions } from "./order-status-actions";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

export function OrderTableRow({ o }: { o: any }) {
  const router = useRouter();

  return (
    <TableRow
      key={o.id}
      className="cursor-pointer hover:bg-slate-50/50 transition-colors"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        router.push(`/admin/purchase-orders/${o.id}`);
      }}
    >
      <TableCell className="font-mono">
        <div className="flex flex-col">
          <span className="font-bold">{o.number}</span>
          {o.expediente && <span className="text-[10px] text-muted-foreground uppercase">Exp: {o.expediente}</span>}
        </div>
      </TableCell>
      <TableCell>
        {o.provider?.name || o.providerName || "No especificado"}
      </TableCell>
      <TableCell>${Number(o.amount).toLocaleString()}</TableCell>
      <TableCell>
        <Badge variant={o.status === 'APROBADA' ? 'default' : o.status === 'RECHAZADA' ? 'destructive' : 'secondary'}>
          {o.status.replace('_', ' ')}
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
