export const dynamic = "force-dynamic";
import { getPurchaseOrders } from "@/services/admin";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Plus, Filter } from "lucide-react";
import Link from "next/link";
import { TableFilter } from "@/components/ui/table-filter";
import { OrderTableRow } from "./order-table-row";

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

      <Card className="p-4 bg-white/75 dark:bg-card/75 backdrop-blur-md border border-border/40 shadow-municipal flex items-center gap-4">
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

      <Card className="bg-white/75 dark:bg-card/75 backdrop-blur-md border border-border/40 shadow-municipal">
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
              <OrderTableRow key={o.id} o={o} />
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
