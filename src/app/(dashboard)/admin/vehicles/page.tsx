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
import { Progress } from "@/components/ui/progress";

export default async function VehiclesPage() {
  const now = new Date();

  const vehicles = await prisma.vehicle.findMany({
    include: {
      _count: { select: { reservations: true } },
      reservations: {
        where: {
          status: { in: ['APROBADA', 'EN_CURSO'] },
          startDate: { lte: now },
          endDate: { gte: now }
        },
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Gestión de Flota</h2>
          <p className="text-muted-foreground">Control operativo, mantenimiento y logística municipal.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild className="rounded-xl border-border/60">
            <Link href="/admin/vehicles/reports">
              <FileText className="mr-2 h-4 w-4 text-muted-foreground"/> Reportes
            </Link>
          </Button>
          <Button variant="outline" asChild className="rounded-xl border-border/60">
            <Link href="/admin/vehicles/fuel">
              <Fuel className="mr-2 h-4 w-4 text-amber-500"/> Carga Combustible
            </Link>
          </Button>
          <Button asChild className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground">
            <Link href="/admin/vehicles/new">
              <Plus className="mr-2 h-4 w-4"/> Nueva Unidad
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-3xl border border-border/60 shadow-xs bg-card text-card-foreground overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
             <Car size={80} className="text-primary" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground font-medium">Disponibles Hoy</CardDescription>
            <CardTitle className="text-4xl font-bold text-primary">{availableNow}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-emerald-500 font-medium bg-emerald-500/10 w-fit px-2 py-1 rounded-full">
              <CheckCircle2 className="h-3 w-3 mr-1" /> de {totalVehicles} unidades
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-border/60 shadow-xs bg-card text-card-foreground overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
             <Clock size={80} className="text-amber-500" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground font-medium">Solicitudes Pendientes</CardDescription>
            <CardTitle className="text-4xl font-bold text-amber-500">{pendingRequestsCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="link" asChild className="p-0 h-auto text-xs font-semibold text-amber-500 hover:text-amber-600">
              <Link href="/admin/vehicles/requests" className="flex items-center">
                Ver solicitudes <ChevronRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-border/60 shadow-xs bg-card text-card-foreground overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
             <Settings size={80} className="text-rose-500" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground font-medium">En Mantenimiento</CardDescription>
            <CardTitle className="text-4xl font-bold text-rose-500">{inMaintenance}</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="text-xs text-muted-foreground">Unidades fuera de servicio</div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-border/60 shadow-xs bg-card text-card-foreground overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
             <AlertTriangle size={80} className="text-amber-500" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground font-medium">Alertas Críticas</CardDescription>
            <CardTitle className="text-4xl font-bold text-amber-500">{criticalAlerts}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">VTV o Seguros próximos a vencer</div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl shadow-xs border border-border/60 bg-card text-card-foreground overflow-hidden">
        <CardHeader className="bg-muted/30 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-xl">Estado de la Flota</CardTitle>
            <CardDescription>Detalle técnico y disponibilidad de unidades.</CardDescription>
          </div>
          <div className="text-right hidden md:block">
            <p className="text-xs text-muted-foreground">Gasto Combustible (Mes)</p>
            <p className="text-lg font-bold text-emerald-500">${totalFuelSpentMonth.toLocaleString()}</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[120px]">Dominio</TableHead>
                  <TableHead>Marca y Modelo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Combustible (Mes)</TableHead>
                  <TableHead>Vencimientos</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((v) => {
                  const monthlyFuel = v.fuelRecords.reduce((sum, r) => sum + Number(r.amount), 0);
                  const fuelLimit = Number(v.fuelMonthlyLimit) || 0;
                  const fuelPercent = fuelLimit > 0 ? Math.min((monthlyFuel / fuelLimit) * 100, 100) : 0;

                  const isOccupied = v.reservations.length > 0;
                  const isMaintenance = v.status === 'EN_TALLER';

                  const isVtvClose = v.vtvExpiry && v.vtvExpiry < thirtyDaysFromNow;
                  const isInsClose = v.insuranceExpiry && v.insuranceExpiry < thirtyDaysFromNow;

                  return (
                    <TableRow key={v.id} className="hover:bg-muted/30 transition-colors group">
                      <TableCell>
                        <div className="px-2 py-1 bg-muted/60 rounded-md border-b-2 border-border/60 w-fit">
                          <span className="font-mono font-bold text-foreground uppercase tracking-wider">{v.plate}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{v.brand} {v.model}</span>
                          <span className="text-xs text-muted-foreground">KM Service: {v.lastServiceKm?.toLocaleString() || 0} km</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {isMaintenance ? (
                          <Badge className="bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border-none rounded-full px-3">EN TALLER</Badge>
                        ) : isOccupied ? (
                          <div className="flex flex-col gap-1">
                            <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-none rounded-full px-3 w-fit">OCUPADO</Badge>
                            <span className="text-[10px] text-muted-foreground italic">Reservado</span>
                          </div>
                        ) : (
                          <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-none rounded-full px-3">DISPONIBLE</Badge>
                        )}
                      </TableCell>
                      <TableCell className="w-[200px]">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-medium">
                            <span className="text-muted-foreground">${monthlyFuel.toLocaleString()}</span>
                            <span className="text-muted-foreground/80">lim. ${fuelLimit.toLocaleString()}</span>
                          </div>
                          <Progress value={fuelPercent} className="h-1.5 bg-muted" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {v.vtvExpiry ? (
                            <div className={`text-[10px] flex items-center gap-1 ${isVtvClose ? 'text-rose-500 font-bold' : 'text-muted-foreground'}`}>
                              VTV: {new Date(v.vtvExpiry).toLocaleDateString()}
                              {isVtvClose && <AlertTriangle className="h-2.5 w-2.5" />}
                            </div>
                          ) : <span className="text-[10px] text-muted-foreground/60 italic">Sin VTV</span>}

                          {v.insuranceExpiry ? (
                            <div className={`text-[10px] flex items-center gap-1 ${isInsClose ? 'text-rose-500 font-bold' : 'text-muted-foreground'}`}>
                              Seg: {new Date(v.insuranceExpiry).toLocaleDateString()}
                              {isInsClose && <AlertTriangle className="h-2.5 w-2.5" />}
                            </div>
                          ) : <span className="text-[10px] text-muted-foreground/60 italic">Sin Seguro</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" asChild>
                            <Link href={`/admin/vehicles/${v.id}`} title="Ver Historial">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            asChild
                            disabled={isMaintenance}
                          >
                            <Link href={`/admin/vehicles/reserve?id=${v.id}`} title="Reservar">
                              <Calendar className="h-4 w-4 text-primary" />
                            </Link>
                          </Button>
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
