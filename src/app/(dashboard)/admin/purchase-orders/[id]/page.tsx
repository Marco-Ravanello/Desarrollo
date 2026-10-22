export const dynamic = "force-dynamic";
import { getPurchaseOrderById, getOrderAuditLogs } from "@/services/admin";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft, Calendar, MapPin, CreditCard, FileText,
  User, TrendingUp, Wallet, CheckCircle2, History,
  Paperclip, Building2, Info, DollarSign, Briefcase
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyMessage } from "@/components/ui/empty-message";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { OrderItemsTable } from "./order-items-table";
import { Progress } from "@/components/ui/progress";
import { OrderTimeline } from "./order-timeline";
import { OrderAuditTimeline } from "./order-audit-timeline";
import { OrderStatusActions } from "../order-status-actions";
import { PrintOrderButton } from "./print-order-button";
import { auth } from "@/auth";
import { allowedOrderTransitions, canEditPurchaseOrders } from "@/lib/purchase-orders";
import { getOrderStatusConfig } from "@/lib/status-styles";

export const metadata = { title: "Orden de compra" };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, auditLogs, session] = await Promise.all([getPurchaseOrderById(id), getOrderAuditLogs(id), auth()]);
  const role = session?.user?.role;

  if (!order) {
    notFound();
  }

  const executedAmount = order.items.reduce((acc, item) => acc + (Number(item.fulfilledQuantity) * Number(item.unitPrice)), 0);
  const totalAmount = Number(order.amount);
  const globalProgress = totalAmount > 0 ? (executedAmount / totalAmount) * 100 : 0;

  // Qué falta y quién lo tiene que hacer.
  const nextStep =
    order.status === 'BORRADOR' ? 'enviarla a firma' :
    order.status === 'PENDIENTE_APROBACION' ? 'que la apruebe Administración General' :
    order.status === 'APROBADA' ? 'registrar las entregas del proveedor' :
    order.status === 'RECHAZADA' ? 'corregirla y volver a enviarla' :
    order.status === 'CUMPLIDA' ? 'nada: se entregó todo' :
    'nada: está cancelada';

  const statusCfg = getOrderStatusConfig(order.status);
  const allowed = allowedOrderTransitions(role, order.status);
  const createdBy = auditLogs.find((l: any) => l.action === "CREATE")?.user?.name;

  return (
    <div className="space-y-6 pb-20">
      {/* Dynamic Header */}
      <PageHeader
        title={<>Orden #{order.number}</>}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1"><User className="h-3 w-3" /> Falta: <b className="text-foreground">{nextStep}</b></span>
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(new Date(order.createdAt), "dd/MM/yyyy HH:mm")}</span>
          </span>
        }
        icon={Briefcase}
        actions={
          <>
            <Badge variant="outline" className={`text-xs px-3 py-0.5 rounded-full font-bold ${statusCfg.badgeClass}`}>
              {statusCfg.label}
            </Badge>
            <Button variant="outline" size="icon" asChild className="rounded-full h-10 w-10 shadow-xs border-border/60">
              <Link href="/admin/purchase-orders" aria-label="Volver a órdenes de compra">
                <ChevronLeft className="h-5 w-5" />
              </Link>
            </Button>
            <OrderStatusActions orderId={order.id} currentStatus={order.status} allowed={allowed} />
            <PrintOrderButton />
          </>
        }
      />

      {/* Main Process Timeline */}
      <Card className="border border-border/60 shadow-xs bg-card overflow-hidden rounded-2xl">
         <CardContent className="p-0">
            <OrderTimeline currentStatus={order.status} deliveredPct={globalProgress} />
         </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">

          {/* STAR KPI METRICS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-card text-card-foreground p-6 rounded-2xl border border-border/60 shadow-xs flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-700 dark:text-blue-400">
                        <Wallet className="h-5 w-5" />
                    </div>
                    <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-none font-bold text-xs">Presupuesto</Badge>
                </div>
                <span className="text-xs font-bold text-muted-foreground mb-1">Monto total adjudicado</span>
                <p className="text-2xl font-bold text-foreground">${totalAmount.toLocaleString("es-AR")}</p>
                <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground">Moneda</span>
                    <span className="text-xs font-bold text-foreground">ARS</span>
                </div>
              </div>

              <div className="bg-card text-card-foreground p-6 rounded-2xl border border-border/60 shadow-xs flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                        <TrendingUp className="h-5 w-5" />
                    </div>
                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-none font-bold text-xs">Ejecutado</Badge>
                </div>
                <span className="text-xs font-bold text-muted-foreground mb-1">Total recibido</span>
                <p className="text-2xl font-bold text-foreground">${executedAmount.toLocaleString("es-AR")}</p>
                <div className="mt-4 space-y-1">
                    <Progress value={globalProgress} className="h-1.5 [&>div]:bg-emerald-500 bg-emerald-500/10" />
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold text-right">{Math.round(globalProgress)}% completado</p>
                </div>
              </div>

              <div className="bg-card text-card-foreground p-6 rounded-2xl border border-border/60 shadow-xs flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-700 dark:text-orange-400">
                        <DollarSign className="h-5 w-5" />
                    </div>
                    <Badge variant="secondary" className="bg-orange-500/10 text-orange-700 dark:text-orange-400 border-none font-bold text-xs">Falta entregar</Badge>
                </div>
                <span className="text-xs font-bold text-muted-foreground mb-1">Saldo pendiente de entrega</span>
                <p className="text-2xl font-bold text-foreground">${(totalAmount - executedAmount).toLocaleString("es-AR")}</p>
                <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground">Entregado</span>
                    <span className="text-xs font-bold text-foreground">{Math.round(globalProgress)} %</span>
                </div>
              </div>
          </div>

          {/* Technical Info */}
          <Card className="rounded-2xl border border-border/60 shadow-xs bg-card text-card-foreground">
            <CardHeader className="pb-2 border-b border-border/40">
              <CardTitle className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                <FileText className="h-4 w-4" />
                Especificaciones técnicas
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-2xl border border-border/40">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center shadow-xs">
                                    <Info className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-muted-foreground">N° expediente / suministro</p>
                                    <p className="text-sm font-bold text-foreground">{order.expediente || "SIN DATO"}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3">
                            <div className="w-8 h-8 rounded-full bg-muted/40 flex items-center justify-center">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-muted-foreground">Lugar de entrega</p>
                                <p className="text-sm font-bold text-foreground">{order.deliveryPlace || "No especificado"}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3">
                            <div className="w-8 h-8 rounded-full bg-muted/40 flex items-center justify-center">
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-muted-foreground">Condiciones de pago</p>
                                <p className="text-sm font-bold text-foreground">{order.paymentTerms || "No especificadas"}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                         <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground font-bold">Descripción / motivo de la adquisición</Label>
                            <div className="bg-muted/30 p-4 rounded-2xl text-foreground text-xs border border-border/40 leading-relaxed min-h-[100px]">
                                {order.description || "Sin descripción adicional detallada para esta orden de compra."}
                            </div>
                         </div>
                    </div>
                </div>
            </CardContent>
          </Card>

          {/* Detailed Items Table */}
          <OrderItemsTable
            orderId={order.id}
            orderStatus={order.status}
            canRecord={canEditPurchaseOrders(role)}
            items={order.items.map(i => ({
              ...i,
              quantity: i.quantity.toString(),
              fulfilledQuantity: i.fulfilledQuantity.toString(),
              unitPrice: i.unitPrice.toString(),
              totalPrice: i.totalPrice.toString()
            }))}
          />

          {/* Attachments Section */}
          <Card className="rounded-2xl border border-border/60 shadow-xs bg-card text-card-foreground overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/40">
              <CardTitle className="text-xs font-bold text-muted-foreground flex items-center gap-2">
                <Paperclip className="h-4 w-4" /> Documentación adjunta
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <EmptyMessage
                icon={FileText}
                compact
                title="Esta orden todavía no tiene documentos"
                description="Las facturas, remitos y comprobantes que se adjunten aparecen acá."
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Provider Card */}
          <Card className="rounded-2xl border border-border/60 shadow-xs bg-card text-card-foreground overflow-hidden">
            <CardHeader className="pb-2 border-b border-border/40 bg-muted/20">
              <CardTitle className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                <Building2 className="h-4 w-4" />
                Información del proveedor
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div>
                <p className="font-bold text-xl leading-tight text-foreground">
                  {order.provider?.name || order.providerName || "Desconocido"}
                </p>
                <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs font-bold border-border text-foreground">CUIT: {order.providerCuit || order.provider?.cuit || "sin dato"}</Badge>
                </div>
              </div>

              {order.provider && (
                <div className="pt-4 border-t border-border/40 space-y-4">
                  <div className="space-y-1">
                      <p className="text-xs font-bold text-muted-foreground">Órdenes con este proveedor</p>
                      <p className="text-lg font-bold text-foreground">{(order.provider as any)._count?.orders || 0}</p>
                  </div>

                  <div className="space-y-2 bg-muted/30 p-3 rounded-2xl border border-border/40">
                    <p className="text-xs font-bold text-muted-foreground mb-1">Datos bancarios</p>
                    <p className="text-xs font-bold text-foreground">Banco: {order.provider.bank || "---"}</p>
                    <p className="font-mono text-xs truncate text-muted-foreground">CBU: {order.provider.cbu || "---"}</p>
                  </div>

                  <div className="space-y-2">
                      <p className="text-xs font-bold text-muted-foreground">Últimas órdenes</p>
                      <div className="space-y-2">
                          {(order.provider as any).orders?.slice(0, 3).map((o: any) => (
                              <Link key={o.id} href={`/admin/purchase-orders/${o.id}`} className="block group">
                                  <div className="flex items-center justify-between text-xs">
                                      <span className="font-bold text-foreground group-hover:text-primary transition-colors">#{o.number}</span>
                                      <span className="text-muted-foreground">${Number(o.amount).toLocaleString("es-AR")}</span>
                                  </div>
                              </Link>
                          ))}
                      </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit Log Card */}
          <Card className="rounded-2xl border border-border/60 shadow-xs bg-card text-card-foreground overflow-hidden">
            <CardHeader className="pb-2 bg-muted/20 border-b border-border/40">
              <CardTitle className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                <History className="h-4 w-4" />
                Actividad reciente
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <OrderAuditTimeline logs={auditLogs} />
            </CardContent>
          </Card>

          {/* System Metadata */}
          <Card className="rounded-2xl border border-border/60 shadow-xs bg-muted/20">
            <CardContent className="pt-6 text-xs text-muted-foreground space-y-2 font-medium">
              <div className="flex justify-between">
                <span>ID Interno:</span>
                <span className="font-mono">{order.id.substring(0, 8)}...</span>
              </div>
              {createdBy && (
                <div className="flex justify-between">
                  <span>Cargada por:</span>
                  <span className="text-foreground font-bold">{createdBy}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Última modif:</span>
                <span>{format(new Date(order.updatedAt), "dd/MM/yyyy HH:mm")}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
