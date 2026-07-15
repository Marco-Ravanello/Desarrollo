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
  Paperclip, Building2, Info, ArrowUpRight, DollarSign
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { OrderItemsTable } from "./order-items-table";
import { Progress } from "@/components/ui/progress";
import { OrderTimeline } from "./order-timeline";
import { OrderAuditTimeline } from "./order-audit-timeline";
import { OrderStatusActions } from "../order-status-actions";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getPurchaseOrderById(id);
  const auditLogs = await getOrderAuditLogs(id);

  if (!order) {
    notFound();
  }

  const executedAmount = order.items.reduce((acc, item) => acc + (Number(item.fulfilledQuantity) * Number(item.unitPrice)), 0);
  const totalAmount = Number(order.amount);
  const globalProgress = totalAmount > 0 ? (executedAmount / totalAmount) * 100 : 0;
  const isFulfilled = executedAmount >= totalAmount && totalAmount > 0;

  const currentResponsible =
    order.status === 'BORRADOR' ? 'Iniciador' :
    order.status === 'PENDIENTE_APROBACION' ? 'Secretaría / Dirección' :
    order.status === 'APROBADA' ? 'Compras / Proveedor' :
    order.status === 'CUMPLIDA' ? 'Tesorería (Pago)' :
    'Archivo';

  const financialStatus =
    order.status === 'CUMPLIDA' ? 'Pagada' :
    executedAmount > 0 ? 'Parcialmente Pagada' : 'Pendiente de Pago';

  return (
    <div className="space-y-6 pb-20">
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild className="rounded-full h-11 w-11 shadow-sm">
            <Link href="/admin/purchase-orders">
                <ChevronLeft className="h-5 w-5" />
            </Link>
            </Button>
            <div>
                <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Orden #{order.number}</h2>
                    <Badge
                    className="text-xs px-3 py-0.5 rounded-full font-black uppercase tracking-widest"
                    variant={order.status === 'APROBADA' ? 'default' : order.status === 'RECHAZADA' ? 'destructive' : order.status === 'CUMPLIDA' ? 'outline' : 'secondary'}
                    >
                    {order.status.replace('_', ' ')}
                    </Badge>
                </div>
                <div className="flex items-center gap-4 mt-1 text-slate-500 text-xs font-medium">
                    <span className="flex items-center gap-1"><User className="h-3 w-3" /> Responsable Actual: <b className="text-slate-700">{currentResponsible}</b></span>
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(new Date(order.createdAt), "dd/MM/yyyy HH:mm")}</span>
                </div>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <OrderStatusActions orderId={order.id} currentStatus={order.status} />
            <Button className="bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest px-6 rounded-xl">
                Exportar PDF
            </Button>
        </div>
      </div>

      {/* Main Process Timeline */}
      <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm overflow-hidden">
         <CardContent className="p-0">
            <OrderTimeline currentStatus={order.status} />
         </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">

          {/* STAR KPI METRICS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                        <Wallet className="h-5 w-5" />
                    </div>
                    <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none font-black text-[10px]">PRESUPUESTO</Badge>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Monto Total Adjudicado</span>
                <p className="text-2xl font-black text-slate-900">${totalAmount.toLocaleString()}</p>
                <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Moneda</span>
                    <span className="text-[10px] font-black text-slate-900">ARS</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <TrendingUp className="h-5 w-5" />
                    </div>
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-none font-black text-[10px]">EJECUTADO</Badge>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Recibido (Devengado)</span>
                <p className="text-2xl font-black text-slate-900">${executedAmount.toLocaleString()}</p>
                <div className="mt-4 space-y-1">
                    <Progress value={globalProgress} className="h-1.5 [&>div]:bg-emerald-500 bg-emerald-100" />
                    <p className="text-[10px] text-emerald-600 font-black uppercase text-right">{Math.round(globalProgress)}% COMPLETADO</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600">
                        <DollarSign className="h-5 w-5" />
                    </div>
                    <Badge variant="secondary" className="bg-orange-50 text-orange-600 border-none font-black text-[10px]">FINANZAS</Badge>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Saldo Pendiente de Entrega</span>
                <p className="text-2xl font-black text-slate-900">${(totalAmount - executedAmount).toLocaleString()}</p>
                <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Finanzas</span>
                    <span className={`text-[10px] font-black uppercase ${financialStatus === 'Pagada' ? 'text-emerald-600' : financialStatus === 'Parcialmente Pagada' ? 'text-blue-600' : 'text-orange-600'}`}>
                        {financialStatus}
                    </span>
                </div>
              </div>
          </div>

          {/* Technical Info */}
          <Card className="rounded-3xl border-slate-100 shadow-sm">
            <CardHeader className="pb-2 border-b border-slate-50">
              <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
                <FileText className="h-4 w-4" />
                Especificaciones Técnicas
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                                    <Info className="h-4 w-4 text-slate-400" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">N° Expediente / Suministro</p>
                                    <p className="text-sm font-black text-slate-800">{order.expediente || "SIN DATO"}</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400"><ArrowUpRight className="h-4 w-4" /></Button>
                        </div>

                        <div className="flex items-center gap-3 p-3">
                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center">
                                <MapPin className="h-4 w-4 text-slate-400" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lugar de Entrega</p>
                                <p className="text-sm font-bold text-slate-700">{order.deliveryPlace || "No especificado"}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3">
                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center">
                                <CreditCard className="h-4 w-4 text-slate-400" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Condiciones de Pago</p>
                                <p className="text-sm font-bold text-slate-700">{order.paymentTerms || "No especificadas"}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                         <div className="space-y-2">
                            <Label className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Descripción / Motivo de la Adquisición</Label>
                            <div className="bg-slate-50/50 p-4 rounded-2xl text-slate-600 text-xs border border-slate-100 leading-relaxed min-h-[100px]">
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
            items={order.items.map(i => ({
              ...i,
              quantity: i.quantity.toString(),
              fulfilledQuantity: i.fulfilledQuantity.toString(),
              unitPrice: i.unitPrice.toString(),
              totalPrice: i.totalPrice.toString()
            }))}
          />

          {/* Attachments Section */}
          <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Paperclip className="h-4 w-4" /> Documentación Adjunta
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-slate-50">
                    <div className="p-4 flex items-center justify-between hover:bg-slate-50/30 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-black text-slate-700">Orden_Firmada_{order.number}.pdf</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">PDF • 2.4 MB • 12/05/2026</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" className="text-blue-600 font-bold text-[10px]">DESCARGAR</Button>
                    </div>
                    <div className="p-4 flex items-center justify-center border-dashed border-2 m-4 rounded-2xl bg-slate-50/50">
                        <Button variant="ghost" className="text-slate-400 flex flex-col gap-1 h-auto py-4">
                            <PlusIcon className="h-5 w-5" />
                            <span className="text-[10px] font-black uppercase">Subir Documento (Factura, Remito, etc)</span>
                        </Button>
                    </div>
                </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Sidebar */}
        <div className="space-y-6">
          {/* Provider Card */}
          <Card className="rounded-3xl border-none shadow-sm bg-slate-900 text-white overflow-hidden">
            <CardHeader className="pb-2 border-b border-white/10">
              <CardTitle className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-slate-400">
                <Building2 className="h-4 w-4" />
                Información del Proveedor
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div>
                <p className="font-black text-xl leading-tight">
                  {order.provider?.name || order.providerName || "Desconocido"}
                </p>
                <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-white/10 text-white hover:bg-white/20 border-none text-[10px] font-bold">CUIT: {order.providerCuit || "---"}</Badge>
                    <Badge className="bg-blue-500 text-white border-none text-[10px] font-bold">CAT: {order.provider?.orders?.length > 10 ? 'A' : 'B'}</Badge>
                </div>
              </div>

              {order.provider && (
                <div className="pt-4 border-t border-white/10 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Órdenes Totales</p>
                          <p className="text-lg font-black">{(order.provider as any)._count?.orders || 0}</p>
                      </div>
                      <div className="space-y-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Estado</p>
                          <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <p className="text-xs font-bold text-emerald-400">Verificado</p>
                          </div>
                      </div>
                  </div>

                  <div className="space-y-2 bg-white/5 p-3 rounded-2xl border border-white/5">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Datos Bancarios</p>
                    <p className="text-[10px] font-bold">Banco: {order.provider.bank || "---"}</p>
                    <p className="font-mono text-[9px] truncate">CBU: {order.provider.cbu || "---"}</p>
                  </div>

                  <div className="space-y-2">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Actividad Reciente</p>
                      <div className="space-y-2">
                          {(order.provider as any).orders?.slice(0, 3).map((o: any) => (
                              <Link key={o.id} href={`/admin/purchase-orders/${o.id}`} className="block group">
                                  <div className="flex items-center justify-between text-[10px]">
                                      <span className="font-bold text-slate-300 group-hover:text-white transition-colors">#{o.number}</span>
                                      <span className="text-slate-500">${Number(o.amount).toLocaleString()}</span>
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
          <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
            <CardHeader className="pb-2 bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-slate-500">
                <History className="h-4 w-4" />
                Actividad Reciente
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <OrderAuditTimeline logs={auditLogs} />
            </CardContent>
          </Card>

          {/* System Metadata */}
          <Card className="rounded-3xl border-slate-100 shadow-sm bg-slate-50/30">
            <CardContent className="pt-6 text-[10px] text-slate-400 space-y-2 font-medium">
              <div className="flex justify-between">
                <span>ID Interno:</span>
                <span className="font-mono">{order.id.substring(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span>Creado por:</span>
                <span className="text-slate-600 font-bold">Admin Municipal</span>
              </div>
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

function PlusIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
    )
}
