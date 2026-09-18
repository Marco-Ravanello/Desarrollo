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
        <h2 className="text-3xl font-bold tracking-tight text-foreground font-heading">Solicitudes de Vehículos</h2>
        <p className="text-muted-foreground text-sm">Gestión y aprobación de uso de flota municipal.</p>
      </div>

      <Card className="rounded-3xl border border-border/60 shadow-xs overflow-hidden bg-card text-card-foreground">
        <CardHeader className="bg-muted/30 border-b border-border/40">
          <CardTitle className="font-heading">Pendientes de Aprobación</CardTitle>
          <CardDescription className="text-muted-foreground">Revise las solicitudes antes de confirmar la reserva.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-border/40">
                <TableHead className="text-muted-foreground font-semibold">Solicitante</TableHead>
                <TableHead className="text-muted-foreground font-semibold">Vehículo</TableHead>
                <TableHead className="text-muted-foreground font-semibold">Desde</TableHead>
                <TableHead className="text-muted-foreground font-semibold">Hasta</TableHead>
                <TableHead className="text-muted-foreground font-semibold">Motivo</TableHead>
                <TableHead className="text-muted-foreground font-semibold text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    No hay solicitudes pendientes.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((req) => (
                  <TableRow key={req.id} className="hover:bg-muted/30 transition-colors border-border/40">
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
                    <TableCell className="text-sm text-foreground">
                      {new Date(req.startDate).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {new Date(req.endDate).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground" title={req.reason || ""}>
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
