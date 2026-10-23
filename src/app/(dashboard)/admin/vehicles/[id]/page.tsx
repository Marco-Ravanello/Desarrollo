export const dynamic = "force-dynamic";

import { getVehicleWithHistory } from "@/services/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyMessage } from "@/components/ui/empty-message";
import { cn } from "@/lib/utils";
import { Car, Fuel, Calendar, User, ArrowLeft, Settings, ShieldCheck, Wrench } from "lucide-react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { RESERVATION_STATUS, formatFechaHora, formatReservationRange } from "@/lib/vehicle-reservations";
import { formatFecha, formatFechaCalendario } from "@/lib/fechas";

export const metadata = { title: "Vehículo" };

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vehicle = await getVehicleWithHistory(id);

  if (!vehicle) notFound();

  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  // Ahora: en uso (salió y no volvió), reservado para este momento, o libre.
  const enUso = vehicle.reservations.find((r) => r.status === "EN_CURSO");
  const reservadoAhora = vehicle.reservations.find((r) => r.status === "APROBADA" && r.startDate <= now && r.endDate >= now);
  const ahora =
    vehicle.status === "EN_TALLER" ? "En el taller" :
    vehicle.status === "FUERA_DE_SERVICIO" ? "Fuera de servicio" :
    enUso ? `En uso ahora · ${enUso.user?.name || "sin nombre"}, ${enUso.endDate < now ? "tenía que volver el" : "vuelve el"} ${formatFechaHora(enUso.endDate)}` :
    reservadoAhora ? `Reservado ahora · ${reservadoAhora.user?.name || "sin nombre"}` :
    "Libre ahora";

  const isVtvClose = vehicle.vtvExpiry && new Date(vehicle.vtvExpiry) < thirtyDaysFromNow;
  const isInsClose = vehicle.insuranceExpiry && new Date(vehicle.insuranceExpiry) < thirtyDaysFromNow;

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title={`${vehicle.brand} ${vehicle.model}`}
        icon={Car}
        description={
          <span className="mt-1 inline-flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 bg-muted text-foreground font-mono font-bold text-xs border-b-2 border-border/80 rounded">
              {vehicle.plate}
            </span>
            <span className={cn(badgeVariants(),
              vehicle.status === 'DISPONIBLE' && (enUso || reservadoAhora) ? "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border dark:border-amber-500/20" :
              vehicle.status === 'DISPONIBLE' ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border dark:border-emerald-500/20" :
              vehicle.status === 'EN_TALLER' ? "bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border dark:border-rose-500/20" :
              "bg-muted text-muted-foreground hover:bg-muted"
            )}>
              {ahora}
            </span>
          </span>
        }
        actions={
          <Button variant="ghost" size="icon" asChild className="rounded-full">
            <Link href="/admin/vehicles" aria-label="Volver a vehículos"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
        }
      />

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Stats and Info */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="rounded-2xl border border-border/60 shadow-xs bg-card text-card-foreground overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/40">
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5 text-muted-foreground" /> Ficha técnica
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Último service</span>
                <span className="font-bold text-foreground">{vehicle.lastServiceKm?.toLocaleString("es-AR") || 0} KM</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Tarjeta YPF</span>
                <span className="font-mono text-sm text-foreground">{vehicle.fuelCardNumber || "N/A"}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Cupo mensual</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">${Number(vehicle.fuelMonthlyLimit || 0).toLocaleString("es-AR")}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/60 shadow-xs bg-card text-card-foreground overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/40">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-muted-foreground" /> Documentación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                   <span className="text-sm font-semibold text-foreground">Vencimiento VTV</span>
                   <span className="text-xs text-muted-foreground">Revisión técnica</span>
                </div>
                <Badge variant={isVtvClose ? "destructive" : "outline"} className="rounded-lg">
                  {vehicle.vtvExpiry ? formatFechaCalendario(vehicle.vtvExpiry) : "No registrado"}
                </Badge>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                   <span className="text-sm font-semibold text-foreground">Vencimiento seguro</span>
                   <span className="text-xs text-muted-foreground">Póliza vigente</span>
                </div>
                <Badge variant={isInsClose ? "destructive" : "outline"} className="rounded-lg">
                  {vehicle.insuranceExpiry ? formatFechaCalendario(vehicle.insuranceExpiry) : "No registrado"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Button variant="outline" className="w-full rounded-2xl border-dashed border-2 py-8 text-muted-foreground hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all">
             <Wrench className="h-5 w-5 mr-2" /> Reportar problema / ingreso a taller
          </Button>
        </div>

        {/* Right Column: Tables */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-2xl border border-border/60 shadow-xs bg-card text-card-foreground overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/40">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" /> Historial de reservas
              </CardTitle>
              <CardDescription className="text-muted-foreground">Registro histórico de uso por parte de las áreas.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="border-border/40">
                    <TableHead className="text-muted-foreground font-semibold">Fecha</TableHead>
                    <TableHead className="text-muted-foreground font-semibold">Solicitante</TableHead>
                    <TableHead className="text-muted-foreground font-semibold">Motivo</TableHead>
                    <TableHead className="text-muted-foreground font-semibold">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicle.reservations.map((res) => (
                    <TableRow key={res.id} className="hover:bg-muted/30 transition-colors border-border/40">
                      <TableCell className="text-sm font-medium text-foreground">
                        {formatReservationRange(res.startDate, res.endDate)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-foreground">{res.user?.name || "Desconocido"}</span>
                          <span className="text-xs text-muted-foreground font-bold tracking-tight">{(res.user as any)?.area?.name || "Administración"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate" title={res.reason || ""}>
                        {res.reason}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs font-bold rounded-full ${RESERVATION_STATUS[res.status].className}`}>
                          {RESERVATION_STATUS[res.status].label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {vehicle.reservations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4}><EmptyMessage compact title="Este vehículo todavía no tiene reservas" /></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/60 shadow-xs bg-card text-card-foreground overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/40">
              <CardTitle className="text-lg flex items-center gap-2">
                <Fuel className="h-5 w-5 text-emerald-500" /> Cargas de combustible
              </CardTitle>
              <CardDescription className="text-muted-foreground">Rendiciones de ticket YPF en Ruta.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="border-border/40">
                    <TableHead className="text-muted-foreground font-semibold">Fecha</TableHead>
                    <TableHead className="text-muted-foreground font-semibold">Importe</TableHead>
                    <TableHead className="text-muted-foreground font-semibold">Litros</TableHead>
                    <TableHead className="text-muted-foreground font-semibold">Ticket</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicle.fuelRecords.map((fuel) => (
                    <TableRow key={fuel.id} className="hover:bg-muted/30 transition-colors border-border/40">
                      <TableCell className="text-sm text-foreground">
                        {formatFecha(fuel.date)}
                      </TableCell>
                      <TableCell className="font-bold text-emerald-700 dark:text-emerald-400">
                        ${Number(fuel.amount).toLocaleString("es-AR")}
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-foreground">
                        {Number(fuel.liters).toFixed(2)} L
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {fuel.ticketNumber}
                      </TableCell>
                    </TableRow>
                  ))}
                  {vehicle.fuelRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4}><EmptyMessage compact title="Todavía no hay cargas de combustible" /></TableCell>
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
