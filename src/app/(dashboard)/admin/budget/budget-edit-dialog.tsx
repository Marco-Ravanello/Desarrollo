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
import { Settings2 } from "lucide-react";
import { toast } from "sonner";

export function BudgetEditDialog({ areaId, areaName, currentBudget }: { areaId: string, areaName: string, currentBudget: number }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(currentBudget.toString());

  const handleSave = async () => {
    setLoading(true);
    try {
      const result = await updateAreaBudget(areaId, parseFloat(amount));
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
        <Button variant="ghost" size="icon" aria-label="Editar presupuesto">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar Presupuesto - {areaName}</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>Presupuesto Anual ($)</Label>
            <Input
              type="number"
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
