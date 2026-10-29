"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addSupplyAction } from "@/app/(dashboard)/admin/actions/stock-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";

const selectClass =
  "w-full h-10 px-3 rounded-xl bg-background border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

/** Botón "Nuevo insumo": abre el formulario en una ventana, así la lista ocupa toda la pantalla. */
export function CreateSupplyButton({ areas }: { areas: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      const result = await addSupplyAction(formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`${String(formData.get("name") ?? "El insumo").trim()} quedó cargado.`);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("No se pudo cargar el insumo. Revisá la conexión y probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Nuevo insumo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nuevo insumo</DialogTitle>
            <DialogDescription>Sumalo al depósito con lo que hay hoy y el mínimo para pedir más.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="supply-name">
              Nombre del insumo{" "}
              <span className="text-rose-600" aria-hidden>
                *
              </span>
            </Label>
            <Input id="supply-name" name="name" placeholder="Ej: Resmas A4" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="supply-description">Descripción (opcional)</Label>
            <Input id="supply-description" name="description" placeholder="Ej: Caja de 10 resmas" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="supply-stock">Cuántos hay hoy</Label>
              <Input id="supply-stock" name="stock" type="number" min="0" defaultValue="0" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="supply-min">Mínimo para reponer</Label>
              <Input id="supply-min" name="minStock" type="number" min="0" defaultValue="5" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="supply-area">Área responsable</Label>
            <select id="supply-area" name="areaId" className={selectClass} defaultValue="">
              <option value="">Depósito general</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando…" : "Cargar insumo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
