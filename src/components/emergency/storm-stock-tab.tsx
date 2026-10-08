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
import { Package, Plus, ArrowUpRight, Settings, Edit2, Save, X, Warehouse, Check } from "lucide-react";
import { toast } from "sonner";
import {
  updateEmergencyStockAction,
  createEmergencyStockItemAction
} from "@/app/(dashboard)/admin/actions/emergency-actions";
import Link from "next/link";

interface StormStockTabProps {
  stock: EmergencyStockItem[];
  onRefresh: () => void;
}

export function StormStockTab({ stock, onRefresh }: StormStockTabProps) {
  const [configOpen, setConfigOpen] = useState(false);
  const [addSupplyOpen, setAddSupplyOpen] = useState(false);

  // Inline editing state per card
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingStockVal, setEditingStockVal] = useState<number>(0);

  // New supply form state
  const [newSupplyName, setNewSupplyName] = useState("");
  const [newSupplyStock, setNewSupplyStock] = useState<number>(10);
  const [newSupplyUnit, setNewSupplyUnit] = useState("Unidades");
  const [newSupplyMinStock, setNewSupplyMinStock] = useState<number>(5);
  const [newSupplyDescription, setNewSupplyDescription] = useState("");

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

  const handleStartEditing = (item: EmergencyStockItem) => {
    setEditingCardId(item.id);
    setEditingStockVal(item.availableStock);
  };

  const handleCancelEditing = () => {
    setEditingCardId(null);
  };

  const handleSaveInlineStock = async (item: EmergencyStockItem) => {
    const toastId = toast.loading(`Actualizando stock de ${item.name}...`);

    const res = await updateEmergencyStockAction(item.id, editingStockVal, item.name);
    if (res.success) {
      toast.success(`Stock actualizado a ${res.newStock} unidades`, { id: toastId });
      setEditingCardId(null);
      onRefresh();
    } else {
      toast.error(res.error || "Error al actualizar stock", { id: toastId });
    }
  };

  const handleCreateNewSupply = async () => {
    if (!newSupplyName.trim()) {
      toast.error("Ingresa el nombre del insumo");
      return;
    }

    const toastId = toast.loading("Registrando nuevo insumo de contingencia...");
    const res = await createEmergencyStockItemAction({
      name: newSupplyName,
      availableStock: newSupplyStock,
      unit: newSupplyUnit,
      minStock: newSupplyMinStock,
      description: newSupplyDescription,
    });

    if (res.success) {
      toast.success("Insumo agregado al stock de emergencia", { id: toastId });
      setAddSupplyOpen(false);
      setNewSupplyName("");
      setNewSupplyStock(10);
      setNewSupplyUnit("Unidades");
      setNewSupplyMinStock(5);
      setNewSupplyDescription("");
      onRefresh();
    } else {
      toast.error(res.error || "Error al crear el insumo", { id: toastId });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card p-6 rounded-3xl border border-border/60 shadow-sm gap-4">
        <div>
          <h3 className="text-base font-black text-foreground flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Balance Comparativo: Depósito vs. Demanda de Planilla
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Gestión de stock de contingencia. Modifica directamente existencias o registra nuevos insumos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            onClick={() => setAddSupplyOpen(true)}
            className="rounded-xl font-black text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Agregar Insumo
          </Button>
          <Button asChild variant="outline" className="rounded-xl font-bold text-xs">
            <Link href="/admin/stock">
              Ver Depósito Completo <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* TARJETAS PRINCIPALES DE ELEMENTOS CLAVE (COLCHÓN, CAMA, CUCHETA, FRAZADA) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stock
          .filter((s) => ["COLCHON", "CAMA", "CUCHETA", "FRAZADA"].includes(s.category))
          .map((item) => {
            const percentage = Math.min(
              100,
              Math.round((item.demandedQuantity / (item.availableStock || 1)) * 100)
            );

            const isEditingThisCard = editingCardId === item.id;

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
                    <span className="text-[10px] text-muted-foreground uppercase font-black">Stock Disponible</span>
                    {isEditingThisCard ? (
                      <div className="flex items-center gap-1 mt-1">
                        <Input
                          type="number"
                          min="0"
                          value={editingStockVal}
                          onChange={(e) => setEditingStockVal(parseInt(e.target.value) || 0)}
                          className="h-8 rounded-lg text-sm font-black w-20 px-2"
                        />
                      </div>
                    ) : (
                      <p className="text-lg font-black text-foreground">{item.availableStock}</p>
                    )}
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

                {isEditingThisCard ? (
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      onClick={() => handleSaveInlineStock(item)}
                      className="flex-1 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white h-9"
                    >
                      <Check className="mr-1 h-4 w-4" /> Guardar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCancelEditing}
                      className="rounded-xl text-xs font-bold h-9 px-3"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => handleStartEditing(item)}
                    variant="outline"
                    className="w-full rounded-xl text-xs font-bold border-primary/30 text-primary hover:bg-primary/10 h-9 mt-2"
                  >
                    <Edit2 className="mr-1.5 h-3.5 w-3.5" /> Modificar Stock
                  </Button>
                )}
              </Card>
            );
          })}
      </div>

      {/* INSUMOS GENERALES Y ADICIONALES (CHAPAS, TIRANTES, NYLON, BIDONES, ETC.) */}
      <Card className="rounded-3xl border-border/60 shadow-sm bg-card p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-sm font-black uppercase tracking-wider text-muted-foreground">
            Otros Insumos Generales de Depósito y Materiales de Contingencia
          </h4>
          <Button
            size="sm"
            onClick={() => setAddSupplyOpen(true)}
            variant="outline"
            className="rounded-xl text-xs font-bold h-8"
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Nuevo Insumo
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stock
            .filter((s) => s.category === "GENERAL")
            .map((item) => {
              const isEditingThisCard = editingCardId === item.id;

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-muted/30 border border-border/50 flex flex-col justify-between gap-3"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h5 className="text-xs font-black text-foreground">{item.name}</h5>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{item.description}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-black shrink-0 ${
                        item.status === "CRITICO"
                          ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
                          : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                      }`}
                    >
                      {item.status}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-black">Disponible</span>
                      {isEditingThisCard ? (
                        <Input
                          type="number"
                          min="0"
                          value={editingStockVal}
                          onChange={(e) => setEditingStockVal(parseInt(e.target.value) || 0)}
                          className="h-8 rounded-lg text-xs font-black w-20 px-2 mt-0.5"
                        />
                      ) : (
                        <p className="text-sm font-black text-foreground">
                          {item.availableStock} <span className="text-[10px] font-normal text-muted-foreground">{item.unit}</span>
                        </p>
                      )}
                    </div>

                    {isEditingThisCard ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          onClick={() => handleSaveInlineStock(item)}
                          className="rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white h-7 px-2"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCancelEditing}
                          className="rounded-lg text-xs h-7 px-1.5"
                        >
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStartEditing(item)}
                        className="rounded-xl font-bold text-xs h-8 px-2.5 border-primary/30 text-primary hover:bg-primary/10"
                      >
                        <Edit2 className="mr-1 h-3 w-3" /> Modificar Stock
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
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

      {/* MODAL REGISTRO DE NUEVO INSUMO */}
      <Dialog open={addSupplyOpen} onOpenChange={setAddSupplyOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Agregar Nuevo Insumo de Contingencia
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Registra un nuevo elemento para el stock de emergencia climática (ej: Chapas de zinc, Tirantes, Nylon, Bidones).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Nombre del Insumo *</Label>
              <Input
                placeholder="Ej: Chapas de zinc 3.66m / Tirantes de pino"
                value={newSupplyName}
                onChange={(e) => setNewSupplyName(e.target.value)}
                className="rounded-xl text-sm font-bold"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Stock Inicial</Label>
                <Input
                  type="number"
                  min="0"
                  value={newSupplyStock}
                  onChange={(e) => setNewSupplyStock(parseInt(e.target.value) || 0)}
                  className="rounded-xl text-sm font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Unidad Medida</Label>
                <Input
                  placeholder="Unidades, mts, bidones..."
                  value={newSupplyUnit}
                  onChange={(e) => setNewSupplyUnit(e.target.value)}
                  className="rounded-xl text-sm font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Stock Mín. Alerta</Label>
                <Input
                  type="number"
                  min="1"
                  value={newSupplyMinStock}
                  onChange={(e) => setNewSupplyMinStock(parseInt(e.target.value) || 1)}
                  className="rounded-xl text-sm font-bold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Descripción / Especificación Técnica</Label>
              <Input
                placeholder="Ej: Chapas galvanizadas N28 para reparación rápida de techos"
                value={newSupplyDescription}
                onChange={(e) => setNewSupplyDescription(e.target.value)}
                className="rounded-xl text-xs font-medium"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAddSupplyOpen(false)} className="rounded-xl font-bold text-xs">
              Cancelar
            </Button>
            <Button onClick={handleCreateNewSupply} className="rounded-xl font-bold text-xs bg-primary text-primary-foreground">
              <Save className="mr-1.5 h-3.5 w-3.5" /> Guardar Insumo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
