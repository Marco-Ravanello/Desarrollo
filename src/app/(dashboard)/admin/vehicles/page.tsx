export const dynamic = "force-dynamic";
import { getVehicles } from "@/services/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Car, Fuel, Calendar, Plus } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default async function VehiclesPage() {
  const vehicles = await getVehicles();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Vehículos y Logística</h2>
          <p className="text-slate-500">Gestión de flota, reservas y rendición de combustible.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild title="Reportes mensuales">
            <Link href="/admin/vehicles/reports"><Calendar className="mr-2 h-4 w-4"/> Reportes</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/vehicles/fuel"><Fuel className="mr-2 h-4 w-4"/> Rendición</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/vehicles/new"><Plus className="mr-2 h-4 w-4"/> Nuevo Vehículo</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {vehicles.map((v) => (
          <Card key={v.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{v.brand} {v.model}</CardTitle>
              <Car className={v.reservations.length > 0 ? "h-4 w-4 text-amber-500" : "h-4 w-4 text-slate-400"} />
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-start">
                <div className="text-2xl font-bold font-mono tracking-tighter uppercase">{v.plate}</div>
                {v.reservations.length > 0 ? (
                  <Badge variant="destructive" className="animate-pulse">OCUPADO</Badge>
                ) : (
                  <Badge variant="outline" className="text-emerald-500 border-emerald-500">DISPONIBLE</Badge>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Calendar className="h-3 w-3" />
                  <span>{v._count.reservations} Reservas</span>
                </div>
                <Button size="sm" variant="ghost" asChild disabled={v.reservations.length > 0}>
                   <Link href={`/admin/vehicles/reserve?id=${v.id}`}>Reservar</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Flota Municipal</CardTitle>
          <CardDescription>Detalle de todos los vehículos registrados.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dominio</TableHead>
                <TableHead>Marca y Modelo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono font-bold uppercase">{v.plate}</TableCell>
                  <TableCell>{v.brand} {v.model}</TableCell>
                  <TableCell>
                    {v.reservations.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        <Badge variant="destructive" className="w-fit">OCUPADO</Badge>
                        <span className="text-[10px] text-slate-500 italic">Hasta {new Date(v.reservations[0].endDate).toLocaleString()}</span>
                      </div>
                    ) : (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">DISPONIBLE</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/vehicles/${v.id}`}>Historial</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
