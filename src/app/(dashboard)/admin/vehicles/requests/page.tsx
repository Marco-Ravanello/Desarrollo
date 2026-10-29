export const dynamic = "force-dynamic";

import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ReservationActions } from "./reservation-actions";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AlertTriangle, Car } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyMessage } from "@/components/ui/empty-message";
import {
  BLOCKING_STATUSES, RESERVATION_STATUS, formatReservationRange, isFleetAdmin, rangesOverlap, reservationActionsFor,
} from "@/lib/vehicle-reservations";

export const metadata = { title: "Pedidos de vehículos" };

type Row = {
  id: string;
  userId: string;
  vehicleId: string;
  status: keyof typeof RESERVATION_STATUS;
  startDate: Date;
  endDate: Date;
  reason: string | null;
  observations: string | null;
  vehicle: { plate: string; brand: string; model: string };
  user: { name: string | null; area: { name: string } | null };
};

function Solicitante({ r }: { r: Row }) {
  return (
    <div className="flex flex-col">
      <span className="font-semibold text-foreground">{r.user?.name || "Sin nombre"}</span>
      <span className="text-xs text-muted-foreground">{r.user?.area?.name || "Sin área"}</span>
    </div>
  );
}

function Vehiculo({ r }: { r: Row }) {
  return (
    <div className="flex flex-col">
      <span className="font-semibold text-foreground">{r.vehicle.plate}</span>
      <span className="text-xs text-muted-foreground">{r.vehicle.brand} {r.vehicle.model}</span>
    </div>
  );
}

export default async function VehicleRequestsPage() {
  const session = await auth();
  if (!session?.user?.id || !isFleetAdmin(session.user.role)) {
    redirect("/dashboard");
  }
  const user = { id: session.user.id, role: session.user.role };

  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const rows: Row[] = await prisma.vehicleReservation.findMany({
    where: {
      OR: [
        { status: "PENDIENTE" },
        { status: "EN_CURSO" },
        { status: "APROBADA", endDate: { gte: weekAgo } },
      ],
    },
    include: { vehicle: { select: { plate: true, brand: true, model: true } }, user: { select: { name: true, area: { select: { name: true } } } } },
    orderBy: { startDate: "asc" },
  });

  const pending = rows.filter((r) => r.status === "PENDIENTE");
  const confirmed = rows.filter((r) => BLOCKING_STATUSES.includes(r.status));

  // Con quién choca cada pedido: con una reserva ya aprobada (no se puede aprobar) o con otro pedido (aprobar uno solo).
  const clashes = new Map<string, { blocking: Row[]; pending: Row[] }>();
  for (const p of pending) {
    const same = (r: Row) => r.id !== p.id && r.vehicleId === p.vehicleId && rangesOverlap(p.startDate, p.endDate, r.startDate, r.endDate);
    clashes.set(p.id, { blocking: confirmed.filter(same), pending: pending.filter(same) });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos de vehículos"
        description="Aprobá los pedidos, y registrá la salida y la vuelta de cada vehículo."
        icon={Car}
      />

      <Card className="rounded-2xl border border-border/60 shadow-xs overflow-hidden bg-card text-card-foreground">
        <CardHeader className="bg-muted/30 border-b border-border/40">
          <CardTitle className="font-heading">Pendientes de aprobación ({pending.length})</CardTitle>
          <CardDescription className="text-muted-foreground">Si un pedido choca con otro, aparece marcado. Solo se puede aprobar si el vehículo está libre.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-border/40">
                <TableHead className="text-muted-foreground font-semibold">Solicitante</TableHead>
                <TableHead className="text-muted-foreground font-semibold">Vehículo</TableHead>
                <TableHead className="text-muted-foreground font-semibold">Cuándo</TableHead>
                <TableHead className="text-muted-foreground font-semibold">Motivo</TableHead>
                <TableHead className="text-muted-foreground font-semibold text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <EmptyMessage kind="done" title="No hay pedidos esperando respuesta" description="Cuando alguien pida un vehículo, el pedido aparece acá." />
                  </TableCell>
                </TableRow>
              ) : (
                pending.map((r) => {
                  const clash = clashes.get(r.id)!;
                  return (
                    <TableRow key={r.id} className="hover:bg-muted/30 transition-colors border-border/40 align-top">
                      <TableCell><Solicitante r={r} /></TableCell>
                      <TableCell><Vehiculo r={r} /></TableCell>
                      <TableCell className="text-sm text-foreground min-w-[11rem]">
                        {formatReservationRange(r.startDate, r.endDate)}
                        {clash.blocking.map((c) => (
                          <p key={c.id} className="mt-1 flex items-start gap-1 text-xs font-semibold text-rose-700 dark:text-rose-400">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            Choca con la reserva {c.status === "EN_CURSO" ? "en uso" : "aprobada"} de {c.user?.name || "otra persona"} ({formatReservationRange(c.startDate, c.endDate)})
                          </p>
                        ))}
                        {clash.pending.map((c) => (
                          <p key={c.id} className="mt-1 flex items-start gap-1 text-xs font-semibold text-amber-800 dark:text-amber-400">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            Se pisa con el pedido de {c.user?.name || "otra persona"}: se puede aprobar uno solo
                          </p>
                        ))}
                      </TableCell>
                      <TableCell className="max-w-[220px] text-sm text-muted-foreground break-words">{r.reason || "Sin motivo"}</TableCell>
                      <TableCell className="text-right">
                        <ReservationActions
                          reservationId={r.id}
                          actions={reservationActionsFor(user, r).filter((a) => a !== "APROBADA" || clash.blocking.length === 0)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-border/60 shadow-xs overflow-hidden bg-card text-card-foreground">
        <CardHeader className="bg-muted/30 border-b border-border/40">
          <CardTitle className="font-heading">Reservas confirmadas ({confirmed.length})</CardTitle>
          <CardDescription className="text-muted-foreground">
            Cuando el vehículo sale, tocá &quot;Salió&quot;; cuando vuelve, &quot;Volvió&quot;. Así se sabe cuál está en uso.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-border/40">
                <TableHead className="text-muted-foreground font-semibold">Solicitante</TableHead>
                <TableHead className="text-muted-foreground font-semibold">Vehículo</TableHead>
                <TableHead className="text-muted-foreground font-semibold">Cuándo</TableHead>
                <TableHead className="text-muted-foreground font-semibold">Estado</TableHead>
                <TableHead className="text-muted-foreground font-semibold text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {confirmed.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <EmptyMessage compact title="No hay reservas aprobadas ni vehículos en uso" />
                  </TableCell>
                </TableRow>
              ) : (
                confirmed.map((r) => {
                  const st = RESERVATION_STATUS[r.status];
                  const late = r.status === "EN_CURSO" && r.endDate < new Date();
                  return (
                    <TableRow key={r.id} className="hover:bg-muted/30 transition-colors border-border/40 align-top">
                      <TableCell><Solicitante r={r} /></TableCell>
                      <TableCell><Vehiculo r={r} /></TableCell>
                      <TableCell className="text-sm text-foreground min-w-[11rem]">
                        {formatReservationRange(r.startDate, r.endDate)}
                        {r.observations && <p className="mt-1 text-xs text-muted-foreground whitespace-pre-line">{r.observations}</p>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs font-bold ${st.className}`}>{st.label}</Badge>
                        {late && <p className="mt-1 text-xs font-semibold text-amber-800 dark:text-amber-400">Tendría que haber vuelto</p>}
                      </TableCell>
                      <TableCell className="text-right">
                        <ReservationActions reservationId={r.id} actions={reservationActionsFor(user, r)} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
