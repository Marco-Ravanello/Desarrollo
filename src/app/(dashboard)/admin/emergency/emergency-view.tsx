"use client";

import { useCallback, useEffect, useState } from "react";
import { EmergencyOperationsData, StormVictimItem } from "@/types/emergency";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet, FileText, Package, Plus,
  Download, RefreshCw, UserCheck, ShieldAlert, Users, Baby, CloudRain, BarChart3, PackageCheck
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StormSheetTable } from "@/components/emergency/storm-sheet-table";
import { StormFichaDialog } from "@/components/emergency/storm-ficha-dialog";
import { StormStockTab } from "@/components/emergency/storm-stock-tab";
import { StormSummaryTab } from "@/components/emergency/storm-summary-tab";
import { StormDeliveryDialog } from "@/components/emergency/storm-delivery-dialog";
import { DeliveryBadge } from "@/components/emergency/storm-sheet-table";
import { deliveryStatus } from "@/lib/emergency-categories";
import { OfflineFichasPanel, useOfflineFichas } from "@/components/emergency/offline-fichas-panel";
import { exportStormSheetToExcel } from "@/lib/export-storm-excel";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface EmergencyViewProps {
  initialData: EmergencyOperationsData;
  /** Llegó redirigido desde una pantalla que su rol no puede abrir. */
  deniedAccess?: boolean;
}

/** Le pasa al modo sin conexión (public/sw.js) los archivos que usa esta pantalla. */
function useCacheForOffline() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || navigator.onLine === false) return;
    const send = () => {
      navigator.serviceWorker.ready
        .then((reg) => {
          const urls = performance
            .getEntriesByType("resource")
            .map((e) => e.name)
            .filter((u) => u.startsWith(location.origin));
          reg.active?.postMessage({ type: "cache-emergency-assets", urls });
        })
        .catch(() => {});
    };
    send();
    const timer = setTimeout(send, 10000);
    return () => clearTimeout(timer);
  }, []);
}

