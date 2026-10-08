"use client";

import { useState } from "react";
import { EmergencyOperationsData, StormVictimItem } from "@/types/emergency";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet, FileText, Package, Plus,
  Download, RefreshCw, UserCheck, ShieldAlert, Users, Baby
} from "lucide-react";
import { StormSheetTable } from "@/components/emergency/storm-sheet-table";
import { StormFichaDialog } from "@/components/emergency/storm-ficha-dialog";
import { StormStockTab } from "@/components/emergency/storm-stock-tab";
import { exportStormSheetToExcel } from "@/lib/export-storm-excel";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface EmergencyViewProps {
  initialData: EmergencyOperationsData;
}

export function EmergencyView({ initialData }: EmergencyViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"sheet" | "fichas" | "stock">("sheet");
  const [isFichaOpen, setIsFichaOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<StormVictimItem | null>(null);

  const { operator, stock, records, metrics } = initialData;

  const handleOpenNewFicha = () => {
    setSelectedRecord(null);
    setIsFichaOpen(true);
  };

  const handleOpenEditFicha = (record: StormVictimItem) => {
    setSelectedRecord(record);
    setIsFichaOpen(true);
  };

  const handleExportExcel = () => {
    if (records.length === 0) {
      toast.error("No hay registros en la planilla para exportar.");
      return;
    }
    exportStormSheetToExcel(records, operator);
    toast.success("Planilla Oficial descargada en formato Excel (.xlsx)");
  };

  const handleRefresh = () => {
    router.refresh();
    toast.info("Datos actualizados");
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      {/* Header Institucional de Contingencia con Responsable y Área Automáticos */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 text-white p-6 sm:p-8 rounded-[2.5rem] border border-amber-500/20 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                <ShieldAlert className="h-8 w-8 animate-pulse" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                  Relevamiento Territorial y Ficha de Tormenta
                </h2>
                <p className="text-xs text-amber-300 font-bold uppercase tracking-wider mt-0.5">
                  Planilla Oficial de Contingencia Climática • Municipalidad de Tres de Febrero
                </p>
              </div>
            </div>

            {/* Fila Automática Responsable & Área */}
            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs">
              <div className="bg-white/10 px-3.5 py-1.5 rounded-xl border border-white/10 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-amber-400" />
                <span>RESPONSABLE: <b className="text-white uppercase">{operator.name}</b></span>
              </div>
              <div className="bg-white/10 px-3.5 py-1.5 rounded-xl border border-white/10 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-emerald-400" />
                <span>ÁREA: <b className="text-white uppercase">{operator.areaName}</b></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={handleExportExcel}
              variant="outline"
              className="bg-emerald-600 hover:bg-emerald-700 text-white border-none rounded-2xl h-11 px-5 font-bold text-xs"
            >
              <Download className="mr-2 h-4 w-4" /> Exportar Excel Oficial
            </Button>
            <Button
              onClick={handleOpenNewFicha}
              className="bg-amber-500 hover:bg-amber-600 text-black font-black rounded-2xl h-11 px-5 text-xs shadow-lg"
            >
              <Plus className="mr-2 h-4 w-4" /> Nueva Ficha Tormenta
            </Button>
          </div>
        </div>
      </div>

      {/* Tarjetas Resumen Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-3xl border-border/50 shadow-sm bg-card">
          <CardContent className="p-5 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Damnificados</span>
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl"><Users className="h-4 w-4" /></div>
            </div>
            <p className="text-2xl font-black text-foreground">{metrics.totalVictims}</p>
            <p className="text-[11px] text-muted-foreground font-semibold">Registrados en planilla</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/50 shadow-sm bg-card">
          <CardContent className="p-5 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Niños Afectados</span>
              <div className="p-2 bg-purple-500/10 text-purple-500 rounded-xl"><Baby className="h-4 w-4" /></div>
            </div>
            <p className="text-2xl font-black text-foreground">{metrics.totalChildren}</p>
            <p className="text-[11px] text-muted-foreground font-semibold">Menores contabilizados</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/50 shadow-sm bg-card">
          <CardContent className="p-5 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Colchones / Frazadas</span>
              <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl"><Package className="h-4 w-4" /></div>
            </div>
            <p className="text-2xl font-black text-foreground">{metrics.totalColchones} / {metrics.totalFrazadas}</p>
            <p className="text-[11px] text-muted-foreground font-semibold">Unidades requeridas</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/50 shadow-sm bg-card">
          <CardContent className="p-5 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Prioridad Alta</span>
              <div className="p-2 bg-rose-500/10 text-rose-500 rounded-xl"><ShieldAlert className="h-4 w-4" /></div>
            </div>
            <p className="text-2xl font-black text-rose-600">{metrics.highPriorityCount}</p>
            <p className="text-[11px] text-rose-500 font-semibold">Urgencias territoriales</p>
          </CardContent>
        </Card>
      </div>

      {/* Navegación por 3 Pestañas Principal */}
      <div className="flex items-center gap-2 p-1.5 bg-muted/40 rounded-2xl border border-border/50 max-w-2xl">
        <button
          onClick={() => setActiveTab("sheet")}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === "sheet"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>Planilla Relevamiento ({records.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("fichas")}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === "fichas"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Fichas Tormenta</span>
        </button>

        <button
          onClick={() => setActiveTab("stock")}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === "stock"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package className="h-4 w-4" />
          <span>Stock de Contingencia</span>
        </button>
      </div>

      {/* Pestaña 1: Planilla Relevamiento Territorial (Excel Exacto) */}
      {activeTab === "sheet" && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <StormSheetTable
            records={records}
            operatorName={operator.name}
            areaName={operator.areaName}
            onOpenFicha={handleOpenEditFicha}
            onRefresh={handleRefresh}
          />
        </div>
      )}

      {/* Pestaña 2: Fichas Tormenta Individuales */}
      {activeTab === "fichas" && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider">
              Fichas Individuales Generadas ({records.length})
            </h3>
            <Button
              onClick={handleOpenNewFicha}
              className="rounded-xl h-10 px-4 text-xs font-bold bg-primary text-primary-foreground"
            >
              <Plus className="mr-2 h-4 w-4" /> Cargar Nueva Ficha
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {records.map((r, idx) => (
              <Card key={r.id || idx} className="rounded-3xl border-border/60 shadow-sm bg-card p-5 space-y-3">
                <div className="flex justify-between items-start">
                  <Badge variant="outline" className={`text-[10px] font-black uppercase ${
                    r.prioridad === 'ALTA' ? 'bg-rose-500/10 text-rose-600 border-rose-500/30' : 'bg-amber-500/10 text-amber-600'
                  }`}>
                    Prioridad {r.prioridad}
                  </Badge>
                  <span className="text-[10px] font-mono text-muted-foreground">Ficha #{idx + 1}</span>
                </div>

                <div>
                  <h4 className="text-base font-black text-foreground uppercase">{r.nombreApellido}</h4>
                  <p className="text-xs text-muted-foreground">DNI: {r.dni || "S/D"} • Edad: {r.edad || "N/A"}</p>
                  <p className="text-xs font-semibold text-foreground mt-1">{r.domicilio} {r.barrio ? `(${r.barrio})` : ""}</p>
                </div>

                <div className="pt-2 border-t border-border/40 text-xs space-y-1">
                  <p className="font-bold text-muted-foreground">Elementos Asignados:</p>
                  <div className="flex flex-wrap gap-1">
                    {r.cantidadColchon > 0 && <Badge variant="secondary" className="text-[9px]">{r.cantidadColchon} Colchones</Badge>}
                    {r.cantidadCama > 0 && <Badge variant="secondary" className="text-[9px]">{r.cantidadCama} Camas</Badge>}
                    {r.cantidadCucheta > 0 && <Badge variant="secondary" className="text-[9px]">{r.cantidadCucheta} Cuchetas</Badge>}
                    {r.cantidadFrazada > 0 && <Badge variant="secondary" className="text-[9px]">{r.cantidadFrazada} Frazadas</Badge>}
                  </div>
                </div>

                <Button
                  onClick={() => handleOpenEditFicha(r)}
                  variant="outline"
                  className="w-full rounded-xl text-xs font-bold h-9 mt-2"
                >
                  <FileText className="mr-2 h-3.5 w-3.5" /> Abrir / Imprimir Ficha
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Pestaña 3: Stock de Contingencia */}
      {activeTab === "stock" && (
        <div className="animate-in fade-in duration-300">
          <StormStockTab stock={stock} onRefresh={handleRefresh} />
        </div>
      )}

      {/* Modal Interactivo Ficha Tormenta */}
      <StormFichaDialog
        open={isFichaOpen}
        onOpenChange={setIsFichaOpen}
        initialRecord={selectedRecord}
        operatorName={operator.name}
        areaName={operator.areaName}
        onSaved={handleRefresh}
      />
    </div>
  );
}
