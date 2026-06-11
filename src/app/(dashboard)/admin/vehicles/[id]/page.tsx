export const dynamic = "force-dynamic";

import { getVehicleWithHistory } from "@/services/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Car, Fuel, Calendar, User, ArrowLeft, Settings, ShieldCheck, Wrench } from "lucide-react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vehicle = await getVehicleWithHistory(id);

  if (!vehicle) notFound();

  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const isVtvClose = vehicle.vtvExpiry && new Date(vehicle.vtvExpiry) < thirtyDaysFromNow;
  const isInsClose = vehicle.insuranceExpiry && new Date(vehicle.insuranceExpiry) < thirtyDaysFromNow;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
           <Link href="/admin/vehicles"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex items-center gap-4">
          <div className="bg-[#004a80] p-4 rounded-3xl shadow-lg shadow-blue-900/20">
            <Car className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-[#004a80] tracking-tight">{vehicle.brand} {vehicle.model}</h2>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-slate-100 rounded font-mono font-bold text-slate-600 uppercase border-b-2 border-slate-300">{vehicle.plate}</span>
              <Badge className={
                vehicle.status === 'DISPONIBLE' ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" :
                vehicle.status === 'EN_TALLER' ? "bg-rose-100 text-rose-700 hover:bg-rose-100" :
                "bg-slate-100 text-slate-700 hover:bg-slate-100"
              }>
                {vehicle.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Stats and Info */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="rounded-3xl shadow-lg border-none overflow-hidden">
            <CardHeader className="bg-slate-50/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5 text-slate-500" /> Ficha Técnica
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Último Service</span>
                <span className="font-bold text-[#004a80]">{vehicle.lastServiceKm?.toLocaleString() || 0} KM</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Tarjeta YPF</span>
                <span className="font-mono text-sm">{vehicle.fuelCardNumber || "N/A"}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Cupo Mensual</span>
                <span className="font-bold text-emerald-600">${Number(vehicle.fuelMonthlyLimit || 0).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-lg border-none overflow-hidden">
            <CardHeader className="bg-slate-50/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-slate-500" /> Documentación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                   <span className="text-sm font-semibold">Vencimiento VTV</span>
                   <span className="text-xs text-slate-400">Revisión Técnica</span>
                </div>
                <Badge variant={isVtvClose ? "destructive" : "outline"} className="rounded-lg">
                  {vehicle.vtvExpiry ? new Date(vehicle.vtvExpiry).toLocaleDateString() : "No registrado"}
                </Badge>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                   <span className="text-sm font-semibold">Vencimiento Seguro</span>
                   <span className="text-xs text-slate-400">Póliza Vigente</span>
                </div>
                <Badge variant={isInsClose ? "destructive" : "outline"} className="rounded-lg">
                  {vehicle.insuranceExpiry ? new Date(vehicle.insuranceExpiry).toLocaleDateString() : "No registrado"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Button variant="outline" className="w-full rounded-2xl border-dashed border-2 py-8 text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all">
             <Wrench className="h-5 w-5 mr-2" /> Reportar Problema / Ingreso a Taller
          </Button>
        </div>

        {/* Right Column: Tables */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-3xl shadow-lg border-none overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" /> Historial de Reservas
              </CardTitle>
              <CardDescription>Registro histórico de uso por parte de las áreas.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-100/50">
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicle.reservations.map((res) => (
                    <TableRow key={res.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="text-sm font-medium">
                        {new Date(res.startDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-700">{res.user?.name || "Desconocido"}</span>
                          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">{(res.user as any)?.area?.name || "Administración"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500 max-w-[150px] truncate" title={res.reason || ""}>
                        {res.reason}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] font-bold uppercase rounded-full">
                          {res.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {vehicle.reservations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-slate-400">Sin reservas registradas</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-lg border-none overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Fuel className="h-5 w-5 text-emerald-500" /> Cargas de Combustible
              </CardTitle>
              <CardDescription>Rendiciones de ticket YPF en Ruta.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-100/50">
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Importe</TableHead>
                    <TableHead>Litros</TableHead>
                    <TableHead>Ticket</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicle.fuelRecords.map((fuel) => (
                    <TableRow key={fuel.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="text-sm">
                        {new Date(fuel.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-bold text-emerald-700">
                        ${Number(fuel.amount).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm font-semibold">
                        {Number(fuel.liters).toFixed(2)} L
                      </TableCell>
                      <TableCell className="text-xs font-mono text-slate-400">
                        {fuel.ticketNumber}
                      </TableCell>
                    </TableRow>
                  ))}
                  {vehicle.fuelRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-slate-400">Sin cargas registradas</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
