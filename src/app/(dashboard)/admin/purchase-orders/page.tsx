export const dynamic = "force-dynamic";
import { getPurchaseOrders } from "@/services/admin";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Plus, Filter } from "lucide-react";
import Link from "next/link";
import { OrderStatusActions } from "./order-status-actions";
import { TableFilter } from "@/components/ui/table-filter";

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const orders = await getPurchaseOrders(status) as any[];
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Órdenes de Compra</h2>
          <p className="text-slate-500">Módulo de Administración General - Seguimiento de compras.</p>
        </div>
        <Button asChild><Link href="/admin/purchase-orders/new"><Plus className="mr-2 h-4 w-4"/> Nueva Orden</Link></Button>
      </div>

      <Card className="p-4 bg-slate-50/50 flex items-center gap-4">
        <div className="flex items-center gap-2 text-slate-500 mr-2">
          <Filter className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Filtros</span>
        </div>
        <TableFilter
          label="Estado"
          param="status"
          options={[
            { label: "Pendiente Aprobación", value: "PENDIENTE_APROBACION" },
            { label: "Aprobada", value: "APROBADA" },
            { label: "Rechazada", value: "RECHAZADA" },
          ]}
        />
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map(o => (
              <TableRow key={o.id}>
                <TableCell className="font-mono">
                    <div className="flex flex-col">
                        <span className="font-bold">{o.number}</span>
                        {o.expediente && <span className="text-[10px] text-muted-foreground uppercase">Exp: {o.expediente}</span>}
                    </div>
                </TableCell>
                <TableCell>{o.provider.name}</TableCell>
                <TableCell>${Number(o.amount).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant={o.status === 'APROBADA' ? 'default' : o.status === 'RECHAZADA' ? 'destructive' : 'secondary'}>
                    {o.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <OrderStatusActions orderId={o.id} currentStatus={o.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
