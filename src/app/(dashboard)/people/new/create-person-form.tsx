"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { createPersonAction } from "../actions/create-person";
import { AddressFields, type AddressValue } from "@/components/people/address-fields";
import { GENEROS } from "@/lib/person-display";
import type { AddressOptions } from "@/lib/localidades";
import { MapPin, UserRound } from "lucide-react";

const UBICACION: Record<string, string> = {
  UBICADA: "Ya está en el mapa.",
  NO_ENCONTRADA: "No encontramos la dirección en el mapa: quedó en \"Ubicar en el mapa\" para marcarla a mano.",
  SIN_DIRECCION: "Sin calle y altura no se puede ubicar en el mapa: quedó en \"Ubicar en el mapa\".",
  PENDIENTE: "El servicio de mapas no respondió: se va a ubicar en la próxima búsqueda de direcciones.",
};

export function CreatePersonForm({ options }: { options: AddressOptions }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState<AddressValue>({ direccion: "", barrio: "", localidad: "" });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    try {
      const result = await createPersonAction(formData);
      if (result.success) {
        toast.success("Persona cargada", {
          description: UBICACION[result.ubicacion],
          duration: result.ubicacion === "UBICADA" ? undefined : 10000,
        });
        router.push(`/people/${result.id}`);
      } else if (result.existingId) {
        const existingId = result.existingId;
        toast.error(result.error, {
          duration: 10000,
          action: { label: "Ver su ficha", onClick: () => router.push(`/people/${existingId}`) },
        });
      } else {
        toast.error(result.error || "No se pudo cargar a la persona.");
      }
    } catch {
      toast.error("No se pudo guardar la persona. Revisá la conexión y probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserRound className="h-5 w-5 text-primary" />
            Datos personales
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dni">DNI o documento *</Label>
            <Input id="dni" name="dni" inputMode="numeric" placeholder="Ej.: 12345678" required className="bg-background" />
          </div>
          <div className="hidden md:block" />
          <div className="space-y-2">
            <Label htmlFor="lastName">Apellido *</Label>
            <Input id="lastName" name="lastName" placeholder="Ej.: Pérez" required className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="firstName">Nombre *</Label>
            <Input id="firstName" name="firstName" placeholder="Ej.: Juan Carlos" required className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fechaNacimiento">Fecha de nacimiento</Label>
            <Input id="fechaNacimiento" name="fechaNacimiento" type="date" className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="genero">Género</Label>
            <select id="genero" name="genero" defaultValue="" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
              <option value="">Sin dato</option>
              {GENEROS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefono">Teléfono</Label>
            <Input id="telefono" name="telefono" type="tel" placeholder="Ej.: 11 4444-5555" className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" name="email" type="email" placeholder="nombre@ejemplo.com" className="bg-background" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Domicilio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AddressFields idPrefix="nueva" value={address} onChange={setAddress} options={options} inputClassName="bg-background" labelClassName="" />
          <p className="mt-3 text-xs text-muted-foreground">Completá la calle y altura, o al menos el barrio.</p>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando…" : "Cargar persona"}
        </Button>
      </div>
    </form>
  );
}
