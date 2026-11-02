"use client";

import { useMemo, useState } from "react";
import { StormVictimItem, EmergencyExtraItem } from "@/types/emergency";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { textoNormal } from "@/lib/formato";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { DELIVERY_STATUS_TONE, STORM_PRIORITY_TONE, toneOf } from "@/lib/status-tones";
import { FileText, Trash2, Plus, Search, Filter, PackageCheck } from "lucide-react";
import { DELIVERY_STATUS_LABEL, deliveryStatus, extraQuantityText } from "@/lib/emergency-categories";
import { toast } from "sonner";
import { deleteStormVictimAction } from "@/app/(dashboard)/admin/actions/emergency-actions";
import { SIN_BARRIO, STORM_BARRIOS, stormBarrioLabel } from "@/lib/storm-barrios";
import { confirmar } from "@/components/ui/confirm-dialog";
import { nombrePropio } from "@/lib/nombres";
import { filterSelectClass } from "@/components/ui/form-section";

interface StormSheetTableProps {
  records: StormVictimItem[];
  /** Ya no se usan acá (las fichas nuevas se cargan en su ficha); quedan por compatibilidad. */
  operatorName?: string;
  areaName?: string;
  onOpenFicha: (record: StormVictimItem) => void;
  onRefresh: () => void;
  userId?: string;
  /** Auditoría consulta pero no carga ni borra. */
  canEdit?: boolean;
  /** Abre el registro de entrega (solo para quien puede mover stock). */
  onDeliver?: (record: StormVictimItem) => void;
  /** Nombres de los otros insumos que se pueden pedir. */
  extraItems?: EmergencyExtraItem[];
  /** Abre una ficha nueva (con campos grandes) para cargar otra familia. */
  onNewFicha?: () => void;
}

