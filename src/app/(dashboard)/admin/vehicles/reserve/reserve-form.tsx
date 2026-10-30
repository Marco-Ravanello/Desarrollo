"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { reservationStatusLabel } from "@/lib/vehicle-reservations";
import { createVehicleReservationAction } from "../../actions/vehicle-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Info, Calendar, Clock, User, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { RequiredMark } from "@/components/ui/form-section";

export function ReserveVehicleForm({ vehicleId, vehicles }: { vehicleId: string, vehicles: any[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicleId || (vehicles[0]?.id || ""));
  const [startDateStr, setStartDateStr] = useState<string>("");
  const [endDateStr, setEndDateStr] = useState<string>("");

  const selectedVehicle = useMemo(() => {
    return vehicles.find(v => v.id === selectedVehicleId);
  }, [vehicles, selectedVehicleId]);

  const existingReservations = useMemo(() => {
    if (!selectedVehicle?.reservations) return [];
    return selectedVehicle.reservations;
  }, [selectedVehicle]);

  const conflictReservation = useMemo(() => {
    if (!startDateStr || !endDateStr || !existingReservations.length) return null;
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

    return existingReservations.find((r: any) => {
      const rStart = new Date(r.startDate);
      const rEnd = new Date(r.endDate);
      return start < rEnd && end > rStart;
    });
  }, [startDateStr, endDateStr, existingReservations]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (startDateStr && endDateStr && new Date(endDateStr) <= new Date(startDateStr)) {
      toast.error("La devolución tiene que ser después de la salida.");
      return;
    }

    if (conflictReservation) {
      toast.error("Ese horario choca con otra reserva. Elegí otro horario u otro vehículo.");
      return;
    }

    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.set("vehicleId", selectedVehicleId);

    const res = await createVehicleReservationAction(formData);

    if (res.success) {
      toast.success("Solicitud de reserva enviada correctamente");
      router.push("/admin/vehicles");
    } else {
      toast.error(res.error || "Error al enviar la solicitud");
    }
    setLoading(false);
  }

  const formatRange = (start: Date | string, end: Date | string) => {
    const s = new Date(start);
    const e = new Date(end);
    return `${format(s, "dd/MM/yyyy HH:mm 'hs'", { locale: es })} a ${format(e, "dd/MM/yyyy HH:mm 'hs'", { locale: es })}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        <Card className="bg-card text-card-foreground shadow-xs border border-border/60 rounded-2xl overflow-hidden">
          <CardHeader className="bg-muted/20 border-b border-border/40 p-6">
            <CardTitle className="text-2xl font-bold text-foreground">Solicitar vehículo</CardTitle>
            <CardDescription className="text-muted-foreground text-xs font-medium">
              Completá los datos para que Logística apruebe tu pedido de traslado.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="vehicleId" className="text-xs font-bold text-muted-foreground">
                  Seleccionar unidad municipal
                </Label>
                <Combobox
                  name="vehicleId"
                  defaultValue={selectedVehicleId}
                  placeholder="Buscar por patente, marca o modelo..."
                  options={vehicles
                    .filter(v => v.status === 'DISPONIBLE')
                    .map(v => ({ value: v.id, label: `${v.plate} - ${v.brand} ${v.model}` }))
                  }
                  onValueChange={(val: string) => setSelectedVehicleId(val)}
                  required
                />
                <p className="text-xs text-muted-foreground italic">Solo se muestran unidades disponibles y fuera de taller.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="startDate" className="text-xs font-bold text-muted-foreground">
                    Fecha y hora de inicio <RequiredMark />
                  </Label>
                  <Input
                    id="startDate"
                    name="startDate"
                    type="datetime-local"
                    value={startDateStr}
                    onChange={e => setStartDateStr(e.target.value)}
                    required
                    className={`rounded-xl bg-background text-foreground border-border/60 text-xs ${
                      conflictReservation ? "border-rose-500 focus-visible:ring-rose-500" : ""
                    }`}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate" className="text-xs font-bold text-muted-foreground">
                    Fecha y hora de devolución <RequiredMark />
                  </Label>
                  <Input
                    id="endDate"
                    name="endDate"
                    type="datetime-local"
                    value={endDateStr}
                    onChange={e => setEndDateStr(e.target.value)}
                    required
                    className={`rounded-xl bg-background text-foreground border-border/60 text-xs ${
                      conflictReservation ? "border-rose-500 focus-visible:ring-rose-500" : ""
                    }`}
                  />
                </div>
              </div>

              {conflictReservation && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 space-y-2 animate-in fade-in duration-300">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                    ¡Conflicto de horario detectado!
                  </div>
                  <p className="text-xs leading-relaxed">
                    Esta unidad ya cuenta con una reserva registrada por <b>{conflictReservation.user?.name || "otro agente"}</b> en el período seleccionado:
                  </p>
                  <div className="p-2.5 rounded-xl bg-rose-500/15 font-mono text-xs font-bold">
                    📅 {formatRange(conflictReservation.startDate, conflictReservation.endDate)} ({reservationStatusLabel(conflictReservation.status).toLowerCase()})
                  </div>
                  <p className="text-xs italic">Cambiá la fecha u hora, o elegí otro vehículo.</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reason" className="text-xs font-bold text-muted-foreground">
                  Motivo del uso y destino <RequiredMark />
                </Label>
                <Input
                  id="reason"
                  name="reason"
                  placeholder="Ej: Traslado de insumos de emergencia a B° San Martín"
                  required
                  className="rounded-xl bg-background text-foreground border-border/60 text-xs"
                />
              </div>

              <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex gap-3 items-start text-xs text-foreground">
                 <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                 <div className="leading-relaxed">
                   <strong>Nota de logística:</strong> El envío de este formulario genera una solicitud. Recibirá una notificación una vez que sea aprobada por el área de administración de flota.
                 </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1 rounded-xl border-border/60 text-foreground" onClick={() => router.back()}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading || Boolean(conflictReservation)}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-md font-bold text-xs h-11"
                >
                  {loading ? "Enviando pedido…" : "Pedir reserva"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-1 space-y-4">
        <Card className="bg-card text-card-foreground shadow-xs border border-border/60 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-border/40 pb-3">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-foreground">Horarios ocupados</h3>
              <p className="text-xs text-muted-foreground">Reservas activas para la unidad elegida</p>
            </div>
          </div>

          {selectedVehicle ? (
            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-muted/40 border border-border/40 space-y-1">
                <p className="text-xs font-bold text-foreground">{selectedVehicle.brand} {selectedVehicle.model}</p>
                <Badge variant="outline" className="font-mono text-xs font-bold text-foreground border-border">{selectedVehicle.plate}</Badge>
              </div>

              {existingReservations.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-700 dark:text-emerald-400 mx-auto" />
                  <p className="text-xs font-bold">Unidad sin reservas próximas</p>
                  <p className="text-xs italic">Está completamente disponible en todos los horarios.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {existingReservations.map((r: any) => {
                    const isPending = r.status === 'PENDIENTE';
                    const isApproved = r.status === 'APROBADA';
                    const isOngoing = r.status === 'EN_CURSO';

                    return (
                      <div
                        key={r.id}
                        className={`p-3.5 rounded-2xl border transition-all text-xs space-y-2 ${
                          isOngoing ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300" :
                          isApproved ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300" :
                          "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {isOngoing ? "En uso" : isApproved ? "Aprobada" : "Pendiente"}
                          </span>
                          <Badge variant="secondary" className="text-xs font-bold">
                            {reservationStatusLabel(r.status)}
                          </Badge>
                        </div>

                        <div className="space-y-1 font-mono text-xs font-bold">
                          <p>Inicio: {format(new Date(r.startDate), "dd/MM/yyyy HH:mm", { locale: es })} hs</p>
                          <p>Fin: {format(new Date(r.endDate), "dd/MM/yyyy HH:mm", { locale: es })} hs</p>
                        </div>

                        <div className="pt-2 border-t border-border/20 flex items-center gap-1.5 text-xs font-medium opacity-90">
                          <User className="h-3 w-3 shrink-0" />
                          <span className="truncate">Reservado por: <b>{r.user?.name || "Agente municipal"}</b></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic p-4 text-center">Elegí un vehículo para ver sus reservas.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
