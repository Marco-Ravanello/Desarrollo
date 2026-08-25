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
import { EmptyState } from "@/components/ui/empty-state";

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const orders = await getPurchaseOrders(status) as any[];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">Órdenes de Compra</h2>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Módulo de Administración General • Seguimiento y adjudicación de compras públicas.
          </p>
        </div>

        <Button asChild className="rounded-2xl h-11 px-5 font-bold text-xs uppercase tracking-wider bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <Link href="/admin/purchase-orders/new"><Plus className="mr-2 h-4 w-4"/> Nueva Orden</Link>
        </Button>
      </div>

      <Card className="p-4 bg-card border border-border/60 shadow-sm rounded-2xl flex items-center gap-4">
        <div className="flex items-center gap-2 text-muted-foreground mr-2">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">Filtros</span>
        </div>
        <TableFilter
          label="Estado"
          param="status"
          options={[
            { label: "Pendiente Aprobación", value: "PENDIENTE_APROBACION" },
            { label: "Aprobada", value: "APROBADA" },
            { label: "Cumplida", value: "CUMPLIDA" },
            { label: "Rechazada", value: "RECHAZADA" },
          ]}
        />
      </Card>

      {orders.length > 0 ? (
        <Card className="bg-card border border-border/60 shadow-sm rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-b border-border/60 hover:bg-transparent">
                  <TableHead className="font-black text-muted-foreground uppercase text-[10px] tracking-wider py-4 px-6">Número</TableHead>
                  <TableHead className="font-black text-muted-foreground uppercase text-[10px] tracking-wider py-4 px-6">Proveedor</TableHead>
                  <TableHead className="font-black text-muted-foreground uppercase text-[10px] tracking-wider py-4 px-6">Monto Total</TableHead>
                  <TableHead className="font-black text-muted-foreground uppercase text-[10px] tracking-wider py-4 px-6">Estado</TableHead>
                  <TableHead className="font-black text-muted-foreground uppercase text-[10px] tracking-wider py-4 px-6 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/40">
                {orders.map(o => (
                  <OrderTableRow key={o.id} o={o} />
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        <EmptyState
          type="orders"
          title={status ? `No hay órdenes en estado "${status.replace('_', ' ')}"` : undefined}
          description={status ? "Intente seleccionar otro filtro de estado o limpie los filtros activos." : undefined}
          actionLabel={status ? "Ver Todas las Órdenes" : "Crear Primera Orden"}
          actionHref={status ? "/admin/purchase-orders" : "/admin/purchase-orders/new"}
        />
      )}
    </div>
  );
}
