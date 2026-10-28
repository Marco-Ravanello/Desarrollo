"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateAreaBudget } from "../actions/budget-actions";
import { Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";

export function BudgetEditDialog({
  areaId,
  areaName,
  currentBudget,
  asButton = false,
}: {
  areaId: string;
  areaName: string;
  currentBudget: number;
  /** Botón con texto "Cargar presupuesto" (cuando el área todavía no tiene), en vez del ícono. */
  asButton?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(currentBudget > 0 ? currentBudget.toString() : "");

  const handleSave = async () => {
    setLoading(true);
    try {
      const value = parseFloat(amount);
      if (amount.trim() === "" || Number.isNaN(value) || value < 0) {
        toast.error("Escribí el monto del presupuesto anual.");
        return;
      }
      const result = await updateAreaBudget(areaId, value);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Presupuesto actualizado");
      setOpen(false);
    } catch {
      toast.error("No se pudo actualizar el presupuesto. Revisá la conexión y probá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {asButton ? (
          <Button size="sm" className="rounded-xl font-bold gap-1.5 self-start sm:self-auto">
            <Plus className="h-4 w-4" /> Cargar presupuesto
          </Button>
        ) : (
          <Button variant="ghost" size="icon" aria-label="Editar presupuesto">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{currentBudget > 0 ? "Cambiar el presupuesto" : "Cargar el presupuesto"}: {areaName}</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>Presupuesto anual ($)</Label>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              autoFocus
              placeholder="Por ejemplo, 5000000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>Guardar cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
