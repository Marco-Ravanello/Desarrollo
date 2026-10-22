"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit, Loader2 } from "lucide-react";
import { updatePersonAction } from "@/app/(dashboard)/people/actions/update-person";
import { AddressFields } from "@/components/people/address-fields";
import { GENEROS } from "@/lib/person-display";
import type { AddressOptions } from "@/lib/localidades";
import type { PersonEditData } from "@/services/person-data";
import { toast } from "sonner";

const UBICACION: Record<string, string> = {
  UBICADA: "La dirección nueva ya está en el mapa.",
  NO_ENCONTRADA: "No encontramos la dirección nueva en el mapa: quedó en \"Ubicar en el mapa\" para marcarla a mano.",
  SIN_DIRECCION: "Sin calle y altura no se puede ubicar en el mapa: quedó en \"Ubicar en el mapa\".",
  PENDIENTE: "El servicio de mapas no respondió: se va a ubicar en la próxima búsqueda de direcciones.",
};

const inputClass = "rounded-xl bg-muted/40 border-border/60 font-semibold";

export function EditPersonDialog({ person, options }: { person: PersonEditData; options: AddressOptions }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const initial = () => ({
    firstName: person.firstName,
    lastName: person.lastName,
    direccion: person.direccion,
    barrio: person.barrio,
    localidad: person.localidad,
    telefono: person.telefono,
    email: person.email,
    fechaNacimiento: person.fechaNacimiento,
    genero: person.genero,
  });
  const [form, setForm] = useState(initial);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const handleOpenChange = (next: boolean) => {
    if (next) setForm(initial());
    setOpen(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const data = new FormData();
    for (const [k, v] of Object.entries(form)) data.append(k, v);
    try {
      const result = await updatePersonAction(person.dni, data);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (result.cambios.length === 0) {
        toast.info("No había nada para cambiar.");
      } else {
        toast.success("Datos guardados. El cambio quedó anotado en la Historia.", {
          description: result.ubicacion ? UBICACION[result.ubicacion] : undefined,
          duration: result.ubicacion && result.ubicacion !== "UBICADA" ? 10000 : undefined,
        });
      }
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("No se pudieron guardar los cambios. Revisá la conexión y probá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const generos: string[] = [...GENEROS];
  if (form.genero && !generos.includes(form.genero)) generos.push(form.genero);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-2xl border-border/60 hover:bg-muted font-bold text-xs h-9">
          <Edit className="h-3.5 w-3.5 text-primary" /> Editar datos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto rounded-2xl bg-card border-border/60 p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">Editar datos</DialogTitle>
          <DialogDescription>
            DNI {person.dni}. El DNI no se cambia; si está mal cargado, avisale a quien administra el padrón.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-lastName" className="text-xs font-bold text-muted-foreground">Apellido *</Label>
              <Input id="edit-lastName" required value={form.lastName} onChange={set("lastName")} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-firstName" className="text-xs font-bold text-muted-foreground">Nombre *</Label>
              <Input id="edit-firstName" required value={form.firstName} onChange={set("firstName")} className={inputClass} />
            </div>
          </div>

          <AddressFields
            idPrefix="edit"
            value={{ direccion: form.direccion, barrio: form.barrio, localidad: form.localidad }}
            onChange={(v) => setForm({ ...form, ...v })}
            options={options}
            inputClassName={inputClass}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-telefono" className="text-xs font-bold text-muted-foreground">Teléfono</Label>
              <Input id="edit-telefono" type="tel" value={form.telefono} onChange={set("telefono")} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email" className="text-xs font-bold text-muted-foreground">Correo</Label>
              <Input id="edit-email" type="email" value={form.email} onChange={set("email")} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-fecha" className="text-xs font-bold text-muted-foreground">Fecha de nacimiento</Label>
              <Input id="edit-fecha" type="date" value={form.fechaNacimiento} onChange={set("fechaNacimiento")} className={inputClass} />
              {person.fechaNacimientoTexto && !form.fechaNacimiento && (
                <p className="text-xs text-muted-foreground">En el padrón dice “{person.fechaNacimientoTexto}”. Si la dejás vacía, queda así.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-genero" className="text-xs font-bold text-muted-foreground">Género</Label>
              <select
                id="edit-genero"
                value={form.genero}
                onChange={set("genero")}
                className="flex h-10 w-full rounded-xl border border-border/60 bg-muted/40 px-3 text-sm font-semibold text-foreground"
              >
                <option value="">Sin dato</option>
                {generos.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-border/40 gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="rounded-xl font-bold">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="rounded-xl font-bold gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Guardando…" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
