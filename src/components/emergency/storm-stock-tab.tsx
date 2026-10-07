"use client";

import { EmergencyStockItem } from "@/types/emergency";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Package, Send, AlertTriangle, CheckCircle, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { dispatchEmergencyStockAction } from "@/app/(dashboard)/admin/actions/emergency-actions";
import Link from "next/link";

interface StormStockTabProps {
  stock: EmergencyStockItem[];
  onRefresh: () => void;
}

export function StormStockTab({ stock, onRefresh }: StormStockTabProps) {
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
      <div className="flex justify-between items-center bg-card p-6 rounded-3xl border border-border/60 shadow-sm">
        <div>
          <h3 className="text-base font-black text-foreground flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Balance Comparativo: Depósito vs. Demanda de Planilla
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Gestión única preservada del módulo anterior, conectada con SupplyItem y solicitudes en tiempo real.
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-xl font-bold text-xs">
          <Link href="/admin/stock">
            Ver Depósito Completo <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
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
                  <span className="text-[10px] text-muted-foreground uppercase font-black">Stock Disponible</span>
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDispatch(item, 5)}
                  className="rounded-xl font-bold text-xs shrink-0"
                >
                  Despachar 5
                </Button>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}
