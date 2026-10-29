export const dynamic = "force-dynamic";
import { getPurchaseOrderById, getOrderAuditLogs } from "@/services/admin";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, PackageCheck, Truck, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatRow } from "@/components/ui/mobile-list";
import Link from "next/link";
import { OrderItemsTable } from "./order-items-table";
import { OrderTimeline } from "./order-timeline";
import { OrderAuditTimeline } from "./order-audit-timeline";
import { OrderStatusActions } from "../order-status-actions";
import { PrintOrderButton } from "./print-order-button";
import { auth } from "@/auth";
import { allowedOrderTransitions, canEditPurchaseOrders } from "@/lib/purchase-orders";
import { getOrderStatusConfig } from "@/lib/status-styles";
import { formatFechaCalendario, formatFechaHora } from "@/lib/fechas";
import { purchaseOrderTitle } from "@/lib/page-titles";
import { formatPercent, formatPesos, plural } from "@/lib/formato";

export const generateMetadata = purchaseOrderTitle;

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, auditLogs, session] = await Promise.all([getPurchaseOrderById(id), getOrderAuditLogs(id), auth()]);
  const role = session?.user?.role;

  if (!order) {
    notFound();
  }

  const executedAmount = order.items.reduce((acc, item) => acc + Number(item.fulfilledQuantity) * Number(item.unitPrice), 0);
  const totalAmount = Number(order.amount);
  const globalProgress = totalAmount > 0 ? (executedAmount / totalAmount) * 100 : 0;

  // Qué falta y quién lo tiene que hacer.
  const nextStep =
    order.status === "BORRADOR"
      ? "enviarla a firma"
      : order.status === "PENDIENTE_APROBACION"
        ? "que la apruebe Administración General"
        : order.status === "APROBADA"
          ? "registrar las entregas del proveedor"
          : order.status === "RECHAZADA"
            ? "corregirla y volver a enviarla"
            : order.status === "CUMPLIDA"
              ? "nada: se entregó todo"
              : "nada: está cancelada";

  const statusCfg = getOrderStatusConfig(order.status);
  const allowed = allowedOrderTransitions(role, order.status);
  const createdBy = auditLogs.find((l: any) => l.action === "CREATE")?.user?.name;

  const provider = order.provider;
  const providerName = provider?.name || order.providerName || "Sin proveedor";
  const providerCuit = provider?.cuit || order.providerCuit;
  const datos: { label: string; value: React.ReactNode }[] = [
    { label: "Expediente", value: order.expediente || "Sin cargar" },
    { label: "Área", value: order.area?.name || "Sin área" },
    { label: "Fecha de entrega", value: order.deliveryDate ? formatFechaCalendario(order.deliveryDate) : "Sin fecha" },
    { label: "Lugar de entrega", value: order.deliveryPlace || "Sin cargar" },
    { label: "Condiciones de pago", value: order.paymentTerms || "Sin cargar" },
    { label: "Cargada", value: `${formatFechaHora(order.createdAt)}${createdBy ? ` por ${createdBy}` : ""}` },
  ];

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title={<>Orden {order.number}</>}
        badge={
          <Badge variant="outline" className={statusCfg.badgeClass}>
            {statusCfg.label}
          </Badge>
        }
        description={
          <>
            Falta: <span className="font-semibold text-foreground">{nextStep}</span>
          </>
        }
        icon={Briefcase}
        actions={
          <>
            <OrderStatusActions orderId={order.id} currentStatus={order.status} allowed={allowed} />
            <PrintOrderButton />
          </>
        }
      />

      <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
        <CardContent className="p-0">
          <OrderTimeline currentStatus={order.status} deliveredPct={globalProgress} />
        </CardContent>
      </Card>

      <StatRow className="lg:grid-cols-3">
        <StatCard
          label="Monto de la orden"
          value={formatPesos(totalAmount)}
          hint={plural(order.items.length, "ítem", "ítems")}
          icon={Wallet}
          tone="blue"
        />
        <StatCard
          label="Recibido"
          value={formatPesos(executedAmount)}
          hint={`${formatPercent(globalProgress, 0)} de lo pedido`}
          icon={PackageCheck}
          tone="green"
        />
        <StatCard
          label="Falta entregar"
          value={formatPesos(totalAmount - executedAmount)}
          hint={totalAmount - executedAmount > 0 ? "Todavía no llegó" : "No falta nada"}
          icon={Truck}
          tone="orange"
        />
      </StatRow>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Datos de la orden</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {datos.map((d) => (
                  <div key={d.label}>
                    <dt className="text-xs text-muted-foreground">{d.label}</dt>
                    <dd className="text-sm font-medium text-foreground">{d.value}</dd>
                  </div>
                ))}
              </dl>
              <div>
                <p className="text-xs text-muted-foreground">Para qué es la compra</p>
                <p className="whitespace-pre-line text-sm text-foreground">{order.description || "Sin descripción."}</p>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Items Table */}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Proveedor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                {provider ? (
                  <Link
                    href={`/admin/providers/${provider.id}`}
                    className="font-semibold text-foreground hover:text-primary hover:underline"
                  >
                    {providerName}
                  </Link>
                ) : (
                  <p className="font-semibold text-foreground">{providerName}</p>
                )}
                <p className="text-sm text-muted-foreground">{providerCuit ? `CUIT ${providerCuit}` : "Sin CUIT"}</p>
              </div>
              {provider && (
                <>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Banco</dt>
                      <dd className="font-medium text-foreground">{provider.bank || "Sin cargar"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Órdenes</dt>
                      <dd className="font-medium tabular-nums text-foreground">{provider._count?.orders ?? 0}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-muted-foreground">CBU</dt>
                      <dd className="break-all font-medium text-foreground">{provider.cbu || "Sin cargar"}</dd>
                    </div>
                  </dl>
                  {provider.orders.filter((o) => o.id !== order.id).length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Otras órdenes</p>
                      <ul className="space-y-1">
                        {provider.orders
                          .filter((o) => o.id !== order.id)
                          .slice(0, 3)
                          .map((o) => (
                            <li key={o.id}>
                              <Link
                                href={`/admin/purchase-orders/${o.id}`}
                                className="flex items-center justify-between gap-2 text-sm hover:text-primary"
                              >
                                <span className="font-medium">{o.number}</span>
                                <span className="tabular-nums text-muted-foreground">{formatPesos(Number(o.amount))}</span>
                              </Link>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Actividad</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderAuditTimeline logs={auditLogs} />
            </CardContent>
          </Card>
        </div>
      </div>

      <OrderItemsTable
        orderId={order.id}
        orderStatus={order.status}
        canRecord={canEditPurchaseOrders(role)}
        items={order.items.map((i) => ({
          ...i,
          quantity: i.quantity.toString(),
          fulfilledQuantity: i.fulfilledQuantity.toString(),
          unitPrice: i.unitPrice.toString(),
          totalPrice: i.totalPrice.toString(),
        }))}
      />
    </div>
  );
}
