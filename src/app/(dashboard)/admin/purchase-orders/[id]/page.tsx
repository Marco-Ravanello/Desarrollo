export const dynamic = "force-dynamic";
import { getPurchaseOrderById } from "@/services/admin";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Calendar, MapPin, CreditCard, FileText, User } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground uppercase font-bold">Monto Total</Label>
                <p className="text-2xl font-black text-slate-900">${Number(order.amount).toLocaleString()}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase font-bold">N° Expediente</Label>
                <p className="text-xl font-mono">{order.expediente || "---"}</p>
              </div>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label className="text-xs text-muted-foreground uppercase font-bold">Descripción / Motivo</Label>
              <div className="bg-slate-50 p-4 rounded-xl text-slate-700 whitespace-pre-wrap min-h-[100px]">
                {order.description || "Sin descripción adicional."}
              </div>
            </div>

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
