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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50/50 p-5 rounded-3xl border border-blue-100 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                  <Wallet className="h-4 w-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Presupuesto Total</span>
                </div>
                <p className="text-3xl font-black text-slate-900">${Number(order.amount).toLocaleString()}</p>
                <p className="text-[10px] text-slate-500 font-medium italic">Monto original de la orden</p>
              </div>

              <div className="bg-green-50/50 p-5 rounded-3xl border border-green-100 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-green-600 mb-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Ejecutado a la Fecha</span>
                </div>
                <p className="text-3xl font-black text-slate-900">
                  ${order.items.reduce((acc, item) => acc + (Number(item.fulfilledQuantity) * Number(item.unitPrice)), 0).toLocaleString()}
                </p>
                <div className="mt-auto">
                    {(() => {
                        const executed = order.items.reduce((acc, item) => acc + (Number(item.fulfilledQuantity) * Number(item.unitPrice)), 0);
                        const total = Number(order.amount);
                        const progress = total > 0 ? (executed / total) * 100 : 0;
                        return (
                            <div className="space-y-1">
                                <Progress value={progress} className="h-1.5 [&>div]:bg-green-500" />
                                <p className="text-[10px] text-slate-500 font-bold text-right">{Math.round(progress)}% del total</p>
                            </div>
                        )
                    })()}
                </div>
              </div>

              <div className="bg-orange-50/50 p-5 rounded-3xl border border-orange-100 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-orange-600 mb-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Saldo Pendiente</span>
                </div>
                <p className="text-3xl font-black text-slate-900">
                  ${(Number(order.amount) - order.items.reduce((acc, item) => acc + (Number(item.fulfilledQuantity) * Number(item.unitPrice)), 0)).toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-500 font-medium">Crédito disponible por recibir</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">N° Expediente / Suministro</Label>
                <p className="text-xl font-mono font-bold text-slate-700 bg-slate-100 px-3 py-2 rounded-xl inline-block">{order.expediente || "SIN EXPEDIENTE"}</p>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Descripción / Motivo</Label>
                <div className="bg-slate-50 p-4 rounded-2xl text-slate-600 text-sm italic border border-slate-100">
                    "{order.description || "Sin descripción adicional."}"
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
