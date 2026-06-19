export const dynamic = "force-dynamic";

import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReservationActions } from "./reservation-actions";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function VehicleRequestsPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN_GENERAL')) {
    redirect("/dashboard");
  }

  const rawRequests = await prisma.vehicleReservation.findMany({
    where: { status: 'PENDIENTE' },
    include: {
      vehicle: true,
      user: {
        include: { area: true }
      }
    },
    orderBy: { startDate: 'asc' }
  });

  // Sanitize data: Convert Dates and Decimals to plain serializable types
  const requests = rawRequests.map(req => ({
    id: req.id,
    reason: req.reason || "Sin motivo",
    startDate: req.startDate ? req.startDate.toISOString() : new Date().toISOString(),
    endDate: req.endDate ? req.endDate.toISOString() : new Date().toISOString(),
    userName: req.user?.name || "Desconocido",
    userArea: req.user?.area?.name || "Sin área",
    vehiclePlate: req.vehicle?.plate || "S/D",
    vehicleInfo: req.vehicle ? `${req.vehicle.brand} ${req.vehicle.model}` : "Vehículo no identificado"
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-[#004a80]">Solicitudes de Vehículos</h2>
        <p className="text-slate-500 text-sm">Gestión y aprobación de uso de flota municipal.</p>
      </div>

      <Card className="rounded-3xl shadow-lg border-none overflow-hidden bg-card">
        <CardHeader className="bg-muted/50">
          <CardTitle>Pendientes de Aprobación</CardTitle>
          <CardDescription>Revise las solicitudes antes de confirmar la reserva.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Solicitante</TableHead>
                <TableHead>Vehículo</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead>Hasta</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-slate-400">
                    No hay solicitudes pendientes.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((req) => (
                  <TableRow key={req.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{req.userName}</span>
                        <span className="text-xs text-muted-foreground">{req.userArea}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-primary uppercase">{req.vehiclePlate}</span>
                        <span className="text-xs text-muted-foreground">{req.vehicleInfo}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(req.startDate).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(req.endDate).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm" title={req.reason || ""}>
                      {req.reason}
                    </TableCell>
                    <TableCell className="text-right">
                      <ReservationActions reservationId={req.id} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
