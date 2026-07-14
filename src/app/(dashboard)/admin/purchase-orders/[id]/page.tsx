export const dynamic = "force-dynamic";
import { getPurchaseOrderById } from "@/services/admin";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Calendar, MapPin, CreditCard, FileText, User, TrendingUp, Wallet, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { OrderItemsTable } from "./order-items-table";
import { Progress } from "@/components/ui/progress";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getPurchaseOrderById(id);

  if (!order) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/admin/purchase-orders">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Orden de Compra #{order.number}</h2>
          <p className="text-slate-500">Detalles técnicos y estado de la adquisición.</p>
        </div>
        <Badge
          className="ml-auto text-lg px-4 py-1"
          variant={order.status === 'APROBADA' ? 'default' : order.status === 'RECHAZADA' ? 'destructive' : 'secondary'}
        >
          {order.status.replace('_', ' ')}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              Información de la Orden
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-3">
                  <Wallet className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Presupuesto Total</span>
                <p className="text-2xl font-black text-slate-900">${Number(order.amount).toLocaleString()}</p>
                <p className="text-[10px] text-slate-500 font-medium mt-1">Monto original</p>
              </div>

              <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-3">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Ejecutado</span>
                <p className="text-2xl font-black text-slate-900">
                  ${order.items.reduce((acc, item) => acc + (Number(item.fulfilledQuantity) * Number(item.unitPrice)), 0).toLocaleString()}
                </p>
                <div className="w-full mt-2">
                    {(() => {
                        const executed = order.items.reduce((acc, item) => acc + (Number(item.fulfilledQuantity) * Number(item.unitPrice)), 0);
                        const total = Number(order.amount);
                        const progress = total > 0 ? (executed / total) * 100 : 0;
                        return (
                            <div className="space-y-1">
                                <Progress value={progress} className="h-1.5 [&>div]:bg-green-500" />
                                <p className="text-[10px] text-slate-400 font-bold">{Math.round(progress)}% del total</p>
                            </div>
                        )
                    })()}
                </div>
              </div>

              <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 mb-3">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Saldo Pendiente</span>
                <p className="text-2xl font-black text-slate-900">
                  ${(Number(order.amount) - order.items.reduce((acc, item) => acc + (Number(item.fulfilledQuantity) * Number(item.unitPrice)), 0)).toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-500 font-medium mt-1">Por recibir</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">N° Expediente / Suministro</Label>
                <div className="flex">
                    <span className="text-sm font-mono font-bold text-blue-700 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 shadow-sm">
                        {order.expediente || "SIN EXPEDIENTE"}
                    </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Descripción / Motivo</Label>
                <div className="bg-white p-4 rounded-xl text-slate-600 text-xs border border-slate-200 shadow-sm leading-relaxed">
                    {order.description || "Sin descripción adicional detallada."}
                </div>
              </div>
            </div>

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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-slate-400 shrink-0 mt-1" />
                <div>
                  <Label className="text-xs text-muted-foreground uppercase font-bold">Fecha de Entrega</Label>
                  <p className="font-medium">
                    {order.deliveryDate ? format(new Date(order.deliveryDate), "PPP", { locale: es }) : "No especificada"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-slate-400 shrink-0 mt-1" />
                <div>
                  <Label className="text-xs text-muted-foreground uppercase font-bold">Lugar de Entrega</Label>
                  <p className="font-medium">{order.deliveryPlace || "No especificado"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-slate-400 shrink-0 mt-1" />
                <div>
                  <Label className="text-xs text-muted-foreground uppercase font-bold">Condiciones de Pago</Label>
                  <p className="font-medium">{order.paymentTerms || "No especificadas"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider font-black text-slate-400">
                <User className="h-4 w-4" />
                Proveedor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-bold text-slate-800 leading-tight">
                  {order.provider?.name || order.providerName || "Desconocido"}
                </p>
                <p className="text-sm text-muted-foreground">CUIT: {order.providerCuit || "---"}</p>
              </div>
              {order.provider && (
                <div className="pt-2 border-t text-sm space-y-1 text-slate-600">
                  <p>Banco: {order.provider.bank || "---"}</p>
                  <p className="font-mono text-[11px]">CBU: {order.provider.cbu || "---"}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-50 border-dashed border-2">
            <CardHeader>
              <CardTitle className="text-xs uppercase font-bold text-slate-500">Metadata del Sistema</CardTitle>
            </CardHeader>
            <CardContent className="text-[11px] text-slate-400 space-y-1">
              <p>ID Interno: {order.id}</p>
              <p>Fecha de Carga: {format(new Date(order.createdAt), "dd/MM/yyyy HH:mm")}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
