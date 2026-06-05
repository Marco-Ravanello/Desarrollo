import { getVehicleWithHistory } from "@/services/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Car, Fuel, Calendar } from "lucide-react";
import { notFound } from "next/navigation";

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vehicle = await getVehicleWithHistory(id);

  if (!vehicle) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="bg-slate-100 p-3 rounded-full">
          <Car className="h-8 w-8 text-slate-600" />
        </div>
        <div>
          <h2 className="text-3xl font-bold">{vehicle.brand} {vehicle.model}</h2>
          <p className="text-slate-500 font-mono">{vehicle.plate}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Historial de Reservas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicle.reservations.map((res) => (
                  <TableRow key={res.id}>
                    <TableCell className="text-sm">
                      {new Date(res.startDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{res.user.name}</span>
                        <span className="text-[10px] text-slate-500 uppercase">{(res.user as any).area?.name || "Sin Área"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{res.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {vehicle.reservations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-slate-400">Sin reservas registradas</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fuel className="h-5 w-5 text-emerald-500" />
              Cargas de Combustible
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Litros</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicle.fuelRecords.map((fuel) => (
                  <TableRow key={fuel.id}>
                    <TableCell className="text-sm">
                      {new Date(fuel.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-medium">
                      ${Number(fuel.amount).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {Number(fuel.liters)} L
                    </TableCell>
                  </TableRow>
                ))}
                {vehicle.fuelRecords.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-slate-400">Sin cargas registradas</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
