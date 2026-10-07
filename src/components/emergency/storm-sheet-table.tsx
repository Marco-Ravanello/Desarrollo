"use client";

import { useState } from "react";
import { StormVictimItem, SearchPersonSuggestion } from "@/types/emergency";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Trash2, Plus, Search, Filter, Sparkles, UserCheck } from "lucide-react";
import { toast } from "sonner";
import {
  searchPeopleForEmergencyAction,
  saveStormVictimAction,
  deleteStormVictimAction
} from "@/app/(dashboard)/admin/actions/emergency-actions";

interface StormSheetTableProps {
  records: StormVictimItem[];
  operatorName: string;
  areaName: string;
  onOpenFicha: (record: StormVictimItem) => void;
  onRefresh: () => void;
}

export function StormSheetTable({
  records,
  operatorName,
  areaName,
  onOpenFicha,
  onRefresh,
}: StormSheetTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");

  // State for fast-add row at the bottom
  const [fastNombre, setFastNombre] = useState("");
  const [fastDni, setFastDni] = useState("");
  const [fastGrupoFam, setFastGrupoFam] = useState(false);
  const [fastNinos, setFastNinos] = useState("0");
  const [fastDomicilio, setFastDomicilio] = useState("");
  const [fastRef, setFastRef] = useState("");

  const [fastReqColchon, setFastReqColchon] = useState(false);
  const [fastCantColchon, setFastCantColchon] = useState(0);
  const [fastReqCama, setFastReqCama] = useState(false);
  const [fastCantCama, setFastCantCama] = useState(0);
  const [fastReqCucheta, setFastReqCucheta] = useState(false);
  const [fastCantCucheta, setFastCantCucheta] = useState(0);
  const [fastReqFrazada, setFastReqFrazada] = useState(false);
  const [fastCantFrazada, setFastCantFrazada] = useState(0);

  const [fastObs, setFastObs] = useState("");
  const [suggestions, setSuggestions] = useState<SearchPersonSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const handleSearchName = async (val: string) => {
    setFastNombre(val);
    if (val.trim().length >= 3) {
      const res = await searchPeopleForEmergencyAction(val);
      setSuggestions(res);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (s: SearchPersonSuggestion) => {
    setFastNombre(s.nombreApellido);
    setFastDni(s.dni);
    if (s.domicilio) setFastDomicilio(s.domicilio);
    if (s.barrio && !fastRef) setFastRef(`Barrio ${s.barrio}`);
    setFastGrupoFam(s.grupoFamiliar);
    if (s.ninos) setFastNinos(s.ninos);
    setShowSuggestions(false);
    toast.success("Sugerencia de padrón aplicada a la fila rápida");
  };

  const handleFastAdd = async () => {
    if (!fastNombre.trim() || !fastDomicilio.trim()) {
      toast.error("Complete 'Nombre y Apellido' y 'Domicilio' para agregar");
      return;
    }

    setIsAdding(true);
    const toastId = toast.loading("Agregando fila y generando expediente...");

    const payload: Partial<StormVictimItem> = {
      nombreApellido: fastNombre,
      dni: fastDni,
      grupoFamiliar: fastGrupoFam,
      ninos: fastNinos,
      domicilio: fastDomicilio,
      referencia: fastRef,
      requiereColchon: fastReqColchon,
      cantidadColchon: fastReqColchon ? Math.max(1, fastCantColchon) : 0,
      requiereCama: fastReqCama,
      cantidadCama: fastReqCama ? Math.max(1, fastCantCama) : 0,
      requiereCucheta: fastReqCucheta,
      cantidadCucheta: fastReqCucheta ? Math.max(1, fastCantCucheta) : 0,
      requiereFrazada: fastReqFrazada,
      cantidadFrazada: fastReqFrazada ? Math.max(1, fastCantFrazada) : 0,
      observaciones: fastObs,
      prioridad: "MEDIA",
      agentes: operatorName,
    };

    const res = await saveStormVictimAction(payload);
    setIsAdding(false);

    if (res.success) {
      toast.success("Fila agregada correctamente", { id: toastId });
      setFastNombre("");
      setFastDni("");
      setFastGrupoFam(false);
      setFastNinos("0");
      setFastDomicilio("");
      setFastRef("");
      setFastReqColchon(false);
      setFastCantColchon(0);
      setFastReqCama(false);
      setFastCantCama(0);
      setFastReqCucheta(false);
      setFastCantCucheta(0);
      setFastReqFrazada(false);
      setFastCantFrazada(0);
      setFastObs("");
      onRefresh();
    } else {
      toast.error(res.error || "Error al agregar fila", { id: toastId });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Está seguro de eliminar esta fila del relevamiento?")) return;
    const toastId = toast.loading("Eliminando registro...");
    const res = await deleteStormVictimAction(id);
    if (res.success) {
      toast.success("Registro eliminado", { id: toastId });
      onRefresh();
    } else {
      toast.error(res.error || "Error al eliminar", { id: toastId });
    }
  };

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      !searchTerm ||
      (r.nombreApellido || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.dni || "").includes(searchTerm) ||
      (r.domicilio || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPriority = priorityFilter === "ALL" || r.prioridad === priorityFilter;

    return matchesSearch && matchesPriority;
  });

  return (
    <div className="space-y-4">
      {/* Controles de Búsqueda y Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-card p-4 rounded-2xl border border-border/60">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por Nombre, DNI o Domicilio..."
            className="pl-9 h-9 rounded-xl text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-9 rounded-xl bg-background border border-border text-xs px-3 font-bold"
          >
            <option value="ALL">Todas las Prioridades</option>
            <option value="ALTA">Prioridad ALTA</option>
            <option value="MEDIA">Prioridad MEDIA</option>
            <option value="BAJA">Prioridad BAJA</option>
          </select>
        </div>
      </div>

      {/* Tabla Oficial Relevamiento Territorial (Exacta a Excel) */}
      <div className="rounded-2xl border border-border/60 overflow-x-auto bg-card shadow-sm">
        <Table className="min-w-[1200px] text-xs">
          <TableHeader className="bg-muted/50 border-b border-border/60">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 font-black text-center border-r border-border/40" rowSpan={2}>#</TableHead>
              <TableHead className="font-black border-r border-border/40" rowSpan={2}>Nombre y Apellido</TableHead>
              <TableHead className="font-black border-r border-border/40 w-28" rowSpan={2}>DNI</TableHead>
              <TableHead className="font-black border-r border-border/40 text-center w-20" rowSpan={2}>G. Fam.</TableHead>
              <TableHead className="font-black border-r border-border/40 text-center w-16" rowSpan={2}>Niños</TableHead>
              <TableHead className="font-black border-r border-border/40" rowSpan={2}>Domicilio / Referencia</TableHead>

              {/* Subencabezados Elementos */}
              <TableHead className="font-black text-center border-r border-border/40 bg-amber-500/10" colSpan={8}>
                ELEMENTOS (Consideración profesional)
              </TableHead>

              <TableHead className="font-black border-r border-border/40" rowSpan={2}>Observaciones / Contacto</TableHead>
              <TableHead className="font-black text-center w-28" rowSpan={2}>Acciones</TableHead>
            </TableRow>

            <TableRow className="hover:bg-transparent bg-amber-500/5">
              <TableHead className="text-center font-bold text-[10px] border-r border-border/30 w-12">Colchón</TableHead>
              <TableHead className="text-center font-bold text-[10px] border-r border-border/40 w-12">Cant.</TableHead>
              <TableHead className="text-center font-bold text-[10px] border-r border-border/30 w-12">Cama</TableHead>
              <TableHead className="text-center font-bold text-[10px] border-r border-border/40 w-12">Cant.</TableHead>
              <TableHead className="text-center font-bold text-[10px] border-r border-border/30 w-12">Cucheta</TableHead>
              <TableHead className="text-center font-bold text-[10px] border-r border-border/40 w-12">Cant.</TableHead>
              <TableHead className="text-center font-bold text-[10px] border-r border-border/30 w-12">Frazada</TableHead>
              <TableHead className="text-center font-bold text-[10px] border-r border-border/40 w-12">Cant.</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredRecords.map((r, idx) => (
              <TableRow key={r.id || idx} className="hover:bg-muted/30 transition-colors">
                <TableCell className="text-center font-bold border-r border-border/40">{idx + 1}</TableCell>
                <TableCell className="font-black uppercase border-r border-border/40">{r.nombreApellido}</TableCell>
                <TableCell className="font-mono border-r border-border/40">{r.dni || "-"}</TableCell>
                <TableCell className="text-center border-r border-border/40">
                  <Badge variant={r.grupoFamiliar ? "default" : "outline"} className="text-[10px]">
                    {r.grupoFamiliar ? "Sí" : "No"}
                  </Badge>
                </TableCell>
                <TableCell className="text-center font-bold border-r border-border/40">{r.ninos || "0"}</TableCell>
                <TableCell className="border-r border-border/40">
                  <div className="font-semibold">{r.domicilio}</div>
                  {r.referencia && <div className="text-[10px] text-muted-foreground">Ref: {r.referencia}</div>}
                  {r.barrio && <div className="text-[10px] text-primary font-bold">{r.barrio}</div>}
                </TableCell>

                {/* Elementos */}
                <TableCell className="text-center border-r border-border/30">
                  {r.requiereColchon ? <span className="font-bold text-amber-600">Sí</span> : <span className="text-muted-foreground">No</span>}
                </TableCell>
                <TableCell className="text-center font-bold border-r border-border/40">{r.cantidadColchon || 0}</TableCell>

                <TableCell className="text-center border-r border-border/30">
                  {r.requiereCama ? <span className="font-bold text-amber-600">Sí</span> : <span className="text-muted-foreground">No</span>}
                </TableCell>
                <TableCell className="text-center font-bold border-r border-border/40">{r.cantidadCama || 0}</TableCell>

                <TableCell className="text-center border-r border-border/30">
                  {r.requiereCucheta ? <span className="font-bold text-amber-600">Sí</span> : <span className="text-muted-foreground">No</span>}
                </TableCell>
                <TableCell className="text-center font-bold border-r border-border/40">{r.cantidadCucheta || 0}</TableCell>

                <TableCell className="text-center border-r border-border/30">
                  {r.requiereFrazada ? <span className="font-bold text-amber-600">Sí</span> : <span className="text-muted-foreground">No</span>}
                </TableCell>
                <TableCell className="text-center font-bold border-r border-border/40">{r.cantidadFrazada || 0}</TableCell>

                <TableCell className="border-r border-border/40 text-[11px]">
                  {r.observaciones && <div>{r.observaciones}</div>}
                  {r.contacto && <div className="text-muted-foreground font-semibold">Tel: {r.contacto}</div>}
                  <Badge variant="outline" className={`mt-1 text-[9px] font-black ${
                    r.prioridad === 'ALTA' ? 'bg-rose-500/10 text-rose-600 border-rose-500/30' : 'bg-amber-500/10 text-amber-600'
                  }`}>
                    {r.prioridad}
                  </Badge>
                </TableCell>

                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onOpenFicha(r)}
                      title="Ver / Editar Ficha Tormenta"
                      className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(r.id)}
                      title="Eliminar fila"
                      className="h-8 w-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {/* FILA INFERIOR INTERACTIVA DE CARGA RÁPIDA CONTINUA */}
            <TableRow className="bg-primary/5 border-t-2 border-primary/30">
              <TableCell className="text-center font-bold text-primary">+</TableCell>
              <TableCell className="relative">
                <Input
                  value={fastNombre}
                  onChange={(e) => handleSearchName(e.target.value)}
                  placeholder="Tipec Nombre o DNI..."
                  className="h-8 text-xs font-bold uppercase rounded-lg border-primary/40"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 bottom-10 z-50 w-72 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl max-h-48 overflow-y-auto p-1">
                    {suggestions.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectSuggestion(s)}
                        className="w-full text-left p-2 text-xs hover:bg-muted rounded-lg block font-semibold"
                      >
                        {s.nombreApellido} (DNI {s.dni})
                      </button>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <Input
                  value={fastDni}
                  onChange={(e) => setFastDni(e.target.value)}
                  placeholder="DNI"
                  className="h-8 text-xs rounded-lg"
                />
              </TableCell>
              <TableCell className="text-center">
                <Checkbox
                  checked={fastGrupoFam}
                  onCheckedChange={(c) => setFastGrupoFam(Boolean(c))}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={fastNinos}
                  onChange={(e) => setFastNinos(e.target.value)}
                  className="h-8 text-xs text-center rounded-lg"
                  min="0"
                />
              </TableCell>
              <TableCell>
                <Input
                  value={fastDomicilio}
                  onChange={(e) => setFastDomicilio(e.target.value)}
                  placeholder="Domicilio / Referencia..."
                  className="h-8 text-xs rounded-lg"
                />
              </TableCell>

              {/* Checkbox y Cantidades Rápidas */}
              <TableCell className="text-center">
                <Checkbox checked={fastReqColchon} onCheckedChange={(c) => { setFastReqColchon(Boolean(c)); if (c && fastCantColchon === 0) setFastCantColchon(1); }} />
              </TableCell>
              <TableCell>
                <Input type="number" value={fastCantColchon} onChange={(e) => setFastCantColchon(Number(e.target.value))} className="h-8 text-xs text-center p-0 rounded-lg" min="0" />
              </TableCell>

              <TableCell className="text-center">
                <Checkbox checked={fastReqCama} onCheckedChange={(c) => { setFastReqCama(Boolean(c)); if (c && fastCantCama === 0) setFastCantCama(1); }} />
              </TableCell>
              <TableCell>
                <Input type="number" value={fastCantCama} onChange={(e) => setFastCantCama(Number(e.target.value))} className="h-8 text-xs text-center p-0 rounded-lg" min="0" />
              </TableCell>

              <TableCell className="text-center">
                <Checkbox checked={fastReqCucheta} onCheckedChange={(c) => { setFastReqCucheta(Boolean(c)); if (c && fastCantCucheta === 0) setFastCantCucheta(1); }} />
              </TableCell>
              <TableCell>
                <Input type="number" value={fastCantCucheta} onChange={(e) => setFastCantCucheta(Number(e.target.value))} className="h-8 text-xs text-center p-0 rounded-lg" min="0" />
              </TableCell>

              <TableCell className="text-center">
                <Checkbox checked={fastReqFrazada} onCheckedChange={(c) => { setFastReqFrazada(Boolean(c)); if (c && fastCantFrazada === 0) setFastCantFrazada(1); }} />
              </TableCell>
              <TableCell>
                <Input type="number" value={fastCantFrazada} onChange={(e) => setFastCantFrazada(Number(e.target.value))} className="h-8 text-xs text-center p-0 rounded-lg" min="0" />
              </TableCell>

              <TableCell>
                <Input
                  value={fastObs}
                  onChange={(e) => setFastObs(e.target.value)}
                  placeholder="Observaciones..."
                  className="h-8 text-xs rounded-lg"
                />
              </TableCell>

              <TableCell className="text-center">
                <Button
                  onClick={handleFastAdd}
                  disabled={isAdding}
                  size="sm"
                  className="h-8 rounded-lg font-black text-xs bg-primary text-primary-foreground px-3"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Cargar
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