export function EmergencyView({ initialData, deniedAccess }: EmergencyViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"sheet" | "fichas" | "summary" | "stock">("sheet");
  const [deliveryRecord, setDeliveryRecord] = useState<StormVictimItem | null>(null);
  const [isFichaOpen, setIsFichaOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<StormVictimItem | null>(null);

  const { operator, viewer, stock, records, metrics } = initialData;
  const surveyor = viewer.onlyOwnRecords;

  useCacheForOffline();

  const refreshFromServer = useCallback(() => router.refresh(), [router]);
  const offline = useOfflineFichas(operator.userId, refreshFromServer);

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
    // Sin conexión no se puede pedir la planilla al servidor: se sigue con lo que hay.
    if (navigator.onLine === false) return;
    router.refresh();
    toast.info("Datos actualizados");
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      {/* Header Institucional de Contingencia con Responsable y Área Automáticos */}
      {deniedAccess && (
        <div className="rounded-2xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm text-foreground">
          Tu usuario es de relevamiento de emergencia: solo puede cargar y ver sus fichas de emergencia climática.
        </div>
      )}

      <PageHeader
        title={surveyor ? "Mis fichas de emergencia climática" : "Relevamiento Territorial y Ficha de Tormenta"}
        description={
          surveyor
            ? "Cargá las fichas del relevamiento. Acá ves solo las que cargaste vos y lo que pediste en cada una."
            : "Planilla Oficial de Contingencia Climática • Municipalidad de Tres de Febrero"
        }
        icon={CloudRain}
        actions={
          <>
            <Button
              onClick={handleExportExcel}
              variant="outline"
              className="bg-emerald-600 hover:bg-emerald-700 text-white hover:text-white border-none rounded-2xl h-11 px-5 font-bold text-xs"
            >
              <Download className="mr-2 h-4 w-4" /> Exportar Excel Oficial
            </Button>
            {viewer.canEdit && <Button
              onClick={handleOpenNewFicha}
              className="bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-2xl h-11 px-5 text-xs shadow-lg"
            >
              <Plus className="mr-2 h-4 w-4" /> Nueva Ficha Tormenta
            </Button>}
          </>
        }
      />

      {/* Fila Automática Responsable & Área */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-muted-foreground">
        <div className="bg-muted/50 px-3.5 py-1.5 rounded-xl border border-border/60 flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-amber-500" />
          <span>RESPONSABLE: <b className="text-foreground uppercase">{operator.name}</b></span>
        </div>
        <div className="bg-muted/50 px-3.5 py-1.5 rounded-xl border border-border/60 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-emerald-500" />
          <span>ÁREA: <b className="text-foreground uppercase">{operator.areaName}</b></span>
        </div>
      </div>

      <OfflineFichasPanel
        userId={operator.userId}
        pending={offline.pending}
        online={offline.online}
        syncing={offline.syncing}
        onSyncNow={() => offline.sync(true)}
        onEdit={handleOpenEditFicha}
      />

      {/* Tarjetas Resumen Métricas */}
      {surveyor ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label="Fichas cargadas"
            value={metrics.totalVictims}
            hint={offline.pending.length > 0 ? `${offline.pending.length} más sin enviar todavía` : "Relevadas por vos"}
            icon={FileText}
            tone="blue"
          />
          <StatCard
            label="Niños relevados"
            value={metrics.totalChildren}
            hint="En tus fichas"
            icon={Baby}
            tone="purple"
          />
          <StatCard
            label="Colchones / Frazadas"
            value={`${metrics.totalColchones} / ${metrics.totalFrazadas}`}
            hint="Pedidos en tus fichas"
            icon={Package}
            tone="orange"
          />
          <StatCard
            label="Camas / Cuchetas"
            value={`${metrics.totalCamas} / ${metrics.totalCuchetas}`}
            hint="Pedidos en tus fichas"
            icon={Package}
            tone="red"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label="Damnificados"
            value={metrics.totalVictims}
            hint="Registrados en planilla"
            icon={Users}
            tone="blue"
          />
          <StatCard
            label="Niños Afectados"
            value={metrics.totalChildren}
            hint="Menores contabilizados"
            icon={Baby}
            tone="purple"
          />
          <StatCard
            label="Colchones / Frazadas"
            value={`${metrics.totalColchones} / ${metrics.totalFrazadas}`}
            hint="Unidades requeridas"
            icon={Package}
            tone="orange"
          />
          <StatCard
            label="Prioridad Alta"
            value={metrics.highPriorityCount}
            hint="Urgencias territoriales"
            icon={ShieldAlert}
            tone="red"
          />
        </div>
      )}

      {/* Navegación por pestañas */}
      <div className="flex items-center gap-2 p-1.5 bg-muted/40 rounded-2xl border border-border/50 max-w-3xl overflow-x-auto">
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

        {!surveyor && <button
          onClick={() => setActiveTab("summary")}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === "summary"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          <span>Resumen y entregas</span>
        </button>}

        {viewer.canViewStock && <button
          onClick={() => setActiveTab("stock")}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === "stock"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package className="h-4 w-4" />
          <span>Stock de Contingencia</span>
        </button>}
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
            userId={operator.userId}
            canEdit={viewer.canEdit}
            onDeliver={viewer.canDeliver ? setDeliveryRecord : undefined}
          />
        </div>
      )}

      {/* Pestaña 2: Fichas Tormenta Individuales */}
      {activeTab === "fichas" && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
              Fichas Individuales Generadas ({records.length})
            </h3>
            {viewer.canEdit && <Button
              onClick={handleOpenNewFicha}
              className="rounded-xl h-10 px-4 text-xs font-bold bg-primary text-primary-foreground"
            >
              <Plus className="mr-2 h-4 w-4" /> Cargar Nueva Ficha
            </Button>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {records.map((r, idx) => (
              <Card key={r.id || idx} className="rounded-2xl border-border/60 shadow-sm bg-card p-5 space-y-3">
                <div className="flex justify-between items-start">
                  <Badge variant="outline" className={`text-[10px] font-bold uppercase ${
                    r.prioridad === 'ALTA' ? 'bg-rose-500/10 text-rose-600 border-rose-500/30' : 'bg-amber-500/10 text-amber-600'
                  }`}>
                    Prioridad {r.prioridad}
                  </Badge>
                  <span className="text-[10px] font-mono text-muted-foreground">Ficha #{idx + 1}</span>
                </div>

                <div>
                  <h4 className="text-base font-bold text-foreground uppercase">{r.nombreApellido}</h4>
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
                  <DeliveryBadge record={r} />
                </div>

                {viewer.canDeliver && r.fromTable && ["PENDIENTE", "PARCIAL"].includes(deliveryStatus(r)) && (
                  <Button
                    onClick={() => setDeliveryRecord(r)}
                    className="w-full rounded-xl text-xs font-bold h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <PackageCheck className="mr-2 h-3.5 w-3.5" /> Registrar entrega
                  </Button>
                )}

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

      {/* Resumen para la conducción y entregas pendientes */}
      {activeTab === "summary" && !surveyor && (
        <div className="animate-in fade-in duration-300">
          <StormSummaryTab records={records} stock={stock} onDeliver={viewer.canDeliver ? setDeliveryRecord : undefined} />
        </div>
      )}

      {/* Stock de Contingencia */}
      {activeTab === "stock" && viewer.canViewStock && (
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
        userId={operator.userId}
        canEdit={viewer.canEdit}
      />

      <StormDeliveryDialog
        record={deliveryRecord}
        stock={stock}
        onOpenChange={(open) => !open && setDeliveryRecord(null)}
        onDelivered={() => router.refresh()}
      />
    </div>
  );
}
