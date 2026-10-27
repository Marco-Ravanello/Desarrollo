"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { LUGAR_TIPOS } from "@/lib/barrios";
import { deleteLugarAction, saveLugarAction } from "@/app/(dashboard)/barrios/actions";

export type LugarFormValues = {
  id: string;
  tipo: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  contacto: string | null;
  horario: string | null;
  notas: string | null;
};

const selectClass =
  "w-full h-10 px-3 rounded-xl bg-background border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

const EMPTY = { tipo: "", nombre: "", direccion: "", telefono: "", contacto: "", horario: "", notas: "" };

/** Cargar un lugar de referencia del barrio, o corregirlo si se pasa `lugar`. */
export function LugarDialog({ barrio, lugar }: { barrio: string; lugar?: LugarFormValues }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const reset = () =>
    setForm(
      lugar
        ? {
            tipo: lugar.tipo,
            nombre: lugar.nombre,
            direccion: lugar.direccion ?? "",
            telefono: lugar.telefono ?? "",
            contacto: lugar.contacto ?? "",
            horario: lugar.horario ?? "",
            notas: lugar.notas ?? "",
          }
        : EMPTY
    );

  const set = (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tipo) return toast.error("Elegí qué tipo de lugar es.");
    if (!form.nombre.trim()) return toast.error("Escribí el nombre del lugar.");
    setSaving(true);
    const res = await saveLugarAction(barrio, lugar?.id ?? null, form).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error(res && !res.success ? res.error : "No se pudo guardar. Probá de nuevo.");
    toast.success(lugar ? "Lugar guardado." : "Lugar cargado.");
    setOpen(false);
    router.refresh();
  };

  const id = (name: string) => `lugar-${lugar?.id ?? "nuevo"}-${name}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <DialogTrigger asChild>
        {lugar ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground print:hidden">
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Corregir {lugar.nombre}</span>
          </Button>
        ) : (
          <Button size="sm" className="rounded-xl font-bold gap-1.5 print:hidden">
            <Plus className="h-4 w-4" /> Cargar un lugar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="min-w-0 space-y-4">
          <DialogHeader>
            <DialogTitle>{lugar ? "Corregir lugar" : `Nuevo lugar en ${barrio}`}</DialogTitle>
            <DialogDescription>
              Escuelas, salitas, comedores y otros lugares del barrio, con a quién llamar. Los ve todo el equipo.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={id("tipo")}>Tipo</Label>
              <select id={id("tipo")} value={form.tipo} onChange={set("tipo")} className={selectClass} required>
                <option value="" disabled>Elegí uno</option>
                {LUGAR_TIPOS.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={id("nombre")}>Nombre</Label>
              <Input id={id("nombre")} value={form.nombre} onChange={set("nombre")} maxLength={120} required placeholder="Escuela Primaria N° 12" className="rounded-xl" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={id("direccion")}>Dirección (opcional)</Label>
            <Input id={id("direccion")} value={form.direccion} onChange={set("direccion")} maxLength={160} className="rounded-xl" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={id("contacto")}>Con quién hablar (opcional)</Label>
              <Input id={id("contacto")} value={form.contacto} onChange={set("contacto")} maxLength={120} placeholder="Nombre y cargo" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={id("telefono")}>Teléfono (opcional)</Label>
              <Input id={id("telefono")} type="tel" value={form.telefono} onChange={set("telefono")} maxLength={60} className="rounded-xl" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={id("horario")}>Horario (opcional)</Label>
            <Input id={id("horario")} value={form.horario} onChange={set("horario")} maxLength={120} placeholder="Lunes a viernes de 8 a 16" className="rounded-xl" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={id("notas")}>Notas (opcional)</Label>
            <Textarea id={id("notas")} value={form.notas} onChange={set("notas")} maxLength={1000} className="rounded-xl" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Borrar un lugar (quien lo cargó o la conducción), con confirmación. */
export function DeleteLugarButton({ barrio, id, nombre }: { barrio: string; id: string; nombre: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const remove = async () => {
    setSaving(true);
    const res = await deleteLugarAction(barrio, id).catch(() => null);
    setSaving(false);
    if (!res?.success) return toast.error(res && !res.success ? res.error : "No se pudo borrar. Probá de nuevo.");
    toast.success("Lugar borrado.");
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive print:hidden">
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Borrar {nombre}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Borrar {nombre}?</DialogTitle>
          <DialogDescription>Deja de aparecer en la página del barrio. Queda anotado en Auditoría.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
          <Button type="button" variant="destructive" onClick={remove} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Borrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
