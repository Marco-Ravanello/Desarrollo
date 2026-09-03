"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit, Loader2 } from "lucide-react";
import { updatePersonAction } from "@/app/(dashboard)/people/actions/update-person";
import { toast } from "sonner";

interface EditPersonDialogProps {
  person: {
    id: string;
    dni: string;
    firstName: string;
    lastName: string;
    birthDate?: Date | string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
}

export function EditPersonDialog({ person }: EditPersonDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    dni: person.dni || "",
    firstName: person.firstName || "",
    lastName: person.lastName || "",
    birthDate: person.birthDate ? new Date(person.birthDate).toISOString().split("T")[0] : "",
    address: person.address || "",
    phone: person.phone || "",
    email: person.email || ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const data = new FormData();
    data.append("dni", formData.dni);
    data.append("firstName", formData.firstName);
    data.append("lastName", formData.lastName);
    data.append("birthDate", formData.birthDate);
    data.append("address", formData.address);
    data.append("phone", formData.phone);
    data.append("email", formData.email);

    try {
      const result = await updatePersonAction(person.id, data);
      if (result.success) {
        toast.success("Datos del ciudadano actualizados correctamente");
        setOpen(false);
      } else {
        toast.error(result.error || "Error al actualizar");
      }
    } catch (error) {
      toast.error("Ocurrió un error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-2xl border-border/60 hover:bg-muted font-bold text-xs h-9">
          <Edit className="h-3.5 w-3.5 text-primary" /> Editar Vecino
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] rounded-3xl bg-card border-border/60 p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-foreground">Editar Datos del Ciudadano</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="firstName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nombre *</Label>
              <Input
                id="firstName"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="rounded-xl bg-muted/40 border-border/60 font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lastName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Apellido *</Label>
              <Input
                id="lastName"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="rounded-xl bg-muted/40 border-border/60 font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dni" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">DNI / Documento *</Label>
              <Input
                id="dni"
                required
                value={formData.dni}
                onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                className="rounded-xl bg-muted/40 border-border/60 font-mono font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="birthDate" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fecha Nacimiento</Label>
              <Input
                id="birthDate"
                type="date"
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                className="rounded-xl bg-muted/40 border-border/60 font-semibold"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dirección Residencial</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="rounded-xl bg-muted/40 border-border/60 font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Teléfono / Celular</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="rounded-xl bg-muted/40 border-border/60 font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="rounded-xl bg-muted/40 border-border/60 font-semibold"
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-border/40 gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="rounded-xl font-bold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-xl font-bold gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
