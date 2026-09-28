export const dynamic = "force-dynamic";

import { getPurchaseOrders } from "@/services/admin";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Filter, Search, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { TableFilter } from "@/components/ui/table-filter";
import { OrderTableRow } from "./order-table-row";
import { EmptyState } from "@/components/ui/empty-state";

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status;
  const query = params.q || "";
  const page = parseInt(params.page || "1") || 1;

  const result = await getPurchaseOrders({
    status,
    query,
    page,
    limit: 15,
  });

  const { orders, totalCount, totalPages, currentPage } = result;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">Órdenes de Compra</h2>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Módulo de Administración General • Seguimiento y adjudicación de compras públicas ({totalCount} registros).
          </p>
        </div>

        <Button asChild className="rounded-2xl h-11 px-5 font-bold text-xs uppercase tracking-wider bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <Link href="/admin/purchase-orders/new"><Plus className="mr-2 h-4 w-4"/> Nueva Orden</Link>
        </Button>
      </div>

      <Card className="p-4 bg-card border border-border/60 shadow-sm rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <form method="GET" className="flex items-center gap-2 flex-1 max-w-md">
          {status && <input type="hidden" name="status" value={status} />}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={query}
              placeholder="Buscar por N° orden, expediente, proveedor o CUIT..."
              className="pl-9 h-10 rounded-xl bg-background border-border/60 text-sm"
            />
          </div>
          <Button type="submit" variant="secondary" className="h-10 px-4 rounded-xl font-bold text-xs">
            Buscar
          </Button>
        </form>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Filter className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">Estado</span>
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
        </div>
      </Card>

      {orders.length > 0 ? (
        <div className="space-y-4">
          <Card className="bg-card border border-border/60 shadow-sm rounded-3xl overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="border-b border-border/60 hover:bg-transparent">
                    <TableHead className="font-black text-muted-foreground uppercase text-[10px] tracking-wider py-4 px-6">Número</TableHead>
                    <TableHead className="font-black text-muted-foreground uppercase text-[10px] tracking-wider py-4 px-6">Proveedor / CUIT</TableHead>
                    <TableHead className="font-black text-muted-foreground uppercase text-[10px] tracking-wider py-4 px-6">Monto Total</TableHead>
                    <TableHead className="font-black text-muted-foreground uppercase text-[10px] tracking-wider py-4 px-6">Estado</TableHead>
                    <TableHead className="font-black text-muted-foreground uppercase text-[10px] tracking-wider py-4 px-6 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/40">
                  {orders.map((o: any) => (
                    <OrderTableRow key={o.id} o={o} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 py-2">
              <p className="text-xs text-muted-foreground font-medium">
                Página <span className="font-bold text-foreground">{currentPage}</span> de <span className="font-bold text-foreground">{totalPages}</span> ({totalCount} órdenes)
              </p>
              <div className="flex items-center gap-2">
                {currentPage > 1 ? (
                  <Button asChild variant="outline" size="sm" className="h-8 rounded-xl px-3 text-xs">
                    <Link href={`/admin/purchase-orders?${new URLSearchParams({ ...(status ? { status } : {}), ...(query ? { q: query } : {}), page: String(currentPage - 1) })}`}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled className="h-8 rounded-xl px-3 text-xs">
                    <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                  </Button>
                )}

                {currentPage < totalPages ? (
                  <Button asChild variant="outline" size="sm" className="h-8 rounded-xl px-3 text-xs">
                    <Link href={`/admin/purchase-orders?${new URLSearchParams({ ...(status ? { status } : {}), ...(query ? { q: query } : {}), page: String(currentPage + 1) })}`}>
                      Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled className="h-8 rounded-xl px-3 text-xs">
                    Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          type="orders"
          title={status || query ? "No se encontraron órdenes de compra" : undefined}
          description={status || query ? "Intente ajustar los términos de búsqueda o los filtros activos." : undefined}
          actionLabel={status || query ? "Limpiar Filtros" : "Crear Primera Orden"}
          actionHref={status || query ? "/admin/purchase-orders" : "/admin/purchase-orders/new"}
        />
      )}
    </div>
  );
}
