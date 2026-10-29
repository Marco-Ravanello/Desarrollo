export const dynamic = "force-dynamic";

import { getPurchaseOrders, getPurchaseOrderStatusCounts } from "@/services/admin";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, ChevronLeft, ChevronRight, Briefcase, PenLine, PackageCheck, FileClock, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { OrderTableRow } from "./order-table-row";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { StatRow } from "@/components/ui/mobile-list";
import { MobileFilters } from "@/components/ui/mobile-filters";
import { auth } from "@/auth";
import { allowedOrderTransitions, canEditPurchaseOrders } from "@/lib/purchase-orders";
import { plural } from "@/lib/formato";

export const metadata = { title: "Órdenes de compra" };

const STATUS_OPTIONS = [
  { label: "Borrador", value: "BORRADOR" },
  { label: "Pendiente de aprobación", value: "PENDIENTE_APROBACION" },
  { label: "Aprobada", value: "APROBADA" },
  { label: "Cumplida / entregada", value: "CUMPLIDA" },
  { label: "Rechazada", value: "RECHAZADA" },
  { label: "Cancelada", value: "CANCELADA" },
];

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const [params, session] = await Promise.all([searchParams, auth()]);
  const role = session?.user?.role;
  const status = STATUS_OPTIONS.some((o) => o.value === params.status) ? params.status : undefined;
  const query = params.q || "";
  const page = parseInt(params.page || "1") || 1;

  const [result, counts] = await Promise.all([getPurchaseOrders({ status, query, page, limit: 15 }), getPurchaseOrderStatusCounts()]);

  const { orders, totalCount, totalPages, currentPage } = result;
  const allCount = Object.values(counts).reduce((t, n) => t + n, 0);
  const statLink = (s: string) => (status === s ? "/admin/purchase-orders" : `/admin/purchase-orders?status=${s}`);
  const statClass = (s: string) => (status === s ? "ring-2 ring-primary" : "transition-colors hover:border-primary/40");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Órdenes de compra"
        description={`Las compras del área, desde el borrador hasta la entrega. ${plural(allCount, "orden", "órdenes")} en total.`}
        icon={Briefcase}
        actions={
          canEditPurchaseOrders(role) ? (
            <Button asChild>
              <Link href="/admin/purchase-orders/new">
                <Plus className="mr-2 h-4 w-4" /> Nueva orden
              </Link>
            </Button>
          ) : undefined
        }
      />

      {allCount > 0 && (
        <StatRow>
          <Link href={statLink("PENDIENTE_APROBACION")} className="rounded-2xl">
            <StatCard
              className={statClass("PENDIENTE_APROBACION")}
              label="Pendientes de aprobación"
              value={counts.PENDIENTE_APROBACION ?? 0}
              hint="Para aprobar o rechazar"
              icon={PenLine}
              tone="orange"
            />
          </Link>
          <Link href={statLink("APROBADA")} className="rounded-2xl">
            <StatCard
              className={statClass("APROBADA")}
              label="Aprobadas"
              value={counts.APROBADA ?? 0}
              hint="Falta la entrega"
              icon={PackageCheck}
              tone="blue"
            />
          </Link>
          <Link href={statLink("BORRADOR")} className="rounded-2xl">
            <StatCard
              className={statClass("BORRADOR")}
              label="Borradores"
              value={counts.BORRADOR ?? 0}
              hint="Sin enviar a firma"
              icon={FileClock}
              tone="slate"
            />
          </Link>
          <Link href={statLink("CUMPLIDA")} className="rounded-2xl">
            <StatCard
              className={statClass("CUMPLIDA")}
              label="Cumplidas"
              value={counts.CUMPLIDA ?? 0}
              hint="Ya entregadas"
              icon={CheckCircle2}
              tone="green"
            />
          </Link>
        </StatRow>
      )}

      <Card className="rounded-2xl border-border/60 p-4 shadow-sm">
        <form method="GET" className="grid grid-cols-1 items-center gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={query}
              aria-label="Buscar órdenes"
              placeholder="Buscar por número, expediente, proveedor o CUIT"
              className="h-10 rounded-xl border-border/60 bg-muted/30 pl-9 text-xs"
            />
          </div>
          <MobileFilters active={status ? 1 : 0}>
            <div>
              <select
                name="status"
                aria-label="Estado"
                defaultValue={status || ""}
                className="h-10 w-full rounded-xl border border-border/60 bg-muted/30 px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Todos los estados</option>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </MobileFilters>
          <Button type="submit" size="sm" className="h-10 w-full rounded-xl text-xs font-bold">
            Buscar
          </Button>
        </form>
      </Card>

      {orders.length > 0 ? (
        <div className="space-y-4">
          <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4 text-xs font-semibold">Orden</TableHead>
                  <TableHead className="px-4 text-xs font-semibold">Proveedor</TableHead>
                  <TableHead className="px-4 text-xs font-semibold">Área</TableHead>
                  <TableHead className="px-4 text-xs font-semibold">Monto</TableHead>
                  <TableHead className="px-4 text-xs font-semibold">Estado</TableHead>
                  <TableHead className="px-4 text-xs font-semibold">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o: any) => (
                  <OrderTableRow
                    key={o.id}
                    o={{
                      id: o.id,
                      number: o.number,
                      expediente: o.expediente,
                      status: o.status,
                      amount: Number(o.amount),
                      provider: o.provider?.name || o.providerName || null,
                      cuit: o.provider?.cuit || o.providerCuit || null,
                      area: o.area?.name ?? null,
                    }}
                    allowed={allowedOrderTransitions(role, o.status)}
                  />
                ))}
              </TableBody>
            </Table>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 py-2">
              <p className="text-xs text-muted-foreground font-medium">
                Página <span className="font-bold text-foreground">{currentPage}</span> de{" "}
                <span className="font-bold text-foreground">{totalPages}</span> ({plural(totalCount, "orden", "órdenes")})
              </p>
              <div className="flex items-center gap-2">
                {currentPage > 1 ? (
                  <Button asChild variant="outline" size="sm" className="h-8 rounded-xl px-3 text-xs">
                    <Link
                      href={`/admin/purchase-orders?${new URLSearchParams({ ...(status ? { status } : {}), ...(query ? { q: query } : {}), page: String(currentPage - 1) })}`}
                    >
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
                    <Link
                      href={`/admin/purchase-orders?${new URLSearchParams({ ...(status ? { status } : {}), ...(query ? { q: query } : {}), page: String(currentPage + 1) })}`}
                    >
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
          description={status || query ? "Probá con otras palabras o sacá algún filtro." : undefined}
          actionLabel={status || query ? "Quitar filtros" : "Crear la primera orden"}
          actionHref={status || query ? "/admin/purchase-orders" : "/admin/purchase-orders/new"}
        />
      )}
    </div>
  );
}
