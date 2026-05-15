export const dynamic = "force-dynamic";
import { getPurchaseOrders } from "@/services/admin";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";
import Link from "next/link";

export default async function PurchaseOrdersPage() {
  const orders = await getPurchaseOrders();
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Órdenes de Compra</h2>
          <p className="text-slate-500">Módulo de Administración General - Seguimiento de compras.</p>
        </div>
        <Button asChild><Link href="/admin/purchase-orders/new"><Plus className="mr-2 h-4 w-4"/> Nueva Orden</Link></Button>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map(o => (
              <TableRow key={o.id}>
                <TableCell className="font-mono">{o.number}</TableCell>
                <TableCell>{o.provider.name}</TableCell>
                <TableCell>${Number(o.amount).toLocaleString()}</TableCell>
                <TableCell><Badge>{o.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