export function StormSheetTable({
  records,
  onOpenFicha,
  onRefresh,
  canEdit = true,
  onDeliver,
  extraItems = [],
  onNewFicha,
}: StormSheetTableProps) {
  const extraNames = new Map(extraItems.map((i) => [i.id, i.name]));
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [barrioFilter, setBarrioFilter] = useState<string>("ALL");

  const handleDelete = async (id: string) => {
    if (!(await confirmar({ title: "¿Borrar esta fila del relevamiento?", confirmLabel: "Borrar", danger: true }))) return;
    const toastId = toast.loading("Eliminando registro...");
    const res = await deleteStormVictimAction(id);
    if (res.success) {
      toast.success("Registro eliminado", { id: toastId });
      onRefresh();
    } else {
      toast.error(res.error || "Error al eliminar", { id: toastId });
    }
  };

  // Barrios que aparecen en las fichas, en el orden de la lista y con cuántas fichas tiene cada uno.
  const barrioOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of records) counts.set(stormBarrioLabel(r.barrio), (counts.get(stormBarrioLabel(r.barrio)) || 0) + 1);
    const order = (b: string) => (b === SIN_BARRIO ? 1000 : (STORM_BARRIOS as readonly string[]).indexOf(b) === -1 ? 500 : (STORM_BARRIOS as readonly string[]).indexOf(b));
    return Array.from(counts.entries())
      .map(([barrio, n]) => ({ barrio, n }))
      .sort((a, b) => order(a.barrio) - order(b.barrio) || a.barrio.localeCompare(b.barrio, "es"));
  }, [records]);

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      !searchTerm ||
      (r.nombreApellido || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.dni || "").includes(searchTerm) ||
      (r.domicilio || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPriority = priorityFilter === "ALL" || r.prioridad === priorityFilter;
    const matchesBarrio = barrioFilter === "ALL" || stormBarrioLabel(r.barrio) === barrioFilter;

    return matchesSearch && matchesPriority && matchesBarrio;
  });

  // Totales de lo que se ve: familias, chicos y lo pedido de cada elemento.
  const totals = filteredRecords.reduce(
    (t, r) => ({
      familias: t.familias + 1,
      ninos: t.ninos + (Number(r.ninos) || 0),
      colchones: t.colchones + (r.requiereColchon ? Math.max(1, Number(r.cantidadColchon) || 0) : 0),
      camas: t.camas + (r.requiereCama ? Math.max(1, Number(r.cantidadCama) || 0) : 0),
      cuchetas: t.cuchetas + (r.requiereCucheta ? Math.max(1, Number(r.cantidadCucheta) || 0) : 0),
      frazadas: t.frazadas + (r.requiereFrazada ? Math.max(1, Number(r.cantidadFrazada) || 0) : 0),
    }),
    { familias: 0, ninos: 0, colchones: 0, camas: 0, cuchetas: 0, frazadas: 0 }
  );

  return (
    <div className="space-y-4">
      {/* Controles de Búsqueda y Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-card p-4 rounded-2xl border border-border/60">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, DNI o domicilio..."
            className="pl-9 h-9 rounded-xl text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <select
            value={barrioFilter}
            onChange={(e) => setBarrioFilter(e.target.value)}
            aria-label="Filtrar por barrio"
            className={`${filterSelectClass} h-9 max-w-[14rem]`}
          >
            <option value="ALL">Todos los barrios</option>
            {barrioOptions.map((o) => (
              <option key={o.barrio} value={o.barrio}>
                {o.barrio} ({o.n})
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por prioridad"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className={`${filterSelectClass} h-9 sm:w-auto`}
          >
            <option value="ALL">Todas las prioridades</option>
            <option value="ALTA">Prioridad alta</option>
            <option value="MEDIA">Prioridad media</option>
            <option value="BAJA">Prioridad baja</option>
          </select>
        </div>
      </div>

      {/* Totales de lo que se ve (con los filtros de arriba). */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SheetTotal label="Familias" value={totals.familias} />
        <SheetTotal label="Niños y niñas" value={totals.ninos} />
        <SheetTotal label="Colchones" value={totals.colchones} highlight />
        <SheetTotal label="Camas" value={totals.camas} highlight />
        <SheetTotal label="Cuchetas" value={totals.cuchetas} highlight />
        <SheetTotal label="Frazadas" value={totals.frazadas} highlight />
      </div>

      {/* Planilla compacta: lo pedido va en una sola columna; cada familia se carga en su ficha. */}
      <div className="rounded-2xl border border-border/60 overflow-x-auto bg-card shadow-sm">
        <Table mobileCards={false} className="min-w-[860px] text-sm">
          <TableHeader className="border-b border-border/60">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 text-center">#</TableHead>
              <TableHead>Familia</TableHead>
              <TableHead>Domicilio</TableHead>
              <TableHead>Pidió</TableHead>
              <TableHead className="w-40">Estado</TableHead>
              <TableHead className="w-28 text-right"><span className="sr-only">Acciones</span></TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredRecords.map((r, idx) => {
              const pedidos = pedidosDe(r, extraNames);
              const ninos = Number(r.ninos || 0);
              return (
              <TableRow key={r.id || idx} className="align-top">
                <TableCell className="text-center font-semibold text-muted-foreground tabular-nums">{idx + 1}</TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => onOpenFicha(r)}
                    className="text-left font-semibold text-foreground hover:text-primary hover:underline"
                  >
                    {nombrePropio(r.nombreApellido) || "Sin nombre"}
                  </button>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {r.dni ? `DNI ${r.dni}` : "Sin DNI"}
                    {r.grupoFamiliar ? " · Con grupo familiar" : ""}
                    {ninos > 0 ? ` · ${ninos === 1 ? "1 niño/a" : `${ninos} niños/as`}` : ""}
                  </div>
                  {r.contacto && <div className="text-xs text-muted-foreground tabular-nums">Tel. {r.contacto}</div>}
                </TableCell>
                <TableCell>
                  <div className="text-foreground">{r.domicilio}</div>
                  {(r.barrio || r.referencia) && (
                    <div className="text-xs text-muted-foreground">
                      {[r.barrio && stormBarrioLabel(r.barrio), r.referencia].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {pedidos.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {pedidos.map((p) => (
                        <span key={p} className="rounded-md bg-muni-orange/10 px-1.5 py-0.5 text-xs font-semibold text-[#9A4A07] dark:text-muni-orange">
                          {p}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Nada</span>
                  )}
                  {r.observaciones && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={r.observaciones}>{r.observaciones}</p>}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={toneOf(STORM_PRIORITY_TONE, r.prioridad)}>
                    {textoNormal(r.prioridad)}
                  </StatusBadge>
                  <DeliveryBadge record={r} />
                </TableCell>

                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onOpenFicha(r)}
                      title="Ver o editar la ficha"
                      aria-label="Ver o editar la ficha"
                      className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    {onDeliver && r.fromTable && ["PENDIENTE", "PARCIAL"].includes(deliveryStatus(r)) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onDeliver(r)}
                        title="Registrar entrega"
                        aria-label="Registrar entrega"
                        className="h-8 w-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-600"
                      >
                        <PackageCheck className="h-4 w-4" />
                      </Button>
                    )}
                    {canEdit && <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(r.id)}
                      title="Borrar la fila"
                      aria-label="Borrar la fila"
                      className="h-8 w-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>}
                  </div>
                </TableCell>
              </TableRow>
              );
            })}

            {filteredRecords.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {records.length === 0 ? "Todavía no hay familias cargadas." : "Ninguna familia coincide con la búsqueda."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {canEdit && onNewFicha && (
        <Button onClick={onNewFicha} variant="outline" className="h-11 w-full rounded-xl border-dashed text-sm font-semibold">
          <Plus className="mr-2 h-4 w-4" /> Cargar otra familia
        </Button>
      )}
    </div>
  );
}

/** Lo que pidió la familia, en frases cortas ("2 colchones", "1 frazada", "Otros: …"). */
function pedidosDe(r: StormVictimItem, extraNames: Map<string, string>): string[] {
  const out: string[] = [];
  const add = (pide: boolean | undefined, n: number | undefined, uno: string, varios: string) => {
    if (!pide) return;
    const cant = Math.max(1, Number(n || 0));
    out.push(`${cant} ${cant === 1 ? uno : varios}`);
  };
  add(r.requiereColchon, r.cantidadColchon, "colchón", "colchones");
  add(r.requiereCama, r.cantidadCama, "cama", "camas");
  add(r.requiereCucheta, r.cantidadCucheta, "cucheta", "cuchetas");
  add(r.requiereFrazada, r.cantidadFrazada, "frazada", "frazadas");
  for (const [id, n] of Object.entries(r.otrosElementos || {})) out.push(extraQuantityText(id, n, extraNames));
  return out;
}

function SheetTotal({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-3.5 py-2.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`font-heading text-xl font-bold tabular-nums ${highlight && value > 0 ? "text-[#C2410C] dark:text-muni-orange" : "text-[#163C68] dark:text-blue-100"}`}>
        {value.toLocaleString("es-AR")}
      </p>
    </div>
  );
}

/** Estado de la entrega de lo pedido en una ficha. */
export function DeliveryBadge({ record }: { record: StormVictimItem }) {
  const status = deliveryStatus(record);
  if (status === "SIN_PEDIDO") return null;
  return (
    <StatusBadge tone={toneOf(DELIVERY_STATUS_TONE, status)} className="mt-1 ml-1">
      {DELIVERY_STATUS_LABEL[status]}
    </StatusBadge>
  );
}
