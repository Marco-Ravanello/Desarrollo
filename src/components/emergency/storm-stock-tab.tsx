"use client";

import { useState } from "react";
import { EmergencyStockItem } from "@/types/emergency";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Package, Send, ArrowUpRight, Settings, Edit2, Save, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { dispatchEmergencyStockAction, updateEmergencyStockAction } from "@/app/(dashboard)/admin/actions/emergency-actions";
import Link from "next/link";

interface StormStockTabProps {
  stock: EmergencyStockItem[];
  onRefresh: () => void;
}

export function StormStockTab({ stock, onRefresh }: StormStockTabProps) {
  const [configOpen, setConfigOpen] = useState(false);
  const [editItem, setEditItem] = useState<EmergencyStockItem | null>(null);
  const [singleStockVal, setSingleStockVal] = useState<number>(0);

  // Bulk config state
  const [bulkStock, setBulkStock] = useState({
    COLCHON: stock.find((s) => s.category === "COLCHON")?.availableStock || 0,
    CAMA: stock.find((s) => s.category === "CAMA")?.availableStock || 0,
    CUCHETA: stock.find((s) => s.category === "CUCHETA")?.availableStock || 0,
    FRAZADA: stock.find((s) => s.category === "FRAZADA")?.availableStock || 0,
  });

  const handleOpenBulkConfig = () => {
    setBulkStock({
      COLCHON: stock.find((s) => s.category === "COLCHON")?.availableStock || 0,
      CAMA: stock.find((s) => s.category === "CAMA")?.availableStock || 0,
      CUCHETA: stock.find((s) => s.category === "CUCHETA")?.availableStock || 0,
      FRAZADA: stock.find((s) => s.category === "FRAZADA")?.availableStock || 0,
    });
    setConfigOpen(true);
  };

  const handleSaveBulkConfig = async () => {
    const toastId = toast.loading("Actualizando stock real de depósito...");

    try {
      await updateEmergencyStockAction("stock-cat-colchon", bulkStock.COLCHON, "Colchones de Contingencia (1 plaza)");
      await updateEmergencyStockAction("stock-cat-cama", bulkStock.CAMA, "Camas / Elásticos de Emergencia");
      await updateEmergencyStockAction("stock-cat-cucheta", bulkStock.CUCHETA, "Cuchetas Superpuestas Reforzadas");
      await updateEmergencyStockAction("stock-cat-frazada", bulkStock.FRAZADA, "Frazadas Térmicas Antialérgicas");

      toast.success("Stock real de depósito actualizado correctamente", { id: toastId });
      setConfigOpen(false);
      onRefresh();
    } catch (err) {
      toast.error("Error al actualizar el stock de depósito", { id: toastId });
    }
  };

  const handleOpenSingleEdit = (item: EmergencyStockItem) => {
    setEditItem(item);
    setSingleStockVal(item.availableStock);
  };

  const handleSaveSingleEdit = async () => {
    if (!editItem) return;
    const toastId = toast.loading(`Actualizando stock de ${editItem.name}...`);

    const res = await updateEmergencyStockAction(editItem.id, singleStockVal, editItem.name);
    if (res.success) {
      toast.success(`Stock actualizado a ${res.newStock} unidades`, { id: toastId });
      setEditItem(null);
      onRefresh();
    } else {
      toast.error(res.error || "Error al actualizar stock", { id: toastId });
    }
  };

  const handleDispatch = async (item: EmergencyStockItem, qty: number = 10) => {
    if (item.availableStock < qty) {
      toast.error(`Stock insuficiente para despachar (${item.availableStock} disponibles)`);
      return;
    }

    const toastId = toast.loading(`Despachando ${qty} unidades de ${item.name}...`);
    const res = await dispatchEmergencyStockAction(item.id, qty);

    if (res.success) {
      toast.success(`Despacho registrado en SupplyRequest y AuditLog`, { id: toastId });
      onRefresh();
    } else {
      toast.error(res.error || "Error al realizar el despacho", { id: toastId });
    }
  };

  const categoriesOrder = ["COLCHON", "CAMA", "CUCHETA", "FRAZADA", "GENERAL"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card p-6 rounded-3xl border border-border/60 shadow-sm gap-4">
        <div>
          <h3 className="text-base font-black text-foreground flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Balance Comparativo: Depósito vs. Demanda de Planilla
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Gestión única preservada del módulo anterior. Ajusta el stock disponible en depósito y compara contra la demanda.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={handleOpenBulkConfig}
            className="rounded-xl font-black text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Settings className="mr-1.5 h-3.5 w-3.5" /> Configurar Stock Real del Depósito
          </Button>
          <Button asChild variant="outline" className="rounded-xl font-bold text-xs">
            <Link href="/admin/stock">
              Ver Depósito Completo <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {categoriesOrder.slice(0, 4).map((catKey) => {
          const item = stock.find((s) => s.category === catKey);
          if (!item) return null;

          const percentage = Math.min(
            100,
            Math.round((item.demandedQuantity / (item.availableStock || 1)) * 100)
          );

          return (
            <Card key={item.id} className="rounded-3xl border-border/60 shadow-sm bg-card p-5 space-y-3">
              <div className="flex justify-between items-center">
                <Badge
                  variant="outline"
                  className={`text-[10px] font-black uppercase ${
                    item.status === "CRITICO"
                      ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
                      : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                  }`}
                >
                  {item.status}
                </Badge>
                <span className="text-[11px] font-bold text-muted-foreground">{item.unit}</span>
              </div>

              <div>
                <h4 className="text-sm font-black text-foreground">{item.name}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{item.areaName}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 text-xs">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground uppercase font-black">Stock Disponible</span>
                    <button
                      onClick={() => handleOpenSingleEdit(item)}
                      className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5"
                    >
                      <Edit2 className="h-2.5 w-2.5" /> Editar
                    </button>
                  </div>
                  <p className="text-lg font-black text-foreground">{item.availableStock}</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-black">Requerido Planilla</span>
                  <p className="text-lg font-black text-amber-600">{item.demandedQuantity}</p>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                  <span>Cobertura de Demanda</span>
                  <span>{percentage}%</span>
                </div>
                <Progress
                  value={percentage}
                  className={`h-2 ${item.status === "CRITICO" ? "[&>div]:bg-rose-500" : "[&>div]:bg-primary"}`}
                />
              </div>

              <Button
                onClick={() => handleDispatch(item, 10)}
                className="w-full rounded-xl text-xs font-bold bg-primary text-primary-foreground h-9 mt-2"
              >
                <Send className="mr-2 h-3.5 w-3.5" /> Despachar 10 a Territorio
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Insumos Generales de Contingencia */}
      <Card className="rounded-3xl border-border/60 shadow-sm bg-card p-6 space-y-4">
        <h4 className="text-sm font-black uppercase tracking-wider text-muted-foreground">
          Otros Insumos Generales de Depósito
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stock
            .filter((s) => s.category === "GENERAL")
            .map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-between gap-3"
              >
                <div>
                  <h5 className="text-xs font-black text-foreground">{item.name}</h5>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Disponible: <b className="text-foreground">{item.availableStock}</b> {item.unit}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleOpenSingleEdit(item)}
                    className="rounded-xl font-bold text-xs h-8 px-2"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDispatch(item, 5)}
                    className="rounded-xl font-bold text-xs shrink-0 h-8"
                  >
                    Despachar 5
                  </Button>
                </div>
              </div>
            ))}
        </div>
      </Card>

      {/* MODAL CONFIGURACIÓN MASIVA DE STOCK EN DEPÓSITO */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-emerald-600" />
              Configuración de Stock Real en Depósito
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Ingresa la cantidad física exacta de unidades disponibles actualmente en los galpones de Desarrollo Humano.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Colchones (Unidades)</Label>
                <Input
                  type="number"
                  min="0"
                  value={bulkStock.COLCHON}
                  onChange={(e) => setBulkStock({ ...bulkStock, COLCHON: parseInt(e.target.value) || 0 })}
                  className="rounded-xl text-sm font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Camas / Elásticos (Unidades)</Label>
                <Input
                  type="number"
                  min="0"
                  value={bulkStock.CAMA}
                  onChange={(e) => setBulkStock({ ...bulkStock, CAMA: parseInt(e.target.value) || 0 })}
                  className="rounded-xl text-sm font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Cuchetas (Unidades)</Label>
                <Input
                  type="number"
                  min="0"
                  value={bulkStock.CUCHETA}
                  onChange={(e) => setBulkStock({ ...bulkStock, CUCHETA: parseInt(e.target.value) || 0 })}
                  className="rounded-xl text-sm font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Frazadas (Unidades)</Label>
                <Input
                  type="number"
                  min="0"
                  value={bulkStock.FRAZADA}
                  onChange={(e) => setBulkStock({ ...bulkStock, FRAZADA: parseInt(e.target.value) || 0 })}
                  className="rounded-xl text-sm font-bold"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfigOpen(false)} className="rounded-xl font-bold text-xs">
              Cancelar
            </Button>
            <Button onClick={handleSaveBulkConfig} className="rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
              <Save className="mr-1.5 h-3.5 w-3.5" /> Guardar Stock Real
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL EDICIÓN INDIVIDUAL DE STOCK */}
      <Dialog open={Boolean(editItem)} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="sm:max-w-xs rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-sm font-black flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-primary" />
              Editar Stock: {editItem?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label className="text-xs font-bold">Cantidad disponible en depósito</Label>
            <Input
              type="number"
              min="0"
              value={singleStockVal}
              onChange={(e) => setSingleStockVal(parseInt(e.target.value) || 0)}
              className="rounded-xl text-sm font-bold"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditItem(null)} className="rounded-xl font-bold text-xs">
              Cancelar
            </Button>
            <Button onClick={handleSaveSingleEdit} className="rounded-xl font-bold text-xs bg-primary text-primary-foreground">
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
