export const dynamic = "force-dynamic";

import { getVehicleWithHistory } from "@/services/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyMessage } from "@/components/ui/empty-message";
import { cn } from "@/lib/utils";
import { Car, Fuel, Calendar, ShieldCheck, Wrench } from "lucide-react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { StatCard } from "@/components/ui/stat-card";
import { StatRow } from "@/components/ui/mobile-list";
import { getAreaShortName } from "@/lib/area-theme";
import { RESERVATION_STATUS, formatFechaHora, formatReservationRange } from "@/lib/vehicle-reservations";
import { formatFecha, formatFechaCalendario } from "@/lib/fechas";
import { vehicleTitle } from "@/lib/page-titles";
import { formatPesos, formatNumber } from "@/lib/formato";

export const generateMetadata = vehicleTitle;

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
    vehicle.status === "EN_TALLER"
      ? "En el taller"
      : vehicle.status === "FUERA_DE_SERVICIO"
        ? "Fuera de servicio"
        : enUso
          ? `En uso ahora · ${enUso.user?.name || "sin nombre"}, ${enUso.endDate < now ? "tenía que volver el" : "vuelve el"} ${formatFechaHora(enUso.endDate)}`
          : reservadoAhora
            ? `Reservado ahora · ${reservadoAhora.user?.name || "sin nombre"}`
            : "Libre ahora";

  const isVtvClose = Boolean(vehicle.vtvExpiry && new Date(vehicle.vtvExpiry) < thirtyDaysFromNow);
  const isInsClose = Boolean(vehicle.insuranceExpiry && new Date(vehicle.insuranceExpiry) < thirtyDaysFromNow);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const fuelMonth = vehicle.fuelRecords.filter((r) => r.date >= monthStart).reduce((t, r) => t + Number(r.amount), 0);
  const fuelLimit = Number(vehicle.fuelMonthlyLimit || 0);
  const canReserve = vehicle.status === "DISPONIBLE";
  const statusClass =
    vehicle.status === "DISPONIBLE" && (enUso || reservadoAhora)
      ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
      : vehicle.status === "DISPONIBLE"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : vehicle.status === "EN_TALLER"
          ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
          : "bg-muted text-muted-foreground";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${vehicle.brand} ${vehicle.model}`}
        icon={Car}
        badge={<span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">{vehicle.plate}</span>}
        description={
          // Va dentro de un párrafo: tiene que ser un span, no un Badge (que es un div).
          <span className={cn("mt-1 inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold", statusClass)}>{ahora}</span>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/admin/vehicles/fuel">
                <Fuel className="mr-2 h-4 w-4" /> Cargar combustible
              </Link>
            </Button>
            {canReserve && (
              <Button asChild>
                <Link href={`/admin/vehicles/reserve?id=${vehicle.id}`}>
                  <Calendar className="mr-2 h-4 w-4" /> Reservar
                </Link>
              </Button>
            )}
          </>
        }
      />

      <StatRow>
        <StatCard
          label="Combustible del mes"
          value={formatPesos(fuelMonth)}
          hint={fuelLimit > 0 ? `de ${formatPesos(fuelLimit)} de cupo` : "Sin cupo cargado"}
          icon={Fuel}
          tone="blue"
        />
        <StatCard
          label="Último service"
          value={vehicle.lastServiceKm ? `${formatNumber(vehicle.lastServiceKm)} km` : "Sin cargar"}
          icon={Wrench}
          tone="slate"
        />
        <StatCard
          label="VTV"
          value={vehicle.vtvExpiry ? formatFechaCalendario(vehicle.vtvExpiry) : "Sin cargar"}
          hint={isVtvClose ? "Vence en menos de 30 días" : vehicle.vtvExpiry ? "Fecha de vencimiento" : "Falta la fecha de vencimiento"}
          icon={ShieldCheck}
          tone={isVtvClose ? "red" : vehicle.vtvExpiry ? "green" : "slate"}
        />
        <StatCard
          label="Seguro"
          value={vehicle.insuranceExpiry ? formatFechaCalendario(vehicle.insuranceExpiry) : "Sin cargar"}
          hint={
            isInsClose ? "Vence en menos de 30 días" : vehicle.insuranceExpiry ? "Fecha de vencimiento" : "Falta la fecha de vencimiento"
          }
          icon={ShieldCheck}
          tone={isInsClose ? "red" : vehicle.insuranceExpiry ? "green" : "slate"}
        />
      </StatRow>

      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Reservas</CardTitle>
          <CardDescription>Quién lo usó o lo va a usar, y para qué.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 md:px-6 md:pb-6">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-semibold">Fecha</TableHead>
                <TableHead className="text-xs font-semibold">Quién</TableHead>
                <TableHead className="text-xs font-semibold">Motivo</TableHead>
                <TableHead className="text-xs font-semibold">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicle.reservations.map((res) => (
                <TableRow key={res.id}>
                  <TableCell className="text-sm text-foreground">{formatReservationRange(res.startDate, res.endDate)}</TableCell>
                  <TableCell>
                    <p className="text-sm font-medium text-foreground">{res.user?.name || "Sin nombre"}</p>
                    <p className="text-xs text-muted-foreground">
                      {res.user?.area?.name ? getAreaShortName(res.user.area.name) : "Sin área"}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-[16rem] text-sm text-muted-foreground">
                    <span className="block truncate" title={res.reason || undefined}>
                      {res.reason || "Sin motivo"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={RESERVATION_STATUS[res.status].className}>
                      {RESERVATION_STATUS[res.status].label}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {vehicle.reservations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <EmptyMessage compact title="Este vehículo todavía no tiene reservas" />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cargas de combustible</CardTitle>
          <CardDescription>
            {vehicle.fuelCardNumber
              ? `Con la tarjeta ${vehicle.fuelCardNumber}.`
              : "Este vehículo no tiene tarjeta de combustible cargada."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 md:px-6 md:pb-6">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-semibold">Fecha</TableHead>
                <TableHead className="text-right text-xs font-semibold">Importe</TableHead>
                <TableHead className="text-right text-xs font-semibold">Litros</TableHead>
                <TableHead className="text-xs font-semibold">Ticket</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicle.fuelRecords.map((fuel) => (
                <TableRow key={fuel.id}>
                  <TableCell className="text-sm text-foreground">{formatFecha(fuel.date)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-foreground">
                    {formatPesos(Number(fuel.amount))}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-foreground">
                    {formatNumber(Number(fuel.liters), 2)} L
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fuel.ticketNumber || "Sin ticket"}</TableCell>
                </TableRow>
              ))}
              {vehicle.fuelRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <EmptyMessage compact title="Todavía no hay cargas de combustible" />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
