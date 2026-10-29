export const dynamic = "force-dynamic";

import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Car, Fuel, Calendar, Plus,
  AlertTriangle, CheckCircle2, Clock,
  Settings, FileText, ChevronRight
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
import { auth } from "@/auth";
import { RESERVATION_STATUS, formatReservationRange, isFleetAdmin, reservationActionsFor } from "@/lib/vehicle-reservations";
import { ReservationActions } from "./requests/reservation-actions";
import { formatFechaCalendario } from "@/lib/fechas";
import { plural, formatPesos, formatNumber } from "@/lib/formato";
import { StatRow } from "@/components/ui/mobile-list";

export const metadata = { title: "Vehículos" };

export default async function VehiclesPage() {
  const now = new Date();
  const session = await auth();
  const me = { id: session?.user?.id || "", role: session?.user?.role };
  const fleetAdmin = isFleetAdmin(me.role);

  const yesterday = new Date(now.getTime() - 86400000);
  const myReservations = me.id
    ? await prisma.vehicleReservation.findMany({
        where: {
          userId: me.id,
          OR: [{ status: "EN_CURSO" }, { status: { in: ["PENDIENTE", "APROBADA"] }, endDate: { gte: yesterday } }],
        },
        include: { vehicle: { select: { plate: true, brand: true, model: true } } },
        orderBy: { startDate: "asc" },
      })
    : [];

  const vehicles = await prisma.vehicle.findMany({
    include: {
      _count: { select: { reservations: true } },
      // En uso (salió y no volvió) o reservado para este momento.
      reservations: {
        where: {
          OR: [
            { status: 'EN_CURSO' },
            { status: 'APROBADA', startDate: { lte: now }, endDate: { gte: now } },
          ]
        },
        include: { user: { select: { name: true } } },
        orderBy: { status: 'desc' },
        take: 1
      },
      fuelRecords: {
        where: {
          date: {
            gte: new Date(now.getFullYear(), now.getMonth(), 1)
          }
        }
      }
    },
    orderBy: { plate: 'asc' }
  });

  const pendingRequestsCount = await prisma.vehicleReservation.count({
    where: { status: 'PENDIENTE' }
  });

  const totalVehicles = vehicles.length;
  const inMaintenance = vehicles.filter(v => v.status === 'EN_TALLER').length;
  const availableNow = vehicles.filter(v =>
    v.status === 'DISPONIBLE' && v.reservations.length === 0
  ).length;

  const totalFuelSpentMonth = vehicles.reduce((acc, v) => {
    return acc + v.fuelRecords.reduce((sum, r) => sum + Number(r.amount), 0);
  }, 0);

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const criticalAlerts = vehicles.filter(v =>
    (v.vtvExpiry && v.vtvExpiry < thirtyDaysFromNow) ||
    (v.insuranceExpiry && v.insuranceExpiry < thirtyDaysFromNow)
  ).length;

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title="Vehículos"
        description="Los vehículos de la Muni: estado, reservas, combustible y vencimientos."
        icon={Car}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/admin/vehicles/reports">
                <FileText className="mr-2 h-4 w-4" /> Reportes
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/vehicles/fuel">
                <Fuel className="mr-2 h-4 w-4" /> Cargar combustible
              </Link>
            </Button>
            {fleetAdmin && (
              <Button asChild>
                <Link href="/admin/vehicles/new">
                  <Plus className="mr-2 h-4 w-4" /> Nuevo vehículo
                </Link>
              </Button>
            )}
          </>
        }
      />

      <StatRow>
        <StatCard
          label="Disponibles hoy"
          value={availableNow}
          hint={`de ${plural(totalVehicles, "unidad")}`}
          icon={CheckCircle2}
          tone="green"
        />
        <Link href="/admin/vehicles/requests" className="block">
          <StatCard
            label="Solicitudes pendientes"
            value={pendingRequestsCount}
            hint={<span className="inline-flex items-center">Ver solicitudes <ChevronRight className="h-3 w-3 ml-1" /></span>}
            icon={Clock}
            tone="orange"
            className="h-full transition-colors hover:border-primary/40"
          />
        </Link>
        <StatCard
          label="En mantenimiento"
          value={inMaintenance}
          hint="En el taller"
          icon={Settings}
          tone="red"
        />
        <StatCard
          label="Vencimientos cerca"
          value={criticalAlerts}
          hint="VTV o seguro en los próximos 30 días"
          icon={AlertTriangle}
          tone="orange"
        />
      </StatRow>

      {myReservations.length > 0 && (
        <Card className="rounded-2xl shadow-sm border border-border/60 bg-card text-card-foreground overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-lg">Mis reservas</CardTitle>
            <CardDescription>Si ya no vas a usar el vehículo, cancelá la reserva para que lo pueda usar otra persona.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/40">
              {myReservations.map((r) => {
                const st = RESERVATION_STATUS[r.status];
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">
                        {r.vehicle.plate} · {r.vehicle.brand} {r.vehicle.model}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatReservationRange(r.startDate, r.endDate)}{r.reason ? ` · ${r.reason}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs font-bold ${st.className}`}>{st.label}</Badge>
                      <ReservationActions
                        reservationId={r.id}
                        actions={reservationActionsFor(me, r).filter((a) => a === "CANCELADA")}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl shadow-sm border border-border/60 bg-card text-card-foreground overflow-hidden">
        <CardHeader className="bg-muted/30 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">Estado de la flota</CardTitle>
            <CardDescription>Cuál está libre, cuánto combustible lleva este mes y qué vence.</CardDescription>
          </div>
          <div className="text-right hidden md:block">
            <p className="text-xs text-muted-foreground">Combustible del mes</p>
            <p className="text-lg font-bold tabular-nums text-foreground">{formatPesos(totalFuelSpentMonth)}</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[120px]">Dominio</TableHead>
                  <TableHead>Marca y modelo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Combustible del mes</TableHead>
                  <TableHead>Vencimientos</TableHead>
                  <TableHead>
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((v) => {
                  const monthlyFuel = v.fuelRecords.reduce((sum, r) => sum + Number(r.amount), 0);
                  const fuelLimit = Number(v.fuelMonthlyLimit) || 0;
                  const fuelPercent = fuelLimit > 0 ? Math.min((monthlyFuel / fuelLimit) * 100, 100) : 0;

                  const current = v.reservations[0];
                  const inUse = current?.status === 'EN_CURSO';
                  const isOccupied = Boolean(current);
                  const isMaintenance = v.status === 'EN_TALLER';

                  const isVtvClose = v.vtvExpiry && v.vtvExpiry < thirtyDaysFromNow;
                  const isInsClose = v.insuranceExpiry && v.insuranceExpiry < thirtyDaysFromNow;

                  return (
                    <TableRow key={v.id}>
                      <TableCell>
                        <span className="font-semibold text-foreground">{v.plate}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{v.brand} {v.model}</span>
                          <span className="text-xs text-muted-foreground">
                            {v.lastServiceKm ? `Último service a los ${formatNumber(v.lastServiceKm)} km` : "Sin service cargado"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {isMaintenance ? (
                          <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20 border-none rounded-full px-3">En taller</Badge>
                        ) : isOccupied ? (
                          <div className="flex flex-col gap-1">
                            <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 border-none rounded-full px-3 w-fit">
                              {inUse ? "En uso" : "Reservado ahora"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{current.user?.name || "Sin nombre"}</span>
                          </div>
                        ) : (
                          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border-none rounded-full px-3">Disponible</Badge>
                        )}
                      </TableCell>
                      <TableCell className="w-[200px]">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="tabular-nums text-foreground">{formatPesos(monthlyFuel)}</span>
                            <span className="tabular-nums text-muted-foreground">{fuelLimit > 0 ? `de ${formatPesos(fuelLimit)}` : "Sin tope"}</span>
                          </div>
                          <Progress value={fuelPercent} className="h-1.5 bg-muted" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {v.vtvExpiry ? (
                            <div className={`text-xs flex items-center gap-1 ${isVtvClose ? 'text-rose-700 dark:text-rose-400 font-bold' : 'text-muted-foreground'}`}>
                              VTV: {formatFechaCalendario(v.vtvExpiry)}
                              {isVtvClose && <AlertTriangle className="h-2.5 w-2.5" />}
                            </div>
                          ) : <span className="text-xs text-muted-foreground italic">Sin VTV</span>}

                          {v.insuranceExpiry ? (
                            <div className={`text-xs flex items-center gap-1 ${isInsClose ? 'text-rose-700 dark:text-rose-400 font-bold' : 'text-muted-foreground'}`}>
                              Seguro: {formatFechaCalendario(v.insuranceExpiry)}
                              {isInsClose && <AlertTriangle className="h-2.5 w-2.5" />}
                            </div>
                          ) : <span className="text-xs text-muted-foreground italic">Sin seguro</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
                            <Link href={`/admin/vehicles/${v.id}`}>Ver historial</Link>
                          </Button>
                          {!isMaintenance && (
                            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" asChild>
                              <Link href={`/admin/vehicles/reserve?id=${v.id}`}>
                                <Calendar className="h-3.5 w-3.5" /> Reservar
                              </Link>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
