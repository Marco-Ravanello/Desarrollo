export const dynamic = "force-dynamic";
import { getVehicleWithHistory } from "@/services/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { notFound } from "next/navigation";
import { Car, Fuel, Calendar, ArrowLeft, CreditCard } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vehicle = await getVehicleWithHistory(id);

  if (!vehicle) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/vehicles"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{vehicle.brand} {vehicle.model}</h2>
          <Badge variant="outline" className="font-mono text-lg">{vehicle.plate}</Badge>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-500" /> Tarjeta YPF en Ruta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
             <div className="flex justify-between text-sm">
                <span className="text-slate-500">N° Tarjeta:</span>
                <span className="font-mono">{vehicle.fuelCardNumber || "No asignada"}</span>
             </div>
             <div className="flex justify-between text-sm">
                <span className="text-slate-500">Cupo Mensual:</span>
                <span className="font-bold">${Number(vehicle.fuelMonthlyLimit).toLocaleString()}</span>
             </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Historial de Reservas</CardTitle>
          </CardHeader>
          <CardContent>
            {vehicle.reservations.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">Sin reservas registradas.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicle.reservations.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">
                        {new Date(r.startDate).toLocaleDateString()} {new Date(r.startDate).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} a <br/>
                        {new Date(r.endDate).toLocaleDateString()} {new Date(r.endDate).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                      </TableCell>
                      <TableCell className="text-sm">{r.reason}</TableCell>
                      <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Rendiciones de Combustible</CardTitle>
            <CardDescription>Cargas registradas con la tarjeta del vehículo.</CardDescription>
          </CardHeader>
          <CardContent>
            {vehicle.fuelRecords.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">Sin cargas de combustible registradas.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Litros</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicle.fuelRecords.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>{new Date(f.date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-mono text-xs">{f.ticketNumber}</TableCell>
                      <TableCell>{Number(f.liters)} L</TableCell>
                      <TableCell className="text-right font-bold">${Number(f.amount).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
